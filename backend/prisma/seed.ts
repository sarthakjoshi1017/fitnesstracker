import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const email = process.env.DEMO_EMAIL?.trim().toLowerCase()
const password = process.env.DEMO_PASSWORD

if (!email || !password || password.length < 8) {
  throw new Error('Set DEMO_EMAIL and a DEMO_PASSWORD of at least 8 characters before seeding.')
}

try {
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12)
    user = await prisma.user.create({ data: { email, name: 'Demo Athlete', password: passwordHash } })
  }

  const [workoutCount, mealCount, weightCount, activeGoal] = await Promise.all([
    prisma.workout.count({ where: { userId: user.id } }),
    prisma.mealEntry.count({ where: { userId: user.id } }),
    prisma.weightLog.count({ where: { userId: user.id } }),
    prisma.goal.findFirst({ where: { userId: user.id, active: true } }),
  ])
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, calorieTarget: 2200, proteinTarget: 145, heightCm: 175, age: 22, activityLevel: 'MODERATE' },
  })
  if (!activeGoal) {
    await prisma.goal.create({ data: { userId: user.id, type: 'MUSCLE_GAIN', title: 'Build strength steadily', active: true } })
  }
  if (workoutCount === 0) {
    await prisma.workout.create({
      data: {
        userId: user.id, title: 'Upper body strength', focus: 'Chest · Back · Shoulders', duration: 58, volumeKg: 800,
        sets: { create: [
          { exercise: 'Bench press', setNumber: 1, reps: 8, weightKg: 50 },
          { exercise: 'Bench press', setNumber: 2, reps: 8, weightKg: 50 },
        ] },
      },
    })
  }
  if (mealCount === 0) {
    await prisma.mealEntry.create({
      data: { userId: user.id, name: 'Greek yogurt & berries', type: 'BREAKFAST', calories: 320, proteinG: 28, carbsG: 38, fatG: 6 },
    })
  }
  if (weightCount === 0) {
    await prisma.weightLog.create({ data: { userId: user.id, weightKg: 72.4 } })
  }
  console.log(`Seeded demo account ${email}`)
} finally {
  await prisma.$disconnect()
}
