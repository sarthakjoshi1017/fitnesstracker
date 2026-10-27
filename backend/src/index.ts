import 'dotenv/config'
import { app, prisma } from './app.js'

const port = Number(process.env.SERVER_PORT ?? 3001)
const secret = process.env.SESSION_SECRET

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('SERVER_PORT must be a valid TCP port')
}
if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters')
}

await prisma.$connect()
const server = app.listen(port, () => {
  console.log(`FitTrack Pro API listening on port ${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
