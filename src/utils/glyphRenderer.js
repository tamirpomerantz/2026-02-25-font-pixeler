/**
 * Renders a glyph (SVG path in font units, Y-up) to a canvas.
 * Uses viewBox = em square; flips Y so font coordinates map correctly to canvas (Y-down).
 * @param {string} svgPath - SVG path d string in font units (Y up)
 * @param {Object} viewBox - { minX, minY, w, h } in font units
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @returns {HTMLCanvasElement} - Canvas with black glyph on white background (for tracer)
 */
export function renderGlyphToCanvas(svgPath, viewBox, width = 1000, height = 1000) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const scaleX = width / viewBox.w;
  const scaleY = height / viewBox.h;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = viewBox.w * scale;
  const scaledH = viewBox.h * scale;
  const offsetX = (width - scaledW) / 2;
  const offsetY = (height - scaledH) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, -scale);
  ctx.translate(-viewBox.minX, -viewBox.minY - viewBox.h);

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = 'none';
  try {
    const path2d = new Path2D(svgPath);
    ctx.fill(path2d);
  } catch (e) {
    console.warn('[glyphRenderer] Path2D error:', e);
  }
  ctx.restore();

  return canvas;
}
