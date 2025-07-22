/**
 * @file server/qrService.ts
 * @responsibility
 *   • Generate QR codes as PNG buffers or SVG strings for arbitrary text/URLs.
 *   • Use high-error-correction, small margin, and configurable sizing defaults.
 *   • Provide two functions:
 *       – generateQrCodePng(text, size): Promise<Buffer>
 *       – generateQrCodeSvg(text): Promise<string>
 */

import QRCode from 'qrcode';

/**
 * Generate a PNG Buffer of a QR code for the given text or URL.
 * @param text The text or URL to encode.
 * @param size Width (and height) in pixels of the generated QR code. Default 300.
 * @returns PNG image data as a Buffer.
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
 * @param text The text or URL to encode.
 * @returns SVG markup as a string.
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
