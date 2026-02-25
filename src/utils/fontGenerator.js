import * as opentype from 'opentype.js';

function getPathBoundingBox(svgPath) {
  const commands = svgPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  if (commands.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let currentX = 0, currentY = 0;
  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    switch (type) {
      case 'M': case 'L':
        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            currentX = coords[i]; currentY = coords[i + 1];
            minX = Math.min(minX, currentX); minY = Math.min(minY, currentY);
            maxX = Math.max(maxX, currentX); maxY = Math.max(maxY, currentY);
          }
        }
        break;
      case 'm': case 'l':
        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            currentX += coords[i]; currentY += coords[i + 1];
            minX = Math.min(minX, currentX); minY = Math.min(minY, currentY);
            maxX = Math.max(maxX, currentX); maxY = Math.max(maxY, currentY);
          }
        }
        break;
      case 'C':
        for (let i = 0; i < coords.length; i += 6) {
          if (i + 5 < coords.length) {
            minX = Math.min(minX, coords[i], coords[i + 2], coords[i + 4]);
            minY = Math.min(minY, coords[i + 1], coords[i + 3], coords[i + 5]);
            maxX = Math.max(maxX, coords[i], coords[i + 2], coords[i + 4]);
            maxY = Math.max(maxY, coords[i + 1], coords[i + 3], coords[i + 5]);
            currentX = coords[i + 4]; currentY = coords[i + 5];
          }
        }
        break;
      case 'c':
        for (let i = 0; i < coords.length; i += 6) {
          if (i + 5 < coords.length) {
            currentX += coords[i + 4]; currentY += coords[i + 5];
            minX = Math.min(minX, currentX + coords[i], currentX + coords[i + 2], currentX);
            minY = Math.min(minY, currentY + coords[i + 1], currentY + coords[i + 3], currentY);
            maxX = Math.max(maxX, currentX + coords[i], currentX + coords[i + 2], currentX);
            maxY = Math.max(maxY, currentY + coords[i + 1], currentY + coords[i + 3], currentY);
          }
        }
        break;
      default:
        break;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

function filterBackgroundPaths(svgPaths, viewBox) {
  const tolerance = 5;
  const filtered = [];
  for (const svgPath of svgPaths) {
    if (!svgPath || !svgPath.trim()) continue;
    const bbox = getPathBoundingBox(svgPath);
    if (!bbox) { filtered.push(svgPath); continue; }
    const pathArea = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    const viewBoxArea = viewBox.w * viewBox.h;
    const coversEntireViewBox = (
      Math.abs(bbox.minX - viewBox.minX) <= tolerance &&
      Math.abs(bbox.minY - viewBox.minY) <= tolerance &&
      Math.abs(bbox.maxX - (viewBox.minX + viewBox.w)) <= tolerance &&
      Math.abs(bbox.maxY - (viewBox.minY + viewBox.h)) <= tolerance
    );
    const isNearEdges = (
      bbox.minX <= viewBox.minX + tolerance &&
      bbox.minY <= viewBox.minY + tolerance &&
      bbox.maxX >= (viewBox.minX + viewBox.w) - tolerance &&
      bbox.maxY >= (viewBox.minY + viewBox.h) - tolerance
    );
    const coverageRatio = pathArea / viewBoxArea;
    if (!coversEntireViewBox && !isNearEdges && coverageRatio < 0.9) filtered.push(svgPath);
  }
  return filtered.length > 0 ? filtered : svgPaths;
}

function translatePath(path, dx) {
  if (!path || !path.commands) return path;
  for (const cmd of path.commands) {
    if (cmd.x !== undefined) cmd.x += dx;
    if (cmd.x1 !== undefined) cmd.x1 += dx;
    if (cmd.x2 !== undefined) cmd.x2 += dx;
  }
  return path;
}

function combineSVGPaths(svgPaths, fontAscender, svgAscender) {
  const combinedPath = new opentype.Path();
  const transformYCoord = (y) => fontAscender - (y - svgAscender);

  for (const svgPath of svgPaths) {
    if (!svgPath || !svgPath.trim()) continue;
    const commands = svgPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    if (commands.length === 0) continue;

    let currentX = 0, currentY = 0, startX = 0, startY = 0, isFirstInContour = true;

    for (const cmd of commands) {
      const type = cmd[0];
      const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      switch (type) {
        case 'M':
          if (coords.length >= 2) {
            if (!isFirstInContour) combinedPath.close();
            currentX = coords[0];
            currentY = transformYCoord(coords[1]);
            startX = currentX; startY = currentY;
            combinedPath.moveTo(currentX, currentY);
            isFirstInContour = false;
          }
          break;
        case 'm':
          if (coords.length >= 2) {
            if (!isFirstInContour) combinedPath.close();
            currentX += coords[0];
            const currentSVGY = fontAscender - currentY + svgAscender;
            currentY = transformYCoord(currentSVGY + coords[1]);
            startX = currentX; startY = currentY;
            combinedPath.moveTo(currentX, currentY);
            isFirstInContour = false;
          }
          break;
        case 'L':
          for (let i = 0; i < coords.length; i += 2) {
            if (i + 1 < coords.length) {
              currentX = coords[i];
              currentY = transformYCoord(coords[i + 1]);
              combinedPath.lineTo(currentX, currentY);
            }
          }
          break;
        case 'l':
          for (let i = 0; i < coords.length; i += 2) {
            if (i + 1 < coords.length) {
              currentX += coords[i];
              const currentSVGY = fontAscender - currentY + svgAscender;
              currentY = transformYCoord(currentSVGY + coords[i + 1]);
              combinedPath.lineTo(currentX, currentY);
            }
          }
          break;
        case 'C':
          for (let i = 0; i < coords.length; i += 6) {
            if (i + 5 < coords.length) {
              combinedPath.curveTo(
                { x: coords[i], y: transformYCoord(coords[i + 1]) },
                { x: coords[i + 2], y: transformYCoord(coords[i + 3]) },
                { x: coords[i + 4], y: transformYCoord(coords[i + 5]) }
              );
              currentX = coords[i + 4];
              currentY = transformYCoord(coords[i + 5]);
            }
          }
          break;
        case 'c':
          for (let i = 0; i < coords.length; i += 6) {
            if (i + 5 < coords.length) {
              const currentSVGY = fontAscender - currentY + svgAscender;
              const cp1x = currentX + coords[i];
              const cp1y = transformYCoord(currentSVGY + coords[i + 1]);
              const cp2x = currentX + coords[i + 2];
              const cp2y = transformYCoord(currentSVGY + coords[i + 3]);
              currentX += coords[i + 4];
              currentY = transformYCoord(currentSVGY + coords[i + 5]);
              combinedPath.curveTo(
                { x: cp1x, y: cp1y },
                { x: cp2x, y: cp2y },
                { x: currentX, y: currentY }
              );
            }
          }
          break;
        case 'Z':
        case 'z':
          combinedPath.close();
          currentX = startX;
          currentY = startY;
          isFirstInContour = true;
          break;
        default:
          break;
      }
    }
  }
  return combinedPath;
}

/**
 * Create a TTF font from vectorized glyphs using source font metrics (no scaling).
 * @param {Array<{ unicode: number, svgString: string, advanceWidth: number, leftSideBearing: number }>} glyphsData
 * @param {Object} options - { unitsPerEm, ascender, descender, familyName }
 * @returns {opentype.Font}
 */
export function createFont(glyphsData, options = {}) {
  const {
    unitsPerEm = 1000,
    ascender = 800,
    descender = -200,
    familyName = 'Pixelated'
  } = options;

  const viewBoxForFilter = { minX: 0, minY: descender, w: unitsPerEm, h: ascender - descender };
  const svgAscender = descender;
  const fontAscender = ascender;

  const glyphs = [];

  for (const entry of glyphsData) {
    const { unicode, svgString, advanceWidth, leftSideBearing } = entry;
    if (!svgString || svgString.trim() === '') continue;

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    const pathElements = svgElement.querySelectorAll('path');

    const pathsWithColors = Array.from(pathElements).map((path) => ({
      d: path.getAttribute('d') || '',
      fill: (path.getAttribute('fill') || '').toLowerCase().trim(),
      stroke: (path.getAttribute('stroke') || '').toLowerCase().trim()
    }));

    let svgPaths = pathsWithColors
      .filter((p) => {
        if (!p.d || !p.d.trim()) return false;
        const isWhite = p.fill === '#fff' || p.fill === '#ffffff' || p.fill === 'white' ||
          p.fill.startsWith('rgb(255') || p.fill.startsWith('rgba(255');
        const isBlack = p.fill === '#000' || p.fill === '#000000' || p.fill === 'black' ||
          p.fill.startsWith('rgb(0') || p.fill.startsWith('rgba(0') || p.stroke === '#000' || p.stroke === 'black';
        return isBlack && !isWhite;
      })
      .map((p) => p.d);

    if (svgPaths.length === 0) continue;

    svgPaths = filterBackgroundPaths(svgPaths, viewBoxForFilter);
    if (svgPaths.length === 0) continue;

    const path = combineSVGPaths(svgPaths, fontAscender, svgAscender);
    if (!path.commands || path.commands.length === 0) continue;

    let bbox;
    try {
      bbox = path.getBoundingBox();
    } catch (_) {
      bbox = { x1: 0, y1: descender, x2: unitsPerEm, y2: ascender };
    }

    translatePath(path, leftSideBearing - bbox.x1);

    const unicodeHex = unicode.toString(16).toUpperCase().padStart(4, '0');
    const glyphName = `uni${unicodeHex}`;

    const glyph = new opentype.Glyph({
      name: glyphName,
      unicode: unicode,
      advanceWidth: advanceWidth,
      leftSideBearing: leftSideBearing,
      path: path
    });
    glyphs.push(glyph);
  }

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: undefined,
    advanceWidth: 600,
    path: new opentype.Path()
  });
  glyphs.unshift(notdefGlyph);

  const font = new opentype.Font({
    familyName: familyName,
    styleName: 'Regular',
    unitsPerEm,
    ascender,
    descender,
    glyphs
  });

  return font;
}

export async function generateFontFile(font) {
  return new Promise((resolve, reject) => {
    try {
      const fontArrayBuffer = font.toArrayBuffer();
      resolve(new Blob([fontArrayBuffer], { type: 'font/ttf' }));
    } catch (error) {
      reject(error);
    }
  });
}

export function downloadFont(fontBlob, filename = 'pixelated-font.ttf') {
  const url = URL.createObjectURL(fontBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
