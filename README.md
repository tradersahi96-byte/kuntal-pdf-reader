# Kuntal Documents V9.2

Premium Expo SDK 53 Android PDF + Smart Scanner workspace.

## Included
- Native PDF viewer with page count, smooth zoom/pan and page navigation
- Open/share PDF
- Smart Scan camera flow with Auto and Manual modes
- Multi-page document capture, reorder, delete and add page
- Gallery → PDF
- Document, B&W, Grayscale and Clean image presets
- Merge PDFs
- Extract current page as a new PDF
- Rotate current PDF page
- OCR using native ML Kit
- Watermark and signature text layers for generated PDFs
- PDF quick-edit overlay panel (text/signature/watermark)
- PDF information panel and bookmark UI
- Premium home dashboard and Quick Tools search
- App icon configured at root as `icon.png`

## V9.2 build-stability changes
- Expo SDK 53-compatible dependency versions are pinned instead of using loose ranges for native-critical packages.
- New Architecture is explicitly disabled for better compatibility with the native PDF/ML Kit stack used by this project.
- Explicit `babel.config.js` and Expo `metro.config.js` are included.
- Root `icon.png` is retained and referenced by `app.json`; no `assets/` folder is required for the icon.

## Build
This is a custom native Android build; Expo Go is not sufficient.

```bash
npm install
npx expo prebuild --clean
npx eas build -p android --profile production
```

For a directly installable APK use the `preview` profile in `eas.json`.
