# Kuntal PDF Reader V2

## Native PDF rendering

This V2 uses `react-native-pdf` 6.7.7 with the Expo SDK 53-compatible config plugins:
- `@config-plugins/react-native-pdf` 11.0.0
- `@config-plugins/react-native-blob-util` 11.0.0
- `react-native-blob-util` 0.21.2

These versions are intentionally pinned.

## Important

This package requires a custom native/development build. It will NOT work as a normal Expo Go app.

Build an Android APK with EAS:

```bash
npm install
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

The `preview` profile is configured to produce an installable APK.

## Features in V2

- Android PDF picker
- Real native PDF rendering
- Page count
- Previous/next page
- Pinch/double-tap zoom through native PDF view
- Recent PDFs
- Search recent PDF filenames
- Bookmarks by page
- Dark mode
- Share
- Delete recent entry
- Android back handling
- Error handling for failed PDF rendering

## Limitation

Full-text search inside PDF content is not implemented in V2. The search box searches recent PDF filenames. Content search can be added as a later version using a PDF text-extraction strategy.
