import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { randomBytes } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import express from 'express'
import helmet from 'helmet'
import { Prisma, type FitnessGoal, type InsightStatus } from '@prisma/client'
import { z, ZodError } from 'zod'
import { hashSessionToken, requireAuth } from './auth.js'
import { prisma } from './db.js'
import { summarizeDataQuality } from './services/fitness.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '16kb' }))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false })
const foodSearchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false })
const router = Router()
const emailSchema = z.string().trim().toLowerCase().email().max(254)
const passwordSchema = z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long')

async function setSessionCookie(response: Response, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  await prisma.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } })
  response.cookie('fittrack_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/api',
  })
}

function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next)
  }
}

router.get('/health', (_request, response) => response.json({ status: 'ok', service: 'fittrack-pro-api' }))

router.get('/foods/search', foodSearchLimiter, asyncRoute(async (request, response) => {
  const { query } = z.object({ query: z.string().trim().min(2).max(80) }).parse({ query: request.query.q })
  const url = new URL('https://world.openfoodfacts.org/api/v2/search')
  url.search = new URLSearchParams({
    search_terms: query,
    page_size: '8',
    fields: 'code,product_name,brands,nutriments',
  }).toString()
  let upstream: globalThis.Response
  try {
    upstream = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'FitTrackPro/1.0 (food search)' },
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    console.error('Food database request failed:', error instanceof Error ? error.name : 'Unknown error')
    response.status(502).json({ error: 'The food database is temporarily unavailable. Try again or enter nutrition manually.' })
    return
  }
  if (!upstream.ok) {
    response.status(502).json({ error: `The food database returned HTTP ${upstream.status}. Try again or enter nutrition manually.` })
    return
  }
  let payload: { products?: unknown }
  try {
    payload = await upstream.json() as { products?: unknown }
  } catch (error) {
    console.error('Food database returned invalid JSON:', error)
    response.status(502).json({ error: 'The food database returned an invalid response. Try again or enter nutrition manually.' })
    return
  }
  if (!Array.isArray(payload.products)) {
    response.status(502).json({ error: 'The food database returned an unexpected response. Try again or enter nutrition manually.' })
    return
  }
  response.json({ products: payload.products })
}))

router.post('/auth/register', authLimiter, asyncRoute(async (request, response) => {
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    email: emailSchema,
    password: passwordSchema,
  }).parse(request.body)
  const passwordHash = await bcrypt.hash(input.password, 12)
  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, password: passwordHash },
      select: { id: true, name: true, email: true },
    })
    await setSessionCookie(response, user.id)
    response.status(201).json({ user })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ error: 'An account with this email already exists' })
      return
    }
    throw error
  }
}))

router.post('/auth/login', authLimiter, asyncRoute(async (request, response) => {
  const input = z.object({ email: emailSchema, password: z.string().min(1).max(72) }).parse(request.body)
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    response.status(401).json({ error: 'Email or password is incorrect' })
    return
  }
  await setSessionCookie(response, user.id)
  response.json({ user: { id: user.id, name: user.name, email: user.email } })
}))

router.post('/auth/logout', asyncRoute(async (request, response) => {
  const token = request.cookies?.fittrack_session as string | undefined
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
  }
  response.clearCookie('fittrack_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
  })
  response.status(204).end()
}))

router.get('/auth/me', requireAuth, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, name: true, email: true, profile: true },
  })
  if (!user) {
    response.status(404).json({ error: 'Account not found' })
    return
  }
  response.json({ user })
}))

router.get('/dashboard', requireAuth, asyncRoute(async (request, response) => {
  const userId = request.userId!
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const [profile, goal, workouts, meals, weights] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.goal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: 'desc' } }),
    prisma.workout.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 5, include: { sets: true } }),
    prisma.mealEntry.findMany({ where: { userId, eatenAt: { gte: startOfToday } }, orderBy: { eatenAt: 'asc' } }),
    prisma.weightLog.findMany({ where: { userId }, orderBy: { recordedAt: 'desc' }, take: 14 }),
  ])
  response.json({ profile, goal, workouts, meals, weights: weights.reverse() })
}))

router.get('/workouts', requireAuth, asyncRoute(async (request, response) => {
  const workouts = await prisma.workout.findMany({
    where: { userId: request.userId! },
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { sets: true },
  })
  response.json({ workouts })
}))

router.post('/workouts', requireAuth, asyncRoute(async (request, response) => {
  const input = z.object({
    title: z.string().trim().min(1).max(100),
    focus: z.string().trim().max(120).optional(),
    duration: z.number().int().min(1).max(600),
    volumeKg: z.number().int().min(0).max(100000).default(0),
    notes: z.string().max(1000).optional(),
    startedAt: z.coerce.date().optional(),
    sets: z.array(z.object({
      exercise: z.string().trim().min(1).max(100),
      setNumber: z.number().int().min(1).max(50),
      reps: z.number().int().min(0).max(1000),
      weightKg: z.number().min(0).max(2000),
    })).max(200).optional(),
  }).parse(request.body)
  const workout = await prisma.workout.create({
    data: {
      userId: request.userId!,
      title: input.title,
      focus: input.focus ?? 'Full body',
      duration: input.duration,
      volumeKg: input.volumeKg,
      notes: input.notes,
      startedAt: input.startedAt,
      sets: { create: input.sets ?? [] },
    },
    include: { sets: true },
  })
  response.status(201).json({ workout })
}))

router.get('/meals', requireAuth, asyncRoute(async (request, response) => {
  const date = request.query.date ? new Date(String(request.query.date)) : new Date()
  if (Number.isNaN(date.getTime())) {
    response.status(400).json({ error: 'Date must be a valid ISO date' })
    return
  }
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  const meals = await prisma.mealEntry.findMany({
    where: { userId: request.userId!, eatenAt: { gte: start, lt: end } },
    orderBy: { eatenAt: 'asc' },
  })
  response.json({ meals })
}))

router.post('/meals', requireAuth, asyncRoute(async (request, response) => {
  const input = z.object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).default('SNACK'),
    quantity: z.number().positive().max(1000).default(1),
    servingUnit: z.string().trim().min(1).max(40).default('serving'),
    servingDescription: z.string().trim().min(1).max(80).default('1 serving'),
    calories: z.number().int().min(0).max(10000),
    proteinG: z.number().min(0).max(1000),
    carbsG: z.number().min(0).max(1000),
    fatG: z.number().min(0).max(1000),
    eatenAt: z.coerce.date().optional(),
  }).parse(request.body)
  const meal = await prisma.mealEntry.create({ data: { ...input, userId: request.userId! } })
  response.status(201).json({ meal })
}))

router.get('/measurements/bodyweight', requireAuth, asyncRoute(async (request, response) => {
  const weights = await prisma.weightLog.findMany({
    where: { userId: request.userId! },
    orderBy: { recordedAt: 'desc' },
    take: 365,
  })
  response.json({ weights: weights.reverse() })
}))

router.post('/measurements/bodyweight', requireAuth, asyncRoute(async (request, response) => {
  const input = z.object({
    weightKg: z.number().min(20).max(350),
    recordedAt: z.coerce.date().optional(),
    note: z.string().max(500).optional(),
  }).parse(request.body)
  const weight = await prisma.weightLog.create({ data: { ...input, userId: request.userId! } })
  response.status(201).json({ weight })
}))

const insightRules: Array<{ category: string; title: string; explanation: string; confidence: string }> = [
  {
    category: 'DATA_QUALITY',
    title: 'More check-ins reveal a clearer pattern',
    explanation: 'A few weeks of regular weigh-ins make it easier to tell a sustained trend from normal daily fluctuations.',
    confidence: 'LIMITED_DATA',
  },
  {
    category: 'NUTRITION',
    title: 'A fuller food log makes insights more useful',
    explanation: 'Logging food on more days helps make weekly calorie and macro averages more representative.',
    confidence: 'LIMITED_DATA',
  },
  {
    category: 'TRAINING',
    title: 'Your training rhythm is taking shape',
    explanation: 'A few recorded sessions provide helpful context. Rest and recovery are part of your training as well.',
    confidence: 'LIMITED_DATA',
  },
]

router.get('/insights', requireAuth, asyncRoute(async (request, response) => {
  const userId = request.userId!
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const [weightCount, meals, workoutCount, existing] = await Promise.all([
    prisma.weightLog.count({ where: { userId, recordedAt: { gte: since } } }),
    prisma.mealEntry.findMany({ where: { userId, eatenAt: { gte: since } }, select: { eatenAt: true } }),
    prisma.workout.count({ where: { userId, startedAt: { gte: since } } }),
    prisma.fitnessInsight.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ])
  const nutritionDaysLogged = new Set(meals.map((meal) => meal.eatenAt.toISOString().slice(0, 10))).size
  const quality = summarizeDataQuality({ weightEntryCount: weightCount, nutritionDaysLogged, workoutCount })
  const shouldGenerate = [
    weightCount < 7,
    nutritionDaysLogged < 5,
    workoutCount < 3,
  ]
  const observations = insightRules.filter((_rule, index) => shouldGenerate[index])
  for (const insight of observations) {
    const active = existing.some((item) => item.title === insight.title && item.status === 'PENDING')
    if (!active) {
      await prisma.fitnessInsight.create({
        data: {
          userId,
          ...insight,
          evidence: { weightEntries: weightCount, nutritionDaysLogged, workouts: workoutCount },
        },
      })
    }
  }
  const insights = await prisma.fitnessInsight.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 })
  response.json({ insights, dataQuality: quality })
}))

router.patch('/insights/:id/status', requireAuth, asyncRoute(async (request, response) => {
  const { status } = z.object({ status: z.enum(['ACCEPTED', 'DISMISSED', 'COMPLETED']) }).parse(request.body) as { status: InsightStatus }
  const id = request.params.id
  if (typeof id !== 'string') {
    response.status(400).json({ error: 'Insight ID must be a single value' })
    return
  }
  const result = await prisma.fitnessInsight.updateMany({
    where: { id, userId: request.userId! },
    data: { status },
  })
  if (result.count === 0) {
    response.status(404).json({ error: 'Insight not found' })
    return
  }
  response.json({ status })
}))

router.patch('/profile', requireAuth, asyncRoute(async (request, response) => {
  const input = z.object({
    age: z.number().int().min(16).max(100).nullable().optional(),
    heightCm: z.number().min(100).max(250).nullable().optional(),
    activityLevel: z.enum(['LOW', 'LIGHT', 'MODERATE', 'HIGH']).nullable().optional(),
    calorieTarget: z.number().int().min(800).max(8000).nullable().optional(),
    proteinTarget: z.number().int().min(0).max(500).nullable().optional(),
    goal: z.enum(['MUSCLE_GAIN', 'FAT_LOSS', 'MAINTENANCE', 'RECOMPOSITION']).optional(),
  }).parse(request.body)
  const { goal, ...profile } = input
  const result = await prisma.$transaction(async (transaction) => {
    const updatedProfile = await transaction.profile.upsert({
      where: { userId: request.userId! },
      create: { userId: request.userId!, ...profile },
      update: profile,
    })
    let updatedGoal: { type: FitnessGoal } | null = null
    if (goal) {
      await transaction.goal.updateMany({ where: { userId: request.userId!, active: true }, data: { active: false } })
      updatedGoal = await transaction.goal.create({
        data: { userId: request.userId!, type: goal, title: goal.replace('_', ' ').toLowerCase() },
        select: { type: true },
      })
    }
    return { profile: updatedProfile, goal: updatedGoal }
  })
  response.json(result)
}))

app.use('/api', router)
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }))

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request data', details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) })
    return
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response.status(409).json({ error: 'This record already exists' })
    return
  }
  console.error('Unhandled API error:', error)
  response.status(500).json({ error: 'An unexpected server error occurred' })
})

export { app, prisma }
