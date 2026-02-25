import { downloadFont } from '../utils/fontGenerator';
import './DownloadButton.css';

export function DownloadButton({ fontBlob, disabled }) {
  const handleDownload = () => {
    if (fontBlob) {
      downloadFont(fontBlob, 'pixelated-font.ttf');
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || !fontBlob}
      className="download-button"
    >
      Download TTF Font
    </button>
  );
}
