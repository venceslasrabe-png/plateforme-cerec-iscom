import QRCode from 'qrcode';
import { useMemo } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
}

/**
 * Real scannable ISO/IEC 18004 QR Code rendered as a crisp vector SVG.
 */
export function QrCodeSvg({
  value,
  size = 84,
  className = '',
  fgColor = '#0b1f3f',
}: QrCodeSvgProps) {
  const { moduleCount, pathData } = useMemo(() => {
    const safeValue = value.trim() || 'CEREC-ISCOM';
    const qr = QRCode.create(safeValue, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const parts: string[] = [];

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (data[r * count + c]) {
          parts.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }

    return {
      moduleCount: count,
      pathData: parts.join(''),
    };
  }, [value]);

  const quietZone = 2;
  const viewBoxSize = moduleCount + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      className={`bg-white border border-[#e3e7ef] rounded ${className}`}
      role="img"
      aria-label={`QR Code : ${value}`}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      <g transform={`translate(${quietZone}, ${quietZone})`}>
        <path d={pathData} fill={fgColor} />
      </g>
    </svg>
  );
}
