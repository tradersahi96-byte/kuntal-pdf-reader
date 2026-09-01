import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

export const pdfUtils = {
  async createPdfFromImages(images, namePrefix = 'Scan') {
    if (!images?.length) throw new Error('No images provided');
    
    try {
      const encoded = [];
      for (const image of images.slice(0, 20)) {
        const base64 = await FileSystem.readAsStringAsync(image.uri, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        const mime = image.mimeType || (image.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        encoded.push(`data:${mime};base64,${base64}`);
      }

      const body = encoded.map((src) => `<section><img src="${src}" style="width:100%;height:auto;display:block;"/></section>`).join('');
      const html = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    section { page-break-after: always; width: 100%; }
    img { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>${body}</body>
</html>`;

      const result = await Print.printToFileAsync({ html });
      return result.uri;
    } catch (e) {
      throw new Error(`PDF creation failed: ${e.message}`);
    }
  },

  async mergePdfs(pdfUris, outputName = 'Merged') {
    try {
      // Note: Actual PDF merging requires native module or server
      // This is a placeholder that combines via images
      if (!pdfUris?.length) throw new Error('No PDFs provided');
      return pdfUris[0]; // Return first PDF as placeholder
    } catch (e) {
      throw new Error(`PDF merge failed: ${e.message}`);
    }
  },

  async splitPdf(pdfUri, pageIndices, outputName = 'Split') {
    try {
      // Note: Actual PDF splitting requires native module or server
      // This is a placeholder
      if (!pdfUri) throw new Error('No PDF provided');
      return pdfUri; // Return original as placeholder
    } catch (e) {
      throw new Error(`PDF split failed: ${e.message}`);
    }
  },

  async getFileInfo(uri) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('File not found');
      return {
        size: info.size,
        modificationTime: info.modificationTime,
        exists: info.exists,
      };
    } catch (e) {
      throw new Error(`Failed to get file info: ${e.message}`);
    }
  },

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  sanitizeFileName(name) {
    return name.replace(/[^a-z0-9._-]/gi, '_').substring(0, 255);
  },
};
