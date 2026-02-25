import * as opentype from 'opentype.js';

/**
 * Convert opentype.js Path commands to SVG path data string (font units; Y up).
 * @param {opentype.Path} path - opentype Path object
 * @returns {string} - SVG path d attribute
 */
function pathToSVGPathData(path) {
  if (!path || !path.commands || path.commands.length === 0) return '';
  const parts = [];
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        parts.push(`M ${cmd.x} ${cmd.y}`);
        break;
      case 'L':
        parts.push(`L ${cmd.x} ${cmd.y}`);
        break;
      case 'C':
        parts.push(`C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`);
        break;
      case 'Q':
        parts.push(`Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`);
        break;
      case 'Z':
        parts.push('Z');
        break;
      default:
        break;
    }
  }
  return parts.join(' ');
}

/**
 * Parse a TTF file and extract font + list of glyph records with metrics.
 * @param {ArrayBuffer} arrayBuffer - TTF file content
 * @returns {Promise<{ font: opentype.Font, glyphs: Array<{ unicode: number, path: string, advanceWidth: number, leftSideBearing: number }>, unitsPerEm: number, ascender: number, descender: number, familyName: string }>}
 */
export function loadTTF(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const font = opentype.parse(arrayBuffer);
      const unitsPerEm = font.unitsPerEm || 1000;
      const ascender = font.ascender != null ? font.ascender : 800;
      const descender = font.descender != null ? font.descender : -200;
      const familyName = (font.names && font.names.fontFamily && font.names.fontFamily.en) || font.getEnglishName('fontFamily') || 'Pixelated';

      const glyphs = [];
      for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = typeof font.glyphs.get === 'function' ? font.glyphs.get(i) : font.glyphs.glyphs[i];
        if (!glyph) continue;
        if (glyph.name === '.notdef') continue;
        if (glyph.unicode === undefined) continue;
        const path = glyph.path;
        if (!path || !path.commands || path.commands.length === 0) continue;

        const pathString = pathToSVGPathData(path);
        if (!pathString.trim()) continue;

        glyphs.push({
          unicode: glyph.unicode,
          path: pathString,
          advanceWidth: glyph.advanceWidth,
          leftSideBearing: glyph.leftSideBearing,
        });
      }

      resolve({
        font,
        glyphs,
        unitsPerEm,
        ascender,
        descender,
        familyName,
      });
    } catch (err) {
      reject(err);
    }
  });
}
