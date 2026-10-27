import { createHmac } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from './db.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function hashSessionToken(token: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET ?? '').update(token).digest('hex')
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.fittrack_session as string | undefined
  if (!token) {
    response.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } })
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } })
      response.status(401).json({ error: 'Your session is invalid or has expired' })
      return
    }
    request.userId = session.userId
    next()
  } catch (error) {
    next(error)
  }
}
