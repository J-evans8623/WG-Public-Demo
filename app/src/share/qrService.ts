/**
 * @file share/qrService.ts
 * @responsibility
 *   • Generate QR codes as PNG buffers or SVG strings for arbitrary text/URLs.
 *   • Use high-error-correction, small margin, and configurable sizing defaults.
 *   • Provide both individual functions and a service object interface.
 */

import QRCode from 'qrcode';

/**
 * Generate a PNG Buffer of a QR code for the given text or URL.
 */
export async function generateQrCodePng(
  text: string,
  size: number = 300
): Promise<Buffer> {
  console.log('qrService.ts 3001 ○ generateQrCodePng called with text:', text, 'size:', size);
  try {
    const buffer: Buffer = await QRCode.toBuffer(text, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'H',
    });
    console.log('qrService.ts 3002 ○ PNG buffer generated, length:', buffer.length);
    return buffer;
  } catch (err) {
    console.error('qrService.ts 3003 ✖ Error generating PNG QR for text:', text, err);
    throw err;
  }
}

/**
 * Generate an SVG string of a QR code for the given text or URL.
 */
export async function generateQrCodeSvg(text: string): Promise<string> {
  console.log('qrService.ts 3004 ○ generateQrCodeSvg called with text:', text);
  try {
    const svg: string = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'H',
    });
    console.log('qrService.ts 3005 ○ SVG string generated, length:', svg.length);
    return svg;
  } catch (err) {
    console.error('qrService.ts 3006 ✖ Error generating SVG QR for text:', text, err);
    throw err;
  }
}

// Export service object for backward compatibility
export const qrService = {
  generatePngBuffer: generateQrCodePng,
  generateSvgString: generateQrCodeSvg
};