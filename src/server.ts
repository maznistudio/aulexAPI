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

// Start server - bind to 0.0.0.0 for external access
const HOST = process.env.HOST || '0.0.0.0'
const PUBLIC_IP = process.env.PUBLIC_IP || '92.111.11.30'

app.listen(Number(PORT), HOST, () => {
  console.log(`[Server] Running on http://${HOST}:${PORT}`)
  console.log(`[Server] Local access: http://localhost:${PORT}/`)
  console.log(`[Server] Public access: http://${PUBLIC_IP}:${PORT}/`)
  console.log(`[Server] VEO API: POST http://${PUBLIC_IP}:${PORT}/api/veo`)
  console.log(`[Server] API Key: ${process.env.API_KEY ? 'Configured ✓' : 'Using default (set API_KEY in .env.local)'}`)
})
