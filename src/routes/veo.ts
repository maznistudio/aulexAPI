import { Router, Request, Response } from 'express'
import { generateVideoViaPlaywright, type VideoGenerationResult, type VideoGenerationOptions } from '../lib/playwright-veo'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio, mode, outputsCount, startFrameBase64, endFrameBase64 } = req.body

    if (!prompt) {
      res.status(400).json({ error: 'Missing required parameter: prompt' })
      return
    }

    console.log(`[VEO API] Starting Playwright automation`)
    console.log(`[VEO API] Prompt: ${prompt.substring(0, 50)}...`)
    console.log(`[VEO API] Mode: ${mode || 'text-to-video'}`)
    console.log(`[VEO API] Aspect Ratio: ${aspectRatio || 'landscape'}`)
    console.log(`[VEO API] Outputs Count: ${outputsCount || 1}`)
    console.log(`[VEO API] Has Start Frame: ${!!startFrameBase64}`)
    console.log(`[VEO API] Has End Frame: ${!!endFrameBase64}`)

    // Build options object
    const options: VideoGenerationOptions = {
      prompt,
      aspectRatio: aspectRatio || 'landscape',
      mode: mode || 'text-to-video',
      outputsCount: outputsCount || 1,
      startFrameBase64,
      endFrameBase64,
    }

    // Generate video via Playwright UI automation
    const result: VideoGenerationResult = await generateVideoViaPlaywright(
      options,
      (message: string) => console.log(`[VEO API] Progress: ${message}`)
    )

    if (!result.success) {
      console.error('[VEO API] Video generation failed:', result.error)
      res.status(500).json({ error: result.error || 'Video generation failed' })
      return
    }

    console.log(`[VEO API] Success! Generated ${result.videoUrls?.length || 0} video(s)`)
    res.json({
      success: true,
      videoUrls: result.videoUrls
    })

  } catch (error) {
    console.error('[VEO API] Error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      details: error instanceof Error ? error.stack : String(error)
    })
  }
})

export default router
