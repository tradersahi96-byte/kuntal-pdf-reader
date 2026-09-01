
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { DOCUMENTS_DIR, ensureAppDirectories, saveRecentDocument } from './storageService';

export const generatePdfFromImages = async (
  imageUris: string[],
  customName?: string
): Promise<string> => {
  if (!imageUris || imageUris.length === 0) {
    throw new Error('No images selected for PDF generation.');
  }

  await ensureAppDirectories();

  // Convert raw image paths to inline base64 to avoid broken relative URI rendering on Android WebView print engines
  const imagesBase64 = await Promise.all(
    imageUris.map(async (uri) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    })
  );

  const pagesHtml = imagesBase64
    .map(
      (b64) => `
      <div class="page-container">
        <img src="${b64}" class="page-image" />
      </div>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body, html { width: 100%; height: 100%; background-color: #ffffff; }
          .page-container {
            width: 100vw;
            height: 100vh;
            page-break-after: always;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .page-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  const { uri: tempUri } = await Print.printToFileAsync({ html });
  const rawFileName = customName && customName.trim().length > 0
    ? customName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    : `Kuntal_Doc_${Date.now()}`;

  const finalFileName = `${rawFileName}.pdf`;
  const destinationUri = `${DOCUMENTS_DIR}${finalFileName}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: destinationUri,
  });

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
  try {
    await ensureAppDirectories();
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const sanitizedName = (asset.name || `Imported_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const destinationUri = `${DOCUMENTS_DIR}${Date.now()}_${sanitizedName}`;

      // Persist from cache directory to app permanent scoped storage
      await FileSystem.copyAsync({
        from: asset.uri,
        to: destinationUri,
      });

      const fileInfo = await FileSystem.getInfoAsync(destinationUri);

      await saveRecentDocument({
        id: destinationUri,
        name: asset.name || sanitizedName,
        uri: destinationUri,
        size: (fileInfo as any).size || asset.size || 0,
      });

      return {
        uri: destinationUri,
        name: asset.name || sanitizedName,
      };
    }
    return null;
  } catch (error) {
    console.error('Error importing PDF:', error);
    throw error;
  }
};

export const shareDocument = async (uri: string, title?: string): Promise<void> => {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Native Android sharing is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title ? `Share ${title}` : 'Share PDF via Kuntal Documents',
    UTI: 'com.adobe.pdf',
  });
};
