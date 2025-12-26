// src/lib/playwright-veo.ts
// Playwright implementation with persistent browser - login saved, browser reused

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Base URL - navigating here creates a new project each time
const FLOW_BASE_URL = 'https://labs.google/fx/tools/flow/'

// Configuration from environment variables
const USER_DATA_DIR = process.env.PLAYWRIGHT_PROFILE_DIR || path.join(os.homedir(), '.playwright-veo-profile')
const HEADLESS_MODE = process.env.HEADLESS_MODE === 'true'

// Helper for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ============ Human-Like Behavior Helpers ============

// Random delay dengan variasi natural
const humanDelay = (min = 100, max = 300) =>
  sleep(Math.floor(Math.random() * (max - min + 1)) + min)

// Random integer helper
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

// Simulasi gerakan mouse ke elemen dengan curve natural
async function humanMouseMove(page: Page, x: number, y: number) {
  // Add slight randomness to target position
  const targetX = x + (Math.random() - 0.5) * 10
  const targetY = y + (Math.random() - 0.5) * 10
  // Move with natural steps (not instant)
  await page.mouse.move(targetX, targetY, { steps: randomInt(5, 15) })
}

// Klik element dengan mouse movement natural
async function humanClick(page: Page, element: import('playwright').Locator) {
  const box = await element.boundingBox()
  if (box) {
    // Move mouse to element with slight offset
    const x = box.x + box.width / 2 + (Math.random() - 0.5) * (box.width * 0.3)
    const y = box.y + box.height / 2 + (Math.random() - 0.5) * (box.height * 0.3)
    await humanMouseMove(page, x, y)
    await humanDelay(50, 150)
    await page.mouse.click(x, y)
    await humanDelay(100, 250)
  } else {
    // Fallback to normal click if no bounding box
    await element.click()
    await humanDelay(100, 250)
  }
}

// Typing dengan kecepatan variabel seperti human
async function humanType(page: Page, element: import('playwright').Locator, text: string) {
  await element.click()
  await humanDelay(100, 300)

  for (const char of text) {
    // Pause lebih lama setelah punctuation atau space
    const isPunctuation = '.!?,;:'.includes(char)
    const isSpace = char === ' '
    let delay: number

    if (isPunctuation) {
      delay = randomInt(150, 300)
    } else if (isSpace) {
      delay = randomInt(50, 120)
    } else {
      delay = randomInt(30, 90)
    }

    await page.keyboard.type(char, { delay: 0 })
    await sleep(delay)
  }
}

// Random scroll kecil (human sering scroll sedikit)
async function humanScroll(page: Page) {
  if (Math.random() > 0.5) { // 50% chance to scroll
    const scrollAmount = randomInt(-80, 80)
    await page.mouse.wheel(0, scrollAmount)
    await humanDelay(100, 300)
  }
}

// Simulasi random mouse movement di area page (idle behavior)
async function humanIdleMovement(page: Page) {
  if (Math.random() > 0.6) { // 40% chance
    const x = randomInt(200, 1200)
    const y = randomInt(200, 600)
    await humanMouseMove(page, x, y)
    await humanDelay(100, 200)
  }
}

// Global browser instance - reused for all requests
let globalBrowser: Browser | null = null
let browserContext: BrowserContext | null = null

export type GenerationMode = 'text-to-video' | 'frames-to-video'

export type VideoGenerationOptions = {
  prompt: string
  aspectRatio?: 'landscape' | 'portrait'
  mode?: GenerationMode
  outputsCount?: 1 | 2 | 3 | 4
  startFrameBase64?: string
  endFrameBase64?: string
}


export type VideoGenerationResult = {
  success: boolean
  videoUrls?: string[]
  error?: string
}

/**
 * Get or create browser instance
 * Uses persistent profile so login is saved between sessions
 * Supports headless mode via HEADLESS_MODE env variable
 */
async function connectToChrome(): Promise<BrowserContext> {
  // Check if existing browser is still usable
  if (browserContext && globalBrowser?.isConnected()) {
    console.log('[Playwright] Reusing existing browser')
    return browserContext
  }

  // For persistent context, check if context is still valid
  if (browserContext) {
    try {
      // Test if context is still alive
      await browserContext.pages()
      console.log('[Playwright] Reusing existing persistent context')
      return browserContext
    } catch {
      console.log('[Playwright] Existing context was closed, creating new one...')
      browserContext = null
    }
  }

  // Try CDP connection first (connect to user's own Chrome) - skip in headless mode
  if (!HEADLESS_MODE) {
    console.log('[Playwright] Trying to connect to Chrome via CDP on port 9222...')

    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222')
      globalBrowser = browser
      const contexts = browser.contexts()
      if (contexts.length > 0) {
        browserContext = contexts[0]
        console.log('[Playwright] Connected to your Chrome via CDP')
      } else {
        browserContext = await browser.newContext()
        console.log('[Playwright] Created new context in your Chrome')
      }
      return browserContext
    } catch {
      console.log('[Playwright] CDP not available, using persistent Chromium...')
    }
  }

  // Launch persistent Chromium (login will be saved)
  console.log(`[Playwright] Mode: ${HEADLESS_MODE ? 'HEADLESS (new)' : 'VISIBLE'}`)
  console.log(`[Playwright] Profile directory: ${USER_DATA_DIR}`)

  try {
    // Use launchPersistentContext to keep login state
    browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      // Use 'new' headless mode which is more stealth
      headless: HEADLESS_MODE,
      channel: 'chrome', // Use installed Chrome instead of Chromium for better stealth
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-browser-side-navigation',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1920,1080',
        // Remove automation indicators
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        // Headless new mode (Chrome 112+)
        ...(HEADLESS_MODE ? ['--headless=new'] : []),
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      // Additional options for stealth
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      locale: 'en-US',
      timezoneId: 'Asia/Jakarta',
    })

    // Inject comprehensive stealth scripts
    await browserContext.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      })

      // Delete webdriver from navigator prototype
      // @ts-expect-error - accessing __proto__ for stealth mode
      delete navigator.__proto__.webdriver

      // Override plugins with realistic values
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ]
          const pluginArray = Object.create(PluginArray.prototype)
          plugins.forEach((p, i) => {
            const plugin = Object.create(Plugin.prototype)
            Object.defineProperties(plugin, {
              name: { value: p.name },
              filename: { value: p.filename },
              description: { value: p.description },
              length: { value: 0 }
            })
            pluginArray[i] = plugin
          })
          Object.defineProperty(pluginArray, 'length', { value: plugins.length })
          return pluginArray
        }
      })

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'id']
      })

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      })

      // Override vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.'
      })

      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      })

      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      })

      // Mock chrome object with more properties
      const chrome = {
        runtime: {
          connect: () => { },
          sendMessage: () => { },
          onMessage: { addListener: () => { } },
          PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
        },
        loadTimes: () => ({
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2'
        }),
        csi: () => ({
          onloadT: Date.now(),
          pageT: 1000,
          startE: Date.now(),
          tran: 15
        }),
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
        }
      }
      // @ts-expect-error - Chrome runtime object for stealth mode
      window.chrome = chrome

      // Override permissions API
      const originalQuery = (navigator.permissions as { query?: (params: PermissionDescriptor) => Promise<PermissionStatus> })?.query?.bind(navigator.permissions)
      if (originalQuery) {
        (navigator.permissions as { query: (params: PermissionDescriptor) => Promise<PermissionStatus> }).query = (parameters: PermissionDescriptor) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus) :
            originalQuery(parameters)
        )
      }

      // Override WebGL vendor/renderer
      const getParameterProxyHandler = {
        apply: function (target: (pname: number) => unknown, thisArg: WebGLRenderingContext, argumentsList: [number]) {
          const param = argumentsList[0]
          // WebGL fingerprint
          if (param === 37445) return 'Google Inc. (NVIDIA)'
          if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)'
          return target.call(thisArg, param)
        }
      }

      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        if (gl && gl instanceof WebGLRenderingContext) {
          const getParameter = gl.getParameter.bind(gl)
            ; (gl as unknown as Record<string, unknown>).getParameter = new Proxy(getParameter, getParameterProxyHandler as ProxyHandler<typeof getParameter>)
        }
      } catch { /* ignore WebGL errors */ }

      // Override toString to hide proxy
      const originalFunction = Function.prototype.toString
      Function.prototype.toString = function () {
        if (this === Function.prototype.toString) return 'function toString() { [native code] }'
        return originalFunction.call(this)
      }
    })

    if (HEADLESS_MODE) {
      console.log('[Playwright] ⚠️ HEADLESS MODE with stealth enabled')
      console.log('[Playwright] Make sure you have logged in before with HEADLESS_MODE=false!')
    } else {
      console.log('[Playwright] Browser launched - login will be saved for headless mode')
    }

    return browserContext
  } catch (launchError) {
    console.error('[Playwright] Failed to launch browser:', launchError)
    throw new Error(
      'Could not launch Chromium browser.\n' +
      'Make sure Playwright browsers are installed: npx playwright install chromium\n\n' +
      'Error: ' + (launchError instanceof Error ? launchError.message : String(launchError))
    )
  }
}

/**
 * Generate video by automating Google Labs Flow UI using Playwright
 * Supports both text-to-video and frames-to-video modes
 */
export async function generateVideoViaPlaywright(
  options: VideoGenerationOptions,
  onProgress?: (message: string) => void
): Promise<VideoGenerationResult> {
  const {
    prompt,
    aspectRatio = 'landscape',
    mode = 'text-to-video',
    outputsCount = 1,
    startFrameBase64,
    endFrameBase64,
  } = options

  const startTime = Date.now()
  let page: Page | null = null

  const log = (msg: string) => {
    console.log(`[Playwright] ${msg}`)
    onProgress?.(msg)
  }

  try {
    const context = await connectToChrome()

    // Create a new tab
    log('Opening Flow in new tab...')
    page = await context.newPage()

    // Navigate to base Flow URL - this should redirect to a new project
    await page.goto(FLOW_BASE_URL, { waitUntil: 'networkidle' })
    // Human-like wait: random 8-12 seconds instead of fixed 20s
    await humanDelay(8000, 12000)
    await humanIdleMovement(page)

    // Check if we need to create a new project manually
    const currentUrl = page.url()
    log(`Current URL: ${currentUrl}`)

    // If we're on the tool page but not in a project, look for "New project" button
    if (!currentUrl.includes('/project/')) {
      log('Looking for New Project button...')

      // Try to find and click "New project" or similar button
      const newProjectBtn = await page.locator('button, a').filter({
        hasText: /new.*(project|video)|create|start/i
      }).first()

      if (await newProjectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanClick(page, newProjectBtn)
        await humanDelay(1500, 2500)
      }
    }

    // If already on a project, we may want to start fresh
    // Look for a way to create new project from menu
    if (currentUrl.includes('/project/')) {
      log('Already on a project page, creating new project...')

      // Try to find menu or "new" button
      try {
        // Look for menu button (often 3 dots or hamburger)
        const menuBtn = await page.locator('button').filter({
          has: page.locator('i:text("more_vert"), i:text("menu")')
        }).first()

        if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, menuBtn)
          await humanDelay(300, 600)

          // Look for "New project" option in menu
          const newOption = await page.locator('[role="menuitem"], li, button').filter({
            hasText: /new.*project/i
          }).first()

          if (await newOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await humanClick(page, newOption)
            await humanDelay(1500, 2500)
          } else {
            await page.keyboard.press('Escape')
          }
        }

        // Alternative: look for a direct "New" or "+" button in UI
        const directNewBtn = await page.locator('button[aria-label*="new" i], button[aria-label*="create" i], button').filter({
          has: page.locator('i:text("add"), i:text("add_circle")')
        }).first()

        if (await directNewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, directNewBtn)
          await humanDelay(1500, 2500)
        }
      } catch {
        log('Could not find new project option, will use current project')
      }
    }

    // Wait for project page to be ready
    try {
      await page.waitForURL(/labs\.google\/fx\/tools\/flow\/project\//, { timeout: 15000 })
    } catch {
      // If no redirect, try direct navigation again
      log('Retrying navigation to create new project...')
      await page.goto(FLOW_BASE_URL + '?new=' + Date.now(), { waitUntil: 'networkidle' })
      await page.waitForURL(/labs\.google\/fx\/tools\/flow\/project\//, { timeout: 30000 })
    }

    const projectUrl = page.url()
    log(`Project ready: ${projectUrl}`)

    // Wait for page to be ready
    log('Waiting for page to load...')
    await page.waitForSelector('textarea#PINHOLE_TEXT_AREA_ELEMENT_ID', { timeout: 30000 })
    log('Page ready')

    // Switch mode if needed (Frames to Video)
    if (mode === 'frames-to-video') {
      log('Switching to Frames to Video mode...')
      try {
        // Click on the mode dropdown (left side of prompt bar)
        const modeDropdown = await page.locator('button').filter({ hasText: /text to video/i }).first()
        if (await modeDropdown.isVisible({ timeout: 3000 })) {
          await humanClick(page, modeDropdown)
          await humanDelay(400, 700)

          // Select Frames to Video option
          const framesOption = await page.locator('[role="option"], li').filter({ hasText: /frames to video/i }).first()
          if (await framesOption.isVisible({ timeout: 2000 })) {
            await humanClick(page, framesOption)
            await humanDelay(800, 1200)
            log('Switched to Frames to Video mode')

            // IMPORTANT: Configure Settings (aspect ratio) BEFORE uploading frames
            // This ensures the crop modal uses the correct orientation
            log(`Setting aspect ratio to ${aspectRatio} before frame upload...`)
            try {
              const settingsBtn = await page.locator('button').filter({ has: page.locator('i:text("tune")') }).first()
              if (await settingsBtn.isVisible({ timeout: 2000 })) {
                await humanClick(page, settingsBtn)
                await humanDelay(600, 1000)

                const aspectCombo = await page.locator('button[role="combobox"]').filter({
                  hasText: /Aspect Ratio/i
                }).first()
                if (await aspectCombo.isVisible({ timeout: 2000 })) {
                  await humanClick(page, aspectCombo)
                  await humanDelay(300, 500)

                  const aspectTextMap: Record<string, string> = {
                    'landscape': '16:9',
                    'portrait': '9:16'
                  }
                  const targetText = aspectTextMap[aspectRatio] || '16:9'

                  const option = await page.locator('[role="option"]').filter({
                    hasText: new RegExp(targetText)
                  }).first()

                  if (await option.isVisible({ timeout: 1000 })) {
                    await humanClick(page, option)
                    await humanDelay(300, 500)
                    log(`Aspect ratio set to ${aspectRatio} (${targetText}) - crop will use this orientation`)
                  } else {
                    await page.keyboard.press('Escape')
                  }
                }

                // Close settings panel
                await page.keyboard.press('Escape')
                await sleep(300)
              }
            } catch {
              log('Could not configure aspect ratio before upload, continuing...')
            }

            // Helper function to upload a frame
            const uploadFrame = async (base64Data: string, frameIndex: number, frameName: string) => {
              if (!page) return false

              log(`Uploading ${frameName}...`)

              // Extract base64 content and determine file extension
              const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
              if (!matches) {
                log(`Invalid base64 format for ${frameName}`)
                return false
              }

              const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
              const base64Content = matches[2]

              // Save to temp file
              const tempDir = os.tmpdir()
              const tempFile = path.join(tempDir, `veo_frame_${Date.now()}_${frameIndex}.${ext}`)
              fs.writeFileSync(tempFile, Buffer.from(base64Content, 'base64'))
              log(`Saved ${frameName} to temp file`)

              try {
                // Click the Add button for this frame slot
                // IMPORTANT: After first frame upload, the first slot no longer has Add button
                // So for end frame, we need to click the FIRST available Add button (not index 1)
                const addButtons = await page.locator('button').filter({ hasText: 'add' }).all()

                // For end frame (index 1), after start frame is uploaded, there's only 1 Add button left
                // So we need to click index 0 of available buttons, not index 1
                const buttonIndex = frameIndex === 0 ? 0 : 0 // Always click first available Add button

                if (addButtons.length > 0) {
                  await addButtons[buttonIndex].click()
                  await sleep(1000)
                  log(`Clicked Add button for ${frameName} (button ${buttonIndex + 1} of ${addButtons.length})`)

                  // Wait for Asset Library modal to appear
                  // The file input is hidden but we can set files directly on it
                  const fileInput = await page.locator('input[type="file"]').first()
                  await fileInput.setInputFiles(tempFile)
                  log(`File selected for ${frameName}`)
                  await sleep(1500)

                  // IMPORTANT: After file selection, a "Crop your ingredient" modal appears
                  // Use JavaScript evaluate for more reliable DOM interaction
                  const targetOrientation = aspectRatio === 'portrait' ? 'Portrait' : 'Landscape'
                  log(`Setting crop orientation to ${targetOrientation}...`)

                  // Wait for the crop modal to fully appear
                  await sleep(2000)

                  // Use JavaScript to directly find and click the orientation elements
                  const orientationResult = await page.evaluate(async (target: string) => {
                    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

                    // Find the orientation dropdown (button with role="combobox" containing Landscape or Portrait)
                    const buttons = Array.from(document.querySelectorAll('button[role="combobox"]'))
                    const dropdown = buttons.find(btn =>
                      btn.textContent && (btn.textContent.includes('Landscape') || btn.textContent.includes('Portrait'))
                    ) as HTMLElement

                    if (!dropdown) {
                      return { success: false, error: 'Dropdown not found' }
                    }

                    // Check current orientation
                    const currentText = dropdown.textContent || ''
                    if (currentText.toLowerCase().includes(target.toLowerCase())) {
                      return { success: true, message: `Already set to ${target}` }
                    }

                    // Click to open dropdown
                    dropdown.click()
                    await sleep(500)

                    // Find the target option in the opened menu
                    // Look for elements containing exactly the target text
                    const allElements = Array.from(document.querySelectorAll('*'))
                    const option = allElements.find(el => {
                      const text = el.textContent?.trim()
                      const isVisible = (el as HTMLElement).offsetParent !== null
                      const rect = el.getBoundingClientRect()
                      // Must be visible, have exact text, and be a reasonable size
                      return text === target && isVisible && rect.width > 0 && rect.height > 0 && rect.height < 100
                    }) as HTMLElement

                    if (option) {
                      option.click()
                      return { success: true, message: `Clicked ${target} option` }
                    }

                    // Fallback: look for role="option" or li elements
                    const options = Array.from(document.querySelectorAll('[role="option"], li, [role="menuitem"]'))
                    const fallbackOption = options.find(el =>
                      el.textContent?.trim() === target && (el as HTMLElement).offsetParent !== null
                    ) as HTMLElement

                    if (fallbackOption) {
                      fallbackOption.click()
                      return { success: true, message: `Clicked ${target} via fallback` }
                    }

                    // Last resort: use keyboard
                    dropdown.focus()
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
                    await sleep(200)
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

                    return { success: true, message: 'Used keyboard navigation' }
                  }, targetOrientation)

                  log(`Orientation result: ${JSON.stringify(orientationResult)}`)

                  await sleep(500)

                  // Now click "Crop and Save" button
                  const cropBtn = await page.locator('button').filter({ hasText: /Crop and Save/i }).first()
                  if (await cropBtn.isVisible({ timeout: 5000 })) {
                    await cropBtn.click()
                    log(`Clicked Crop and Save for ${frameName}`)
                    await sleep(2000)

                    // After cropping, we return to Asset Library
                    // The newly uploaded image is ALWAYS at the first position (top-left after Upload card)
                    // Use the exact aria-label to find it
                    const assetImage = await page.locator('button[aria-label="A media asset previously uploaded or selected by you"]').first()

                    if (await assetImage.isVisible({ timeout: 3000 })) {
                      await assetImage.click()
                      await sleep(500)
                      log(`Selected ${frameName} from library (newest upload)`)
                    } else {
                      // Fallback: try clicking the first button with an image in the dialog grid
                      // This grid is ordered with newest first
                      const imageButtons = await page.locator('[role="dialog"] button').filter({
                        has: page.locator('img')
                      }).all()
                      // The first button is the "Upload" card, so we take the second one (index 1)
                      if (imageButtons.length > 1) {
                        await imageButtons[1].click()
                        await sleep(500)
                        log(`Selected ${frameName} (grid position 1)`)
                      } else if (imageButtons.length === 1) {
                        // Only one image button, try it
                        await imageButtons[0].click()
                        await sleep(500)
                        log(`Selected ${frameName} (only available)`)
                      } else {
                        log(`No image buttons found for ${frameName}`)
                      }
                    }
                  } else {
                    log(`Crop modal not found for ${frameName}, trying direct selection...`)
                    // Maybe the file was already in the library, try to select
                    await page.keyboard.press('Escape')
                    await sleep(300)
                  }

                  // Wait for modal to close
                  await sleep(500)
                }

                return true
              } finally {
                // Cleanup temp file
                try {
                  fs.unlinkSync(tempFile)
                } catch {
                  // Ignore cleanup errors
                }
              }
            }

            // Upload start frame (index 0)
            if (startFrameBase64) {
              await uploadFrame(startFrameBase64, 0, 'Start Frame')
            }

            // Upload end frame (index 1)
            if (endFrameBase64) {
              await uploadFrame(endFrameBase64, 1, 'End Frame')
            }

            // Make sure all modals are closed
            await page.keyboard.press('Escape')
            await sleep(500)
            log('Frame upload complete')
          }
        }
      } catch (frameError) {
        log(`Frame upload error: ${frameError instanceof Error ? frameError.message : String(frameError)}`)
        log('Continuing without frames...')
      }
    }

    // Open Settings panel for aspect ratio and outputs count
    log(`Configuring settings (aspect: ${aspectRatio}, outputs: ${outputsCount})...`)
    try {
      // Click Settings button (tune icon)
      const settingsBtn = await page.locator('button').filter({ has: page.locator('i:text("tune")') }).first()
      if (await settingsBtn.isVisible()) {
        await humanClick(page, settingsBtn)
        await humanDelay(500, 900)

        // Set aspect ratio using "Aspect Ratio" text in dropdown
        const aspectCombo = await page.locator('button[role="combobox"]').filter({
          hasText: /Aspect Ratio/i
        }).first()
        if (await aspectCombo.isVisible({ timeout: 2000 })) {
          await humanClick(page, aspectCombo)
          await humanDelay(300, 500)

          // Map our values to the dropdown option text
          const aspectTextMap: Record<string, string> = {
            'landscape': '16:9',
            'portrait': '9:16',
            'square': '1:1'
          }
          const targetText = aspectTextMap[aspectRatio] || '16:9'

          // Find the option with matching ratio text
          const option = await page.locator('[role="option"]').filter({
            hasText: new RegExp(targetText)
          }).first()

          if (await option.isVisible({ timeout: 1000 })) {
            await humanClick(page, option)
            await humanDelay(300, 500)
            log(`Aspect ratio set to ${aspectRatio} (${targetText})`)
          } else {
            log(`Aspect ratio option ${targetText} not found`)
            await page.keyboard.press('Escape')
            await humanDelay(150, 300)
          }
        } else {
          log('Aspect Ratio dropdown not found')
        }

        // Set outputs per prompt count using "Outputs per prompt" text
        const outputsCombo = await page.locator('button[role="combobox"]').filter({
          hasText: /Outputs per prompt/i
        }).first()
        if (await outputsCombo.isVisible({ timeout: 2000 })) {
          await humanClick(page, outputsCombo)
          await humanDelay(300, 500)

          const outputOption = await page.locator('[role="option"]').filter({
            hasText: new RegExp(`^${outputsCount}$`)
          }).first()

          if (await outputOption.isVisible({ timeout: 1000 })) {
            await humanClick(page, outputOption)
            await humanDelay(300, 500)
            log(`Outputs per prompt set to ${outputsCount}`)
          } else {
            log(`Could not find option for ${outputsCount} outputs`)
            await page.keyboard.press('Escape')
            await humanDelay(150, 300)
          }
        } else {
          log('Outputs per prompt dropdown not found')
        }

        // Close settings panel
        await page.keyboard.press('Escape')
        await humanDelay(200, 400)
        log('Settings configured')
      } else {
        log('Settings button not visible')
      }
    } catch (settingsError) {
      log(`Settings error: ${settingsError instanceof Error ? settingsError.message : String(settingsError)}`)
      // Try to close any open panel
      await page.keyboard.press('Escape')
      await humanDelay(150, 300)
    }

    // Enter prompt with human-like typing
    log('Entering prompt...')
    const textarea = page.locator('textarea#PINHOLE_TEXT_AREA_ELEMENT_ID')

    // Human scroll and idle before typing
    await humanScroll(page)
    await humanDelay(500, 1000)

    // Clear and type using human-like function
    await textarea.click()
    await humanDelay(200, 400)
    await textarea.fill('') // Clear existing text
    await humanDelay(300, 600)

    // Type prompt with human-like variable delays
    await humanType(page, textarea, prompt)

    // Short natural pause before clicking submit
    await humanIdleMovement(page)
    await humanDelay(800, 1500)

    // Click Create button with human-like mouse movement
    log('Clicking Create button...')
    const createBtn = await page.locator('button').filter({ has: page.locator('i:text("arrow_forward")') }).first()
    await humanClick(page, createBtn)
    log('Generation started, waiting for video...')

    // Poll for video completion (max 5 minutes)
    const maxWaitTime = 300000
    const pollInterval = 8000
    let elapsed = 0
    let videoUrls: string[] = []
    let lastVideoCount = 0
    let stableCount = 0 // How many polls with no new videos
    let retryAttempts = 0
    const maxRetries = 2 // Maximum retry attempts per failed generation

    while (elapsed < maxWaitTime) {
      await sleep(pollInterval)
      elapsed += pollInterval

      const progress = Math.min(90, Math.round((elapsed / maxWaitTime) * 100))
      log(`Generating... (${Math.round(elapsed / 1000)}s elapsed, ${progress}%)`)

      // Check for videos (may be multiple if outputsCount > 1)
      const result = await page.evaluate(() => {
        // Look for videos with storage.googleapis.com URL
        const videos = document.querySelectorAll('video')
        const foundUrls: string[] = []

        for (const video of videos) {
          const src = video.src || video.currentSrc
          if (src && src.includes('storage.googleapis.com/ai-sandbox-videofx/video/')) {
            if (!foundUrls.includes(src)) {
              foundUrls.push(src)
            }
          }
        }

        // Count "Failed Generation" indicators
        let failedCount = 0
        const allElements = document.querySelectorAll('*')
        for (const el of allElements) {
          if (el.textContent?.trim() === 'Failed Generation') {
            failedCount++
          }
        }

        // Return found URLs and failed count
        return {
          videoUrls: foundUrls,
          failedCount,
          totalDone: foundUrls.length + failedCount
        }
      })

      if (result?.videoUrls && result.videoUrls.length > 0) {
        videoUrls = result.videoUrls

        // Log progress
        if (result.failedCount > 0) {
          log(`Found ${videoUrls.length} video(s), ${result.failedCount} failed`)
        } else {
          log(`Found ${videoUrls.length}/${outputsCount} video(s)`)
        }

        // If all outputs are done (success + failed = expected), we're done
        if (result.totalDone >= outputsCount) {
          log(`All ${outputsCount} generations completed (${videoUrls.length} success, ${result.failedCount} failed)`)
          break
        }

        // Check if video count has stabilized (no new videos for 3 polls = 15 seconds)
        if (videoUrls.length === lastVideoCount) {
          stableCount++
          if (stableCount >= 3 && videoUrls.length > 0) {
            log(`Video count stabilized at ${videoUrls.length}, proceeding with available videos`)
            break
          }
        } else {
          stableCount = 0
        }
        lastVideoCount = videoUrls.length
      }

      // RETRY LOGIC: If there are failed generations and we haven't exceeded retry limit
      if (result?.failedCount > 0 && retryAttempts < maxRetries) {
        log(`Attempting to retry ${result.failedCount} failed generation(s)... (attempt ${retryAttempts + 1}/${maxRetries})`)

        // Click retry button for failed generations using JavaScript
        const retryResult = await page.evaluate(async () => {
          const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
          let retriedCount = 0

          // Find all "Failed Generation" text elements
          const allElements = Array.from(document.querySelectorAll('*'))
          const failedElements = allElements.filter(el =>
            el.textContent?.trim() === 'Failed Generation' &&
            (el as HTMLElement).offsetParent !== null
          )

          for (const failedEl of failedElements) {
            // Find the parent container that has the menu button (usually 3 dots or more_vert icon)
            let parent = failedEl.parentElement
            let menuBtn: HTMLElement | null = null

            // Walk up the DOM to find the menu button
            for (let i = 0; i < 10 && parent; i++) {
              const buttons = parent.querySelectorAll('button')
              for (const btn of buttons) {
                // Look for menu button (has more_vert icon or 3 dots)
                if (btn.textContent?.includes('more_vert') ||
                  btn.querySelector('i')?.textContent?.includes('more_vert') ||
                  btn.getAttribute('aria-label')?.toLowerCase().includes('more') ||
                  btn.getAttribute('aria-label')?.toLowerCase().includes('menu')) {
                  menuBtn = btn as HTMLElement
                  break
                }
              }
              if (menuBtn) break
              parent = parent.parentElement
            }

            if (menuBtn) {
              // Click the menu button
              menuBtn.click()
              await sleep(500)

              // Look for "Regenerate" or "Retry" option in the menu
              const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], li, button'))
              const retryOption = menuItems.find(item => {
                const text = item.textContent?.toLowerCase() || ''
                return text.includes('regenerate') || text.includes('retry') || text.includes('try again')
              }) as HTMLElement

              if (retryOption) {
                retryOption.click()
                retriedCount++
                await sleep(500)
              } else {
                // Close menu if no retry option found
                document.body.click()
                await sleep(200)
              }
            }
          }

          return { retriedCount }
        })

        if (retryResult?.retriedCount > 0) {
          log(`Retried ${retryResult.retriedCount} failed generation(s)`)
          retryAttempts++
          stableCount = 0 // Reset stable count to wait for new results
          lastVideoCount = videoUrls.length
        }
      }
    }

    // Return whatever videos we got (even if less than requested)
    if (videoUrls.length === 0) {
      throw new Error('No videos generated - all generations may have failed')
    }

    const duration = Date.now() - startTime
    if (videoUrls.length < outputsCount) {
      log(`Generated ${videoUrls.length}/${outputsCount} video(s) in ${Math.round(duration / 1000)}s (some failed)`)
    } else {
      log(`Generated ${videoUrls.length} video(s) successfully in ${Math.round(duration / 1000)}s`)
    }

    return {
      success: true,
      videoUrls,
    }

  } catch (error) {
    console.error('[Playwright] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    // Always close the page to free resources
    if (page) {
      try {
        await page.close()
      } catch {
        // Ignore errors when closing page
      }
    }
  }
}

/**
 * Check if Chrome is available for CDP connection
 */
export async function checkChromeConnection(): Promise<boolean> {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    await browser.close()
    return true
  } catch {
    return false
  }
}
