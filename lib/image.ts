/**
 * Client-side image optimization helpers.
 *
 * These run entirely in the browser using Canvas + createImageBitmap,
 * so the server only ever receives a small, pre-shrunk data URL.
 *
 * Why this matters:
 *  - Supabase Free tier caps the DB at 500MB and localStorage at ~5MB.
 *  - A raw phone photo is 3-8MB. After optimizeImage() it is 15-150KB.
 *  - We also normalise EXIF orientation (phone photos are often rotated)
 *    and prefer WebP when the browser supports it (~30% smaller than JPEG).
 */

export interface OptimizeOptions {
  /** Target square / max dimension in pixels. Image is never upscaled. */
  maxSize: number
  /** Hard cap on the resulting data URL byte length. Quality is stepped down until it fits. */
  maxBytes?: number
  /** Starting encode quality (0-1). Default 0.82. */
  quality?: number
  /** Centre-crop to a square. Default false (keep aspect ratio, just downscale). */
  square?: boolean
  /** Output format. 'auto' = WebP if supported, else JPEG. Default 'auto'. */
  format?: 'auto' | 'webp' | 'jpeg'
}

export interface OptimizeResult {
  /** Base64 data URL ready to store / display. */
  dataUrl: string
  /** Byte length of the data URL (approx on-wire size). */
  bytes: number
  /** Final pixel width. */
  width: number
  /** Final pixel height. */
  height: number
  /** Format actually used ('image/webp' | 'image/jpeg'). */
  mime: string
}

const supportsWebP = (() => {
  if (typeof document === 'undefined') return false
  const c = document.createElement('canvas')
  c.width = c.height = 1
  return c.toDataURL('image/webp').startsWith('data:image/webp')
})()

/** Load a File/Blob into an ImageBitmap (with EXIF orientation) or fallback Image. */
async function decodeBitmap(file: Blob): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  // createImageBitmap supports imageOrientation: 'from-image' which auto-rotates EXIF.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
      return { bitmap: bmp, width: bmp.width, height: bmp.height }
    } catch {
      // fall through to <img> path
    }
  }
  // Fallback for very old browsers (Safari < 14, etc.)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That file is not a valid image'))
      i.src = url
    })
    return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    // Revoke after decode; for Image the bitmap is the element itself so revoke is safe here.
    URL.revokeObjectURL(url)
  }
}

function drawToCanvas(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  opts: Required<Omit<OptimizeOptions, 'maxBytes' | 'format'>> & { format: 'image/webp' | 'image/jpeg' }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  let dstW: number
  let dstH: number

  if (opts.square) {
    const side = Math.min(srcW, srcH)
    dstW = dstH = Math.min(opts.maxSize, side)
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')!
    // Centre-crop source, draw scaled into square canvas
    const sx = (srcW - side) / 2
    const sy = (srcH - side) / 2
    ctx.drawImage(src, sx, sy, side, side, 0, 0, dstW, dstH)
  } else {
    // Keep aspect ratio, downscale so the longest side = maxSize (never upscale)
    const scale = Math.min(1, opts.maxSize / Math.max(srcW, srcH))
    dstW = Math.round(srcW * scale)
    dstH = Math.round(srcH * scale)
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(src, 0, 0, srcW, srcH, 0, 0, dstW, dstH)
  }
  return canvas
}

/**
 * Optimise an image File in the browser: downscale, centre-crop (optional),
 * EXIF-rotate, and re-encode as WebP/JPEG at a quality that fits `maxBytes`.
 */
export async function optimizeImage(file: File, opts: OptimizeOptions): Promise<OptimizeResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, or WebP)')
  }
  const maxSize = opts.maxSize
  const maxBytes = opts.maxBytes ?? 120 * 1024
  const startQuality = opts.quality ?? 0.82
  const square = opts.square ?? false
  const fmt: 'image/webp' | 'image/jpeg' =
    opts.format === 'jpeg' ? 'image/jpeg' : opts.format === 'webp' ? 'image/webp' : supportsWebP ? 'image/webp' : 'image/jpeg'

  const { bitmap, width, height } = await decodeBitmap(file)
  if (!width || !height) throw new Error('That image appears to be empty')

  const canvas = drawToCanvas(bitmap, width, height, { maxSize, quality: startQuality, square, format: fmt })

  // Step quality down until we fit maxBytes. WebP/JPEG at 0.45 is still fine for small UI images.
  let quality = startQuality
  let dataUrl = canvas.toDataURL(fmt, quality)
  let bytes = dataUrl.length

  // If even the smallest reasonable quality doesn't fit, accept the last result.
  while (bytes > maxBytes && quality > 0.45) {
    quality = Math.max(0.45, quality - 0.1)
    dataUrl = canvas.toDataURL(fmt, quality)
    bytes = dataUrl.length
  }

  // Release bitmap memory if it's an ImageBitmap (not an HTMLImageElement)
  if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
    ;(bitmap as ImageBitmap).close()
  }

  return {
    dataUrl,
    bytes,
    width: canvas.width,
    height: canvas.height,
    mime: fmt,
  }
}

/** Human-readable byte size, e.g. "18 KB" or "3.2 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 100 * 1024 ? 0 : 1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
