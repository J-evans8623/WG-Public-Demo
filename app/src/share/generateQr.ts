/**
 * @file src/utils/share/generateQr.ts
 * @responsibility
 *   • Encapsulate QR-code creation logic using the 'qrcode' library.
 *   • Expose a single function `generateQrDataUri` that returns a PNG Data-URI for a given URL.
 */

import QRCode from 'qrcode';

export async function generateQrDataUri(url: string): Promise<string> {
  console.log('generateQr.ts 0001 ○ generateQrDataUri called with URL:', url);
  try {
    const dataUri = await QRCode.toDataURL(url, {
      margin: 1,
      color: {
        dark: '#000000ff', // Black dots
        light: '#00000000' // Transparent background
      }
    });
    console.log('generateQr.ts 0002 ○ QR code generated, Data-URI length:', dataUri.length);
    return dataUri;
  } catch (err) {
    console.error('generateQr.ts 0003 ✖ Error generating QR code for URL:', url, err);
    throw err;
  }
}
