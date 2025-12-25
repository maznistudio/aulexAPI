import { Request, Response, NextFunction } from 'express'

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const API_KEY = process.env.API_KEY || 'default-api-key-change-me'
  
  const apiKey = req.headers['x-api-key'] as string || 
                 (req.headers['authorization'] as string)?.replace('Bearer ', '')

  console.log(`[Auth] Checking API key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'missing'}`)
  console.log(`[Auth] Expected key: ${API_KEY.substring(0, 8)}...`)

  if (!apiKey) {
    res.status(401).json({ error: 'API key required. Use header: x-api-key or Authorization: Bearer <key>' })
    return
  }

  if (apiKey !== API_KEY) {
    res.status(403).json({ error: 'Invalid API key' })
    return
  }

  next()
}

