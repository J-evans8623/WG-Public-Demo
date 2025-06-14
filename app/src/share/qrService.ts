/**
 * @file server/qrService.ts
 * @responsibility
 *   • Generate QR codes (PNG or SVG) for arbitrary text/URLs.
 *   • Provide high-error-correction, margin, and sizing defaults.
 */

import QRCode from 'qrcode';

/**
 * Generate a PNG buffer of a QR code for the given text.
 * @param text The text or URL to encode.
 * @param size Width (and height) in pixels of the generated QR code. Default 300.
 * @returns PNG image data as a Buffer.
 */
export async function generateQrCodePng(
  text: string,
  size: number = 300
): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}

/**
 * Generate an SVG string of a QR code for the given text.
 * @param text The text or URL to encode.
 * @returns SVG markup as a string.
 */
export async function generateQrCodeSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}
