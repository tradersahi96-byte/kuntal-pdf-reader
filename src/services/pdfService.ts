import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { DOCUMENTS_DIR, ensureAppDirectories, saveRecentDocument } from './storageService';

export const generatePdfFromImages = async (
  imageUris: string[],
  customName?: string
): Promise<string> => {
  if (!imageUris || imageUris.length === 0) {
    throw new Error('No images provided for PDF generation.');
  }

  await ensureAppDirectories();

  const imagesBase64 = await Promise.all(
    imageUris.map(async (uri) => {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${b64}`;
    })
  );

  const pagesHtml = imagesBase64
    .map(
      (b64) => `
      <div style="page-break-after: always; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;">
        <img src="${b64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
      </div>`
    )
    .join('');

  const html = `<html><body style="margin:0;padding:0;background:#ffffff;">${pagesHtml}</body></html>`;
  const { uri: tempUri } = await Print.printToFileAsync({ html });

  const safeName = (customName && customName.trim().length > 0 ? customName : `Kuntal_Scan_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalFileName = `${safeName}.pdf`;
  const destinationUri = `${DOCUMENTS_DIR}${finalFileName}`;

  await FileSystem.copyAsync({ from: tempUri, to: destinationUri });
  const fileInfo = await FileSystem.getInfoAsync(destinationUri);

  await saveRecentDocument({
    id: destinationUri,
    name: finalFileName,
    uri: destinationUri,
    size: (fileInfo as any).size || 0,
    pageCount: imageUris.length,
  });

  return destinationUri;
};

export const importPdfFromStorage = async (): Promise<{ uri: string; name: string } | null> => {
  await ensureAppDirectories();
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    copyToCacheDirectory: true,
  });

  if (!result.canceled && result.assets && result.assets.length > 0) {
    const asset = result.assets[0];
    const safeName = (asset.name || `Imported_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const destinationUri = `${DOCUMENTS_DIR}${Date.now()}_${safeName}`;

    await FileSystem.copyAsync({ from: asset.uri, to: destinationUri });
    const fileInfo = await FileSystem.getInfoAsync(destinationUri);

    await saveRecentDocument({
      id: destinationUri,
      name: asset.name || safeName,
      uri: destinationUri,
      size: (fileInfo as any).size || asset.size || 0,
    });

    return { uri: destinationUri, name: asset.name || safeName };
  }
  return null;
};

export const sharePdf = async (uri: string, title?: string): Promise<void> => {
  const isAvail = await Sharing.isAvailableAsync();
  if (!isAvail) throw new Error('Sharing is not supported on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title || 'Share PDF via Kuntal Documents',
    UTI: 'com.adobe.pdf',
  });
};

export const printPdf = async (uri: string): Promise<void> => {
  await Print.printAsync({ uri });
};

export const mergePdfs = async (uris: string[]): Promise<string> => {
  if (uris.length < 2) throw new Error('Select at least 2 PDF files to merge.');
  await ensureAppDirectories();

  const mergedDoc = await PDFDocument.create();
  for (const uri of uris) {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const doc = await PDFDocument.load(b64);
    const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => mergedDoc.addPage(p));
  }

  const mergedB64 = await mergedDoc.saveAsBase64();
  const fileName = `Merged_${Date.now()}.pdf`;
  const destUri = `${DOCUMENTS_DIR}${fileName}`;

  await FileSystem.writeAsStringAsync(destUri, mergedB64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(destUri);

  await saveRecentDocument({
    id: destUri,
    name: fileName,
    uri: destUri,
    size: (info as any).size || 0,
  });

  return destUri;
};

export const splitPdf = async (uri: string, startPage: number, endPage: number): Promise<string> => {
  await ensureAppDirectories();
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const srcDoc = await PDFDocument.load(b64);
  const totalPages = srcDoc.getPageCount();

  const start = Math.max(0, startPage - 1);
  const end = Math.min(totalPages - 1, endPage - 1);
  if (start > end) throw new Error('Invalid page range specified.');

  const newDoc = await PDFDocument.create();
  const pageIndices: number[] = [];
  for (let i = start; i <= end; i++) pageIndices.push(i);

  const copied = await newDoc.copyPages(srcDoc, pageIndices);
  copied.forEach((p) => newDoc.addPage(p));

  const splitB64 = await newDoc.saveAsBase64();
  const fileName = `Split_p${startPage}_p${endPage}_${Date.now()}.pdf`;
  const destUri = `${DOCUMENTS_DIR}${fileName}`;

  await FileSystem.writeAsStringAsync(destUri, splitB64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(destUri);

  await saveRecentDocument({
    id: destUri,
    name: fileName,
    uri: destUri,
    size: (info as any).size || 0,
    pageCount: copied.length,
  });

  return destUri;
};

export const rotatePdf = async (uri: string, rotationAngle: number = 90): Promise<string> => {
  await ensureAppDirectories();
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const doc = await PDFDocument.load(b64);
  const pages = doc.getPages();

  pages.forEach((p) => {
    const current = p.getRotation().angle;
    p.setRotation(degrees((current + rotationAngle) % 360));
  });

  const rotatedB64 = await doc.saveAsBase64();
  const fileName = `Rotated_${Date.now()}.pdf`;
  const destUri = `${DOCUMENTS_DIR}${fileName}`;

  await FileSystem.writeAsStringAsync(destUri, rotatedB64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(destUri);

  await saveRecentDocument({
    id: destUri,
    name: fileName,
    uri: destUri,
    size: (info as any).size || 0,
    pageCount: pages.length,
  });

  return destUri;
};

export const watermarkPdf = async (uri: string, watermarkText: string): Promise<string> => {
  await ensureAppDirectories();
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const doc = await PDFDocument.load(b64);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 4,
      y: height / 2,
      size: 40,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.35,
      rotate: degrees(45),
    });
  });

  const watermarkedB64 = await doc.saveAsBase64();
  const fileName = `Watermarked_${Date.now()}.pdf`;
  const destUri = `${DOCUMENTS_DIR}${fileName}`;

  await FileSystem.writeAsStringAsync(destUri, watermarkedB64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(destUri);

  await saveRecentDocument({
    id: destUri,
    name: fileName,
    uri: destUri,
    size: (info as any).size || 0,
    pageCount: pages.length,
  });

  return destUri;
};
