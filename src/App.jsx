import { useState, useCallback, useEffect, useRef } from 'react'
import { loadTTF } from './utils/ttfLoader'
import { processGlyphToImageData } from './utils/canvasProcessor'
import { vectorizeImageData } from './utils/vectorizer'
import { createFont, generateFontFile, downloadFont } from './utils/fontGenerator'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'

function pickRandomIndices(length, count) {
  const indices = []
  while (indices.length < count) {
    const i = Math.floor(Math.random() * length)
    if (!indices.includes(i)) indices.push(i)
  }
  return indices
}

function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function imageDataToDataUrl(imageData, size = 64) {
  const temp = document.createElement('canvas')
  temp.width = imageData.width
  temp.height = imageData.height
  temp.getContext('2d').putImageData(imageData, 0, 0)
  const small = document.createElement('canvas')
  small.width = size
  small.height = size
  const ctx = small.getContext('2d')
  ctx.drawImage(temp, 0, 0, imageData.width, imageData.height, 0, 0, size, size)
  return small.toDataURL('image/png')
}

async function runPipelineForGlyphIndices(fontData, indices, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius) {
  const { unitsPerEm, ascender, descender, familyName } = fontData
  const viewBox = {
    minX: 0,
    minY: descender,
    w: unitsPerEm,
    h: ascender - descender,
  }
  const glyphsData = []
  for (let i = 0; i < indices.length; i++) {
    const g = fontData.glyphs[indices[i]]
    const imageData = processGlyphToImageData(g.path, viewBox, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius)
    const svgString = vectorizeImageData(imageData, viewBox, 0)
    if (svgString) {
      glyphsData.push({
        unicode: g.unicode,
        svgString,
        advanceWidth: g.advanceWidth,
        leftSideBearing: g.leftSideBearing,
      })
    }
  }
  const font = createFont(glyphsData, {
    unitsPerEm,
    ascender,
    descender,
    familyName: familyName + ' Pixelated',
  })
  const blob = await generateFontFile(font)
  const previewText = indices.map((idx) => String.fromCodePoint(fontData.glyphs[idx].unicode)).join(' ')
  return { blob, previewText }
}

const INTERVAL_MS = 10_000
const TICK_MS = 100

function App() {
  const [fontData, setFontData] = useState(null)
  const [pixelateBlockSize, setPixelateBlockSize] = useState(8)
  const [pixelRatio, setPixelRatio] = useState(1)
  const [blurRadius, setBlurRadius] = useState(0)
  const [shiftX, setShiftX] = useState(0)
  const [shiftY, setShiftY] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [fontBlob, setFontBlob] = useState(null)
  const [error, setError] = useState(null)
  const [previewGlyphIndices, setPreviewGlyphIndices] = useState(null)
  const [previewFontBlob, setPreviewFontBlob] = useState(null)
  const [previewText, setPreviewText] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [generationGlyphPreviews, setGenerationGlyphPreviews] = useState([])
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 })
  const previewTimeoutRef = useRef(null)

  const fileInputRef = useRef(null)

  const handleFileChange = useCallback(async (e) => {
    const file = e.target?.files?.[0]
    if (!file) return
    setError(null)
    setFontBlob(null)
    setPreviewFontBlob(null)
    setPreviewText('')
    setProgressPercent(0)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const data = await loadTTF(arrayBuffer)
      setFontData(data)
      if (data.glyphs.length >= 4) {
        setPreviewGlyphIndices(pickRandomIndices(data.glyphs.length, 4))
      } else {
        setPreviewGlyphIndices(null)
      }
    } catch (err) {
      setError(err.message || 'Failed to load font')
      setFontData(null)
      setPreviewGlyphIndices(null)
    }
  }, [])

  useEffect(() => {
    if (!fontData || !previewGlyphIndices || previewGlyphIndices.length !== 4) {
      setPreviewFontBlob(null)
      setPreviewText('')
      return
    }
    const run = () => {
      runPipelineForGlyphIndices(fontData, previewGlyphIndices, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius)
        .then(({ blob, previewText: text }) => {
          setPreviewFontBlob(blob)
          setPreviewText(text)
        })
        .catch((err) => console.error('[Font Pixeler] Preview failed:', err))
    }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(run, 150)
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    }
  }, [fontData, previewGlyphIndices, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius])

  useEffect(() => {
    if (!fontData || fontData.glyphs.length < 4) return
    setProgressPercent(0)
    const id = setInterval(() => {
      setProgressPercent((p) => {
        const next = p + (TICK_MS / INTERVAL_MS) * 100
        if (next >= 100) {
          setPreviewGlyphIndices((prev) =>
            prev && prev.length === 4 ? pickRandomIndices(fontData.glyphs.length, 4) : prev
          )
          return 0
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [fontData, previewGlyphIndices])


  const handleGenerateAndDownload = useCallback(async () => {
    if (!fontData || !fontData.glyphs.length) {
      setError('Upload a TTF font first')
      return
    }
    setError(null)
    setFontBlob(null)
    setProcessing(true)
    const total = fontData.glyphs.length
    setGenerationProgress({ current: 0, total })
    setGenerationGlyphPreviews([])
    try {
      const { unitsPerEm, ascender, descender, familyName } = fontData
      const viewBox = {
        minX: 0,
        minY: descender,
        w: unitsPerEm,
        h: ascender - descender,
      }
      const glyphsData = []
      for (let i = 0; i < total; i++) {
        const g = fontData.glyphs[i]
        const imageData = processGlyphToImageData(g.path, viewBox, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius)
        const dataUrl = imageDataToDataUrl(imageData, 80)
        setGenerationGlyphPreviews((prev) => [...prev, { unicode: g.unicode, dataUrl }])
        setGenerationProgress({ current: i + 1, total })
        await yieldToMain()
        const svgString = vectorizeImageData(imageData, viewBox, 0)
        if (svgString) {
          glyphsData.push({
            unicode: g.unicode,
            svgString,
            advanceWidth: g.advanceWidth,
            leftSideBearing: g.leftSideBearing,
          })
        }
      }
      const font = createFont(glyphsData, {
        unitsPerEm,
        ascender,
        descender,
        familyName: familyName + ' Pixelated',
      })
      const blob = await generateFontFile(font)
      setFontBlob(blob)
      downloadFont(blob, 'pixelated-font.ttf')
    } catch (err) {
      setError(err.message || 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }, [fontData, pixelateBlockSize, shiftX, shiftY, pixelRatio, blurRadius])

  const [previewFontUrl, setPreviewFontUrl] = useState(null)
  useEffect(() => {
    if (previewFontBlob) {
      const url = URL.createObjectURL(previewFontBlob)
      setPreviewFontUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewFontUrl(null)
  }, [previewFontBlob])

  return (
    <div className="flex h-dvh w-full flex-col bg-[var(--color-background)] font-sans">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,font/ttf"
            onChange={handleFileChange}
            className="hidden"
          />
          {!fontData && (
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={processing}>
              Upload font
            </Button>
          )}
          {fontData && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">Size</span>
                <Slider
                  value={[pixelateBlockSize]}
                  onValueChange={([v]) => setPixelateBlockSize(v)}
                  min={1}
                  max={40}
                  step={1}
                  className="w-24"
                />
                <span className="w-6 text-right text-xs text-[var(--color-muted-foreground)]">{pixelateBlockSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">Ratio</span>
                <Slider
                  value={[pixelRatio]}
                  onValueChange={([v]) => setPixelRatio(v)}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-24"
                />
                <span className="w-8 text-right text-xs text-[var(--color-muted-foreground)]">{pixelRatio}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">Blur</span>
                <Slider
                  value={[blurRadius]}
                  onValueChange={([v]) => setBlurRadius(v)}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-24"
                />
                <span className="w-8 text-right text-xs text-[var(--color-muted-foreground)]">{blurRadius}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">X</span>
                <Slider
                  value={[shiftX]}
                  onValueChange={([v]) => setShiftX(v)}
                  min={-50}
                  max={50}
                  step={1}
                  className="w-24"
                />
                <span className="w-8 text-right text-xs text-[var(--color-muted-foreground)]">{shiftX}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">Y</span>
                <Slider
                  value={[shiftY]}
                  onValueChange={([v]) => setShiftY(v)}
                  min={-50}
                  max={50}
                  step={1}
                  className="w-24"
                />
                <span className="w-8 text-right text-xs text-[var(--color-muted-foreground)]">{shiftY}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {fontData && (
            <Button
              size="sm"
              onClick={handleGenerateAndDownload}
              disabled={processing}
            >
              {processing ? 'Generating…' : 'Generate full font and download'}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {processing ? (
          <>
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1">
                {generationGlyphPreviews.map(({ unicode, dataUrl }, idx) => (
                  <div
                    key={`${unicode}-${idx}`}
                    className="flex flex-col items-center justify-center rounded bg-[var(--color-border)] p-1"
                  >
                    <img
                      src={dataUrl}
                      alt=""
                      className="h-16 w-16 object-contain mix-blend-multiply"
                      width={64}
                      height={64}
                    />
                    <span className="mt-0.5 truncate text-[10px] text-[var(--color-muted-foreground)] max-w-full">
                      {String.fromCodePoint(unicode)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 px-4 pb-4 pt-2">
              <p className="mb-1 text-center text-xs text-[var(--color-muted-foreground)]">
                {generationProgress.current} / {generationProgress.total} glyphs
              </p>
              <Progress
                value={generationProgress.total ? (generationProgress.current / generationProgress.total) * 100 : 0}
                className="h-2 w-full rounded-full"
              />
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4">
            {previewFontBlob && previewText && previewFontUrl ? (
              <div
                className="flex items-center justify-center tracking-tight text-[var(--color-foreground)]"
                style={{
                  fontFamily: "'PixelatedPreview', var(--font-sans)",
                  fontSize: 'min(22vw, 28dvh, 400px)',
                  lineHeight: 1.1,
                }}
              >
                {previewText}
                <style>
                  {`@font-face {
                    font-family: 'PixelatedPreview';
                    src: url(${previewFontUrl}) format('truetype');
                  }`}
                </style>
              </div>
            ) : fontData ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Generating preview…</p>
            ) : (
              <p
                className="text-[var(--color-muted-foreground)]"
                style={{ fontFamily: "'PixelatedFont', var(--font-sans)", fontSize: 'clamp(1.5rem, 8vw, 4rem)' }}
              >
                Upload a TTF font to start
              </p>
            )}
          </div>
        )}
      </div>

      {fontData && fontData.glyphs.length >= 4 && !processing && (
        <div className="shrink-0 px-4 pb-4">
          <Progress value={progressPercent} className="h-1.5 w-full rounded-full" />
        </div>
      )}
    </div>
  )
}

export default App
