import { renderGlyphToCanvas } from './glyphRenderer.js';

/**
 * Inverts image colors (black <-> white).
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} - New canvas with inverted colors
 */
export function invertColors(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const newData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    newData[i] = 255 - data[i];
    newData[i + 1] = 255 - data[i + 1];
    newData[i + 2] = 255 - data[i + 2];
    newData[i + 3] = data[i + 3];
  }
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
  resultCtx.putImageData(new ImageData(newData, canvas.width, canvas.height), 0, 0);
  return resultCanvas;
}

/**
 * Applies pixelate effect: draw to smaller canvas then scale up without smoothing.
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @param {number} blockSize - Pixel block size (1 = no effect, larger = more pixelated)
 * @returns {HTMLCanvasElement} - New canvas with pixelation applied
 */
export function applyPixelate(canvas, blockSize) {
  if (blockSize <= 1) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const smallW = Math.max(1, Math.floor(w / blockSize));
  const smallH = Math.max(1, Math.floor(h / blockSize));

  const small = document.createElement('canvas');
  small.width = smallW;
  small.height = smallH;
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  smallCtx.imageSmoothingEnabled = false;
  smallCtx.drawImage(canvas, 0, 0, w, h, 0, 0, smallW, smallH);

  const result = document.createElement('canvas');
  result.width = w;
  result.height = h;
  const resultCtx = result.getContext('2d', { willReadFrequently: true });
  resultCtx.imageSmoothingEnabled = false;
  resultCtx.drawImage(small, 0, 0, smallW, smallH, 0, 0, w, h);
  return result;
}

/**
 * Applies pixel offset by drawing the canvas onto a new canvas with translation (keeps same size; edges wrap or stay white).
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @param {number} shiftX - X offset in pixels
 * @param {number} shiftY - Y offset in pixels
 * @returns {HTMLCanvasElement} - New canvas with content shifted
 */
export function applyPixelShift(canvas, shiftX, shiftY) {
  if (shiftX === 0 && shiftY === 0) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const result = document.createElement('canvas');
  result.width = w;
  result.height = h;
  const ctx = result.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h, shiftX, shiftY, w, h);
  return result;
}

/**
 * Full pipeline for one glyph: render -> optional shift -> pixelate -> ImageData (black glyph on white for tracer).
 * @param {string} svgPath - SVG path in font units
 * @param {Object} viewBox - { minX, minY, w, h }
 * @param {number} pixelateBlockSize - Block size for pixelation (1 = none)
 * @param {number} shiftX - Pixel X offset before pixelation (0 = none)
 * @param {number} shiftY - Pixel Y offset before pixelation (0 = none)
 * @returns {ImageData} - ImageData ready for vectorizeImageData
 */
export function processGlyphToImageData(svgPath, viewBox, pixelateBlockSize = 1, shiftX = 0, shiftY = 0) {
  let canvas = renderGlyphToCanvas(svgPath, viewBox);
  if (shiftX !== 0 || shiftY !== 0) {
    canvas = applyPixelShift(canvas, shiftX, shiftY);
  }
  if (pixelateBlockSize > 1) {
    canvas = applyPixelate(canvas, pixelateBlockSize);
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}
