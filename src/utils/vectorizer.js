import * as ImageTracerModule from 'imagetracerjs';
const ImageTracer = ImageTracerModule.default || ImageTracerModule;

function translateSVGPath(svgPath, dx, dy) {
  return svgPath.replace(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g, (match, cmd, coords) => {
    if (cmd === 'Z' || cmd === 'z' || cmd === 'H' || cmd === 'h' || cmd === 'V' || cmd === 'v') {
      if (cmd === 'H') {
        const numbers = coords.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        return 'H ' + numbers.map(n => n + dx).join(' ');
      }
      if (cmd === 'V') {
        const numbers = coords.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        return 'V ' + numbers.map(n => n + dy).join(' ');
      }
      return match;
    }
    const numbers = coords.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    if (numbers.length === 0) return match;
    const isAbsolute = cmd === cmd.toUpperCase();
    if (!isAbsolute) return match;
    const translated = [];
    switch (cmd) {
      case 'M': case 'L': case 'T':
        for (let i = 0; i < numbers.length; i += 2) {
          if (i + 1 < numbers.length) translated.push(numbers[i] + dx, numbers[i + 1] + dy);
        }
        break;
      case 'C': case 'S':
        for (let i = 0; i < numbers.length; i += 6) {
          if (i + 5 < numbers.length) {
            translated.push(
              numbers[i] + dx, numbers[i + 1] + dy,
              numbers[i + 2] + dx, numbers[i + 3] + dy,
              numbers[i + 4] + dx, numbers[i + 5] + dy
            );
          }
        }
        break;
      case 'Q':
        for (let i = 0; i < numbers.length; i += 4) {
          if (i + 3 < numbers.length) {
            translated.push(
              numbers[i] + dx, numbers[i + 1] + dy,
              numbers[i + 2] + dx, numbers[i + 3] + dy
            );
          }
        }
        break;
      case 'A':
        for (let i = 0; i < numbers.length; i += 7) {
          if (i + 6 < numbers.length) {
            translated.push(
              numbers[i], numbers[i + 1],
              numbers[i + 2], numbers[i + 3], numbers[i + 4],
              numbers[i + 5] + dx, numbers[i + 6] + dy
            );
          }
        }
        break;
      default:
        return match;
    }
    return cmd + ' ' + translated.join(' ');
  });
}

function scaleSVGPath(svgPath, scaleX, scaleY) {
  return svgPath.replace(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g, (match, cmd, coords) => {
    if (cmd === 'Z' || cmd === 'z') return match;
    const numbers = coords.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const scaled = [];
    switch (cmd) {
      case 'M': case 'L': case 'T':
        for (let i = 0; i < numbers.length; i += 2) {
          if (i + 1 < numbers.length) scaled.push(numbers[i] * scaleX, numbers[i + 1] * scaleY);
        }
        break;
      case 'm': case 'l': case 't': return match;
      case 'H': scaled.push(...numbers.map(n => n * scaleX)); break;
      case 'h': return match;
      case 'V': scaled.push(...numbers.map(n => n * scaleY)); break;
      case 'v': return match;
      case 'C': case 'S':
        for (let i = 0; i < numbers.length; i += 6) {
          if (i + 5 < numbers.length) {
            scaled.push(
              numbers[i] * scaleX, numbers[i + 1] * scaleY,
              numbers[i + 2] * scaleX, numbers[i + 3] * scaleY,
              numbers[i + 4] * scaleX, numbers[i + 5] * scaleY
            );
          }
        }
        break;
      case 'c': case 's': return match;
      case 'Q':
        for (let i = 0; i < numbers.length; i += 4) {
          if (i + 3 < numbers.length) {
            scaled.push(
              numbers[i] * scaleX, numbers[i + 1] * scaleY,
              numbers[i + 2] * scaleX, numbers[i + 3] * scaleY
            );
          }
        }
        break;
      case 'q': return match;
      case 'A':
        for (let i = 0; i < numbers.length; i += 7) {
          if (i + 6 < numbers.length) {
            scaled.push(
              numbers[i] * scaleX, numbers[i + 1] * scaleY,
              numbers[i + 2], numbers[i + 3], numbers[i + 4],
              numbers[i + 5] * scaleX, numbers[i + 6] * scaleY
            );
          }
        }
        break;
      case 'a': return match;
      default: return match;
    }
    return cmd + ' ' + scaled.join(' ');
  });
}

function simplifySVGPath(pathData, tolerance = 1.0) {
  if (!pathData || pathData.trim() === '') return pathData;
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  if (commands.length === 0) return pathData;
  const points = [];
  let currentX = 0, currentY = 0, startX = 0, startY = 0, isClosed = false;
  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    switch (type) {
      case 'M':
        if (coords.length >= 2) {
          currentX = coords[0]; currentY = coords[1];
          startX = currentX; startY = currentY;
          points.push({ x: currentX, y: currentY, isMove: true });
        }
        break;
      case 'm':
        if (coords.length >= 2) {
          currentX += coords[0]; currentY += coords[1];
          startX = currentX; startY = currentY;
          points.push({ x: currentX, y: currentY, isMove: true });
        }
        break;
      case 'L':
        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            currentX = coords[i]; currentY = coords[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
      case 'l':
        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            currentX += coords[i]; currentY += coords[i + 1];
            points.push({ x: currentX, y: currentY });
          }
        }
        break;
      case 'H':
        for (let i = 0; i < coords.length; i++) {
          currentX = coords[i];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'h':
        for (let i = 0; i < coords.length; i++) {
          currentX += coords[i];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'V':
        for (let i = 0; i < coords.length; i++) {
          currentY = coords[i];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'v':
        for (let i = 0; i < coords.length; i++) {
          currentY += coords[i];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'C':
        for (let i = 0; i < coords.length; i += 6) {
          if (i + 5 < coords.length) {
            const p0 = { x: currentX, y: currentY };
            const p1 = { x: coords[i], y: coords[i + 1] };
            const p2 = { x: coords[i + 2], y: coords[i + 3] };
            const p3 = { x: coords[i + 4], y: coords[i + 5] };
            const samples = Math.max(5, Math.ceil(tolerance * 2));
            for (let j = 1; j <= samples; j++) {
              const t = j / samples;
              points.push({
                x: (1-t)**3*p0.x+3*(1-t)**2*t*p1.x+3*(1-t)*t**2*p2.x+t**3*p3.x,
                y: (1-t)**3*p0.y+3*(1-t)**2*t*p1.y+3*(1-t)*t**2*p2.y+t**3*p3.y
              });
            }
            currentX = p3.x; currentY = p3.y;
          }
        }
        break;
      case 'c':
        for (let i = 0; i < coords.length; i += 6) {
          if (i + 5 < coords.length) {
            const p0 = { x: currentX, y: currentY };
            const p1 = { x: currentX+coords[i], y: currentY+coords[i+1] };
            const p2 = { x: currentX+coords[i+2], y: currentY+coords[i+3] };
            const p3 = { x: currentX+coords[i+4], y: currentY+coords[i+5] };
            const samples = Math.max(5, Math.ceil(tolerance * 2));
            for (let j = 1; j <= samples; j++) {
              const t = j / samples;
              points.push({
                x: (1-t)**3*p0.x+3*(1-t)**2*t*p1.x+3*(1-t)*t**2*p2.x+t**3*p3.x,
                y: (1-t)**3*p0.y+3*(1-t)**2*t*p1.y+3*(1-t)*t**2*p2.y+t**3*p3.y
              });
            }
            currentX = p3.x; currentY = p3.y;
          }
        }
        break;
      case 'Q':
        for (let i = 0; i < coords.length; i += 4) {
          if (i + 3 < coords.length) {
            const p0 = { x: currentX, y: currentY };
            const p1 = { x: coords[i], y: coords[i+1] };
            const p2 = { x: coords[i+2], y: coords[i+3] };
            const samples = Math.max(4, Math.ceil(tolerance * 1.5));
            for (let j = 1; j <= samples; j++) {
              const t = j / samples;
              points.push({
                x: (1-t)**2*p0.x+2*(1-t)*t*p1.x+t**2*p2.x,
                y: (1-t)**2*p0.y+2*(1-t)*t*p1.y+t**2*p2.y
              });
            }
            currentX = p2.x; currentY = p2.y;
          }
        }
        break;
      case 'q':
        for (let i = 0; i < coords.length; i += 4) {
          if (i + 3 < coords.length) {
            const p0 = { x: currentX, y: currentY };
            const p1 = { x: currentX+coords[i], y: currentY+coords[i+1] };
            const p2 = { x: currentX+coords[i+2], y: currentY+coords[i+3] };
            const samples = Math.max(4, Math.ceil(tolerance * 1.5));
            for (let j = 1; j <= samples; j++) {
              const t = j / samples;
              points.push({
                x: (1-t)**2*p0.x+2*(1-t)*t*p1.x+t**2*p2.x,
                y: (1-t)**2*p0.y+2*(1-t)*t*p1.y+t**2*p2.y
              });
            }
            currentX = p2.x; currentY = p2.y;
          }
        }
        break;
      case 'Z': case 'z': isClosed = true; break;
      default: break;
    }
  }
  if (points.length <= 2) return pathData;
  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x, dy = lineEnd.y - lineStart.y, lenSq = dx*dx+dy*dy;
    if (lenSq < 0.0001) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    const t = Math.max(0, Math.min(1, ((point.x-lineStart.x)*dx+(point.y-lineStart.y)*dy)/lenSq));
    const projX = lineStart.x + t*dx, projY = lineStart.y + t*dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }
  function simplifySegment(pts, tol) {
    if (pts.length <= 2) return pts;
    let maxDist = 0, maxIndex = 0;
    const first = pts[0], last = pts[pts.length-1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpendicularDistance(pts[i], first, last);
      if (d > maxDist) { maxDist = d; maxIndex = i; }
    }
    if (maxDist > tol) {
      const left = simplifySegment(pts.slice(0, maxIndex+1), tol);
      const right = simplifySegment(pts.slice(maxIndex), tol);
      return [...left.slice(0,-1), ...right];
    }
    return [pts[0], pts[pts.length-1]];
  }
  const simplified = [points[0]];
  let segmentStart = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].isMove) {
      if (i - segmentStart > 1) {
        const seg = points.slice(segmentStart, i);
        const sim = simplifySegment(seg, tolerance);
        simplified.push(...sim.slice(1));
      }
      simplified.push(points[i]);
      segmentStart = i;
    }
  }
  if (points.length - segmentStart > 1) {
    const seg = points.slice(segmentStart);
    const sim = simplifySegment(seg, tolerance);
    simplified.push(...sim.slice(1));
  }
  if (simplified.length < 2) return pathData;
  const result = simplified.map((p, i) =>
    (p.isMove || i === 0) ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  );
  if (isClosed && simplified.length > 2) result.push('Z');
  return result.join(' ');
}

export function vectorizeImageData(imageData, viewBox, blurRadius = 0) {
  const freshImageData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  try {
    const canvasWidth = freshImageData.width;
    const canvasHeight = freshImageData.height;
    const svgString = ImageTracer.imagedataToSVG(freshImageData, {
      ltres: 1, qtres: 1, pathomit: 0, rightangleenhance: true,
      colorsampling: 0, numberofcolors: 2, mincolorratio: 0.02, colorquantcycles: 1,
      scale: 1, linefilter: false, roundcoords: 1, viewbox: true, desc: false, blurradius: 0, blurdelta: 20
    });
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    const scaleX = canvasWidth / viewBox.w;
    const scaleY = canvasHeight / viewBox.h;
    const renderScale = Math.min(scaleX, scaleY);
    const scaledWidth = viewBox.w * renderScale;
    const scaledHeight = viewBox.h * renderScale;
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;
    const pathScaleX = 1 / renderScale;
    const pathScaleY = 1 / renderScale;
    // Map from canvas coords (glyph top at 0) to viewBox coords (glyph top at viewBox.minY)
    const translateX = -offsetX * pathScaleX;
    const translateY = -offsetY * pathScaleY + viewBox.minY;
    svgElement.querySelectorAll('path').forEach(path => {
      const pathData = path.getAttribute('d');
      if (pathData) {
        let scaledPath = scaleSVGPath(pathData, pathScaleX, pathScaleY);
        scaledPath = translateSVGPath(scaledPath, translateX, translateY);
        if (blurRadius > 5) {
          const tolerance = Math.min(blurRadius * 0.05, 5.0);
          scaledPath = simplifySVGPath(scaledPath, tolerance);
        }
        path.setAttribute('d', scaledPath);
      }
    });
    svgElement.setAttribute('viewBox', `${viewBox.minX} ${viewBox.minY} ${viewBox.w} ${viewBox.h}`);
    svgElement.setAttribute('width', viewBox.w);
    svgElement.setAttribute('height', viewBox.h);
    return new XMLSerializer().serializeToString(svgElement);
  } catch (error) {
    console.error('Vectorization error:', error);
    return null;
  }
}

export function extractPathsFromSVG(svgString) {
  if (!svgString) return [];
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const paths = svgDoc.querySelectorAll('path');
  return Array.from(paths).map(path => path.getAttribute('d') || '');
}
