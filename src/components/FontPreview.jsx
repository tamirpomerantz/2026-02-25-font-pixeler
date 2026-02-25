import { useEffect, useState } from 'react';
import './FontPreview.css';

export function FontPreview({ fontBlob, testText = 'The quick brown fox 012', fontFamily = 'PixelatedFont', compact = false }) {
  const [fontUrl, setFontUrl] = useState(null);
  const [fontSize, setFontSize] = useState(compact ? 48 : 72);

  useEffect(() => {
    if (fontUrl) {
      URL.revokeObjectURL(fontUrl);
      setFontUrl(null);
    }
    if (fontBlob) {
      const url = URL.createObjectURL(fontBlob);
      setFontUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFontUrl(null);
  }, [fontBlob]);

  return (
    <div className={`font-preview ${compact ? 'font-preview--compact' : ''}`}>
      {fontUrl ? (
        <>
          <div className="font-preview-controls">
            <div className="font-size-control">
              <input
                type="range"
                className="font-size-slider"
                min="12"
                max={compact ? 120 : 200}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span className="font-size-display">{fontSize} px</span>
            </div>
          </div>
          <div
            className="preview-text"
            style={{
              fontFamily: `${fontFamily}, sans-serif`,
              fontSize: `${fontSize}px`
            }}
          >
            {testText}
          </div>
          <style>
            {`
              @font-face {
                font-family: '${fontFamily}';
                src: url(${fontUrl}) format('truetype');
              }
            `}
          </style>
        </>
      ) : (
        <div className="preview-placeholder">Generate font to preview</div>
      )}
    </div>
  );
}
