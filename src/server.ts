import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import express, { Request, Response } from 'express'
import path from 'path'
import veoRouter from './routes/veo'
import { apiKeyAuth } from './middleware/auth'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json({ limit: '50mb' })) // Allow large base64 images

// Serve static files (API docs)
app.use(express.static(path.join(__dirname, '../public')))

// Health check (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes (with auth)
app.use('/api/veo', apiKeyAuth, veoRouter)

// API docs page
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[Server] API Docs: http://localhost:${PORT}/`)
  console.log(`[Server] VEO API: POST http://localhost:${PORT}/api/veo`)
  console.log(`[Server] API Key: ${process.env.API_KEY ? 'Configured ✓' : 'Using default (set API_KEY in .env.local)'}`)
})
