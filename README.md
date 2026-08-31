# Kuntal Documents V9.1

Premium Expo 53 Android PDF/scanner workspace.

## Included
- Native PDF viewer with page count and navigation
- Smooth zoom/pan through react-native-pdf
- Open and share PDF
- Auto/Manual scanner camera flow
- Multi-page scan, reorder, delete, add page
- Gallery to PDF
- Document/B&W/Grayscale/Clean image presets
- Merge PDFs
- Extract current page as a PDF
- Rotate current PDF page
- OCR using native ML Kit
- Watermark and signature text layers for generated PDFs
- PDF quick-edit/annotation panel
- PDF information panel and bookmarks UI
- Premium home UI with Quick Tools

## Build
Use an EAS/custom native Android build. Expo Go is not sufficient because the app uses native PDF and ML Kit modules.

Recommended:

```bash
npm install
npx expo prebuild --clean
npx eas build -p android --profile production
```
