import { PDFDocument } from 'pdf-lib';

export async function extractTextWithPageMarkers(buffer: Buffer): Promise<string> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  const markedPages: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    const markerStart = `[ ###### START OF PAGE ${i + 1}  ###### ]\n`;
    const markerEnd = `[ ########## End of Page ${i + 1} ######]\n`;

    markedPages.push(`${markerStart}${text}\n${markerEnd}`);
  }

  return markedPages.join('\n\n');
}
