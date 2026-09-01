import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  BackHandler,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { PDFDocument, degrees } from 'pdf-lib';

const RECENTS_KEY = '@kuntal_recent_docs_v3';
const THEME_KEY = '@kuntal_theme_v3';
const DOCUMENTS_DIR = `${FileSystem.documentDirectory}KuntalDocuments/`;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' | 'scan' | 'viewer' | 'tools'
  const [isDark, setIsDark] = useState(true);
  const [recents, setRecents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Viewer State
  const [viewerFile, setViewerFile] = useState(null); // { uri, title, base64 }
  const [viewerError, setViewerError] = useState(null);

  // Scanner & Conversion State
  const [scannedPages, setScannedPages] = useState([]);
  const [scanDocName, setScanDocName] = useState('');

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState(null); // 'merge' | 'split' | 'rotate'

  useEffect(() => {
    initApp();
    const backAction = () => {
      if (currentScreen !== 'home') {
        setCurrentScreen('home');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentScreen]);

  const initApp = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
      }
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
      await loadRecents();
    } catch (e) {
      console.error('Init failure:', e);
    }
  };

  const toggleTheme = async () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    await AsyncStorage.setItem(THEME_KEY, nextTheme ? 'dark' : 'light');
  };

  const loadRecents = async () => {
    try {
      const data = await AsyncStorage.getItem(RECENTS_KEY);
      if (!data) {
        setRecents([]);
        return;
      }
      const list = JSON.parse(data);
      const verified = [];
      for (const item of list) {
        const info = await FileSystem.getInfoAsync(item.uri);
        if (info.exists) {
          verified.push(item);
        }
      }
      setRecents(verified);
    } catch (e) {
      setRecents([]);
    }
  };

  const saveToRecents = async (doc) => {
    try {
      const existing = await AsyncStorage.getItem(RECENTS_KEY);
      let list = existing ? JSON.parse(existing) : [];
      list = [{ ...doc, timestamp: Date.now() }, ...list.filter((x) => x.uri !== doc.uri)].slice(0, 30);
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(list));
      await loadRecents();
    } catch (e) {
      console.error('Save recents failure:', e);
    }
  };

  const deleteRecentItem = async (uri) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this document from local storage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists) {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            }
            const updated = recents.filter((item) => item.uri !== uri);
            await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
            setRecents(updated);
          } catch (e) {
            Alert.alert('Error', 'Failed to delete file.');
          }
        },
      },
    ]);
  };

  const openPdfViewer = async (uri, title) => {
    setLoading(true);
    setLoadingMessage('Loading PDF Document...');
    setViewerError(null);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('Document does not exist.');
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setViewerFile({ uri, title: title || 'Document', base64 });
      setCurrentScreen('viewer');
    } catch (e) {
      Alert.alert('Open Error', e.message || 'Could not read PDF.');
    } finally {
      setLoading(false);
    }
  };

  const pickDevicePdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const safeName = (asset.name || `Document_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const destUri = `${DOCUMENTS_DIR}${Date.now()}_${safeName}`;
        await FileSystem.copyAsync({ from: asset.uri, to: destUri });
        const fileInfo = await FileSystem.getInfoAsync(destUri);

        const newDoc = {
          id: destUri,
          name: asset.name || safeName,
          uri: destUri,
          size: fileInfo.size || asset.size || 0,
        };
        await saveToRecents(newDoc);
        await openPdfViewer(destUri, newDoc.name);
      }
    } catch (e) {
      Alert.alert('Import Failed', 'Failed to select PDF document.');
    }
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      setScannedPages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleGalleryPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setScannedPages((prev) => [...prev, ...uris]);
    }
  };

  const compilePagesToPdf = async () => {
    if (scannedPages.length === 0) {
      Alert.alert('No Pages', 'Add at least one scanned page.');
      return;
    }
    setLoading(true);
    setLoadingMessage('Compiling PDF Document...');
    try {
      const imagesBase64 = await Promise.all(
        scannedPages.map(async (uri) => {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return `data:image/jpeg;base64,${b64}`;
        })
      );

      const htmlPages = imagesBase64
        .map(
          (b64) => `
          <div style="page-break-after: always; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0;">
            <img src="${b64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>`
        )
        .join('');

      const html = `<html><body style="margin:0;padding:0;background:#ffffff;">${htmlPages}</body></html>`;
      const { uri: tempUri } = await Print.printToFileAsync({ html });

      const safeName = (scanDocName.trim() || `Kuntal_Scan_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const finalFileName = `${safeName}.pdf`;
      const destUri = `${DOCUMENTS_DIR}${finalFileName}`;

      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      const info = await FileSystem.getInfoAsync(destUri);

      const docItem = {
        id: destUri,
        name: finalFileName,
        uri: destUri,
        size: info.size || 0,
        pageCount: scannedPages.length,
      };

      await saveToRecents(docItem);
      setScannedPages([]);
      setScanDocName('');
      await openPdfViewer(destUri, finalFileName);
    } catch (e) {
      Alert.alert('Generation Error', e.message || 'Failed to generate PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (uri, title) => {
    const isAvail = await Sharing.isAvailableAsync();
    if (!isAvail) {
      Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: title || 'Share PDF Document',
      UTI: 'com.adobe.pdf',
    });
  };

  // Tools Implementation (Merge, Split, Rotate)
  const handleMergePdfs = async () => {
    try {
      const res1 = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (res1.canceled || !res1.assets) return;
      const res2 = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (res2.canceled || !res2.assets) return;

      setLoading(true);
      setLoadingMessage('Merging PDF Documents...');

      const b64_1 = await FileSystem.readAsStringAsync(res1.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const b64_2 = await FileSystem.readAsStringAsync(res2.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });

      const pdf1 = await PDFDocument.load(b64_1);
      const pdf2 = await PDFDocument.load(b64_2);

      const mergedPdf = await PDFDocument.create();
      const pages1 = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
      pages1.forEach((p) => mergedPdf.addPage(p));

      const pages2 = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());
      pages2.forEach((p) => mergedPdf.addPage(p));

      const mergedBase64 = await mergedPdf.saveAsBase64();
      const outName = `Merged_${Date.now()}.pdf`;
      const destUri = `${DOCUMENTS_DIR}${outName}`;

      await FileSystem.writeAsStringAsync(destUri, mergedBase64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(destUri);

      await saveToRecents({ id: destUri, name: outName, uri: destUri, size: info.size || 0 });
      await openPdfViewer(destUri, outName);
    } catch (e) {
      Alert.alert('Merge Error', e.message || 'Could not merge selected documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleRotatePdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets) return;

      setLoading(true);
      setLoadingMessage('Rotating Document Pages (90°)...');

      const b64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const pdfDoc = await PDFDocument.load(b64);
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + 90) % 360));
      });

      const rotatedB64 = await pdfDoc.saveAsBase64();
      const outName = `Rotated_${Date.now()}.pdf`;
      const destUri = `${DOCUMENTS_DIR}${outName}`;

      await FileSystem.writeAsStringAsync(destUri, rotatedB64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(destUri);

      await saveToRecents({ id: destUri, name: outName, uri: destUri, size: info.size || 0 });
      await openPdfViewer(destUri, outName);
    } catch (e) {
      Alert.alert('Rotate Error', e.message || 'Failed to rotate PDF.');
    } finally {
      setLoading(false);
    }
  };

  const themeColors = isDark
    ? {
        bg: '#090d16',
        card: '#131b2e',
        cardBorder: '#1e293b',
        textPrimary: '#f8fafc',
        textSecondary: '#cbd5e1',
        textMuted: '#64748b',
        accent: '#0284c7',
        accentSec: '#0f766e',
        headerBg: '#0f172a',
        statusBar: 'light-content',
      }
    : {
        bg: '#f8fafc',
        card: '#ffffff',
        cardBorder: '#e2e8f0',
        textPrimary: '#0f172a',
        textSecondary: '#334155',
        textMuted: '#94a3b8',
        accent: '#0284c7',
        accentSec: '#0d9488',
        headerBg: '#ffffff',
        statusBar: 'dark-content',
      };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={themeColors.headerBg} />

      {/* Global Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingOverlayText}>{loadingMessage || 'Processing...'}</Text>
        </View>
      )}

      {/* HOME SCREEN */}
      {currentScreen === 'home' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.cardBorder }]}>
            <View>
              <Text style={[styles.brandSub, { color: themeColors.accent }]}>KUNTAL DOCUMENTS</Text>
              <Text style={[styles.brandTitle, { color: themeColors.textPrimary }]}>PDF Suite</Text>
            </View>
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.themeBtn, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }]}
            >
              <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolsRow}>
            <TouchableOpacity
              style={[styles.toolCard, { backgroundColor: themeColors.accent }]}
              onPress={() => {
                setScannedPages([]);
                setCurrentScreen('scan');
              }}
            >
              <Text style={styles.toolIcon}>📸</Text>
              <Text style={styles.toolTitle}>Scan Docs</Text>
              <Text style={styles.toolSub}>Camera & Multi-Page</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.toolCard, { backgroundColor: themeColors.accentSec }]} onPress={pickDevicePdf}>
              <Text style={styles.toolIcon}>📂</Text>
              <Text style={styles.toolTitle}>Open PDF</Text>
              <Text style={styles.toolSub}>Device File Picker</Text>
            </TouchableOpacity>
          </View>

          {/* Quick PDF Tools Row */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={[styles.quickToolBtn, { backgroundColor: themeColors.card }]} onPress={handleMergePdfs}>
              <Text style={{ fontSize: 18 }}>📑</Text>
              <Text style={[styles.quickToolText, { color: themeColors.textPrimary }]}>Merge PDFs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickToolBtn, { backgroundColor: themeColors.card }]} onPress={handleRotatePdf}>
              <Text style={{ fontSize: 18 }}>🔄</Text>
              <Text style={[styles.quickToolText, { color: themeColors.textPrimary }]}>Rotate 90°</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Recent Documents</Text>
            <Text style={[styles.sectionCount, { color: themeColors.textMuted }]}>{recents.length}</Text>
          </View>

          <FlatList
            data={recents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.docItem, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }]}
                onPress={() => openPdfViewer(item.uri, item.name)}
              >
                <View style={styles.pdfBadge}>
                  <Text style={styles.pdfBadgeText}>PDF</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.docName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.docMeta, { color: themeColors.textMuted }]}>
                    {new Date(item.timestamp).toLocaleDateString()} • {item.size ? `${(item.size / 1024).toFixed(0)} KB` : 'Local'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleShare(item.uri, item.name)} style={styles.actionIconBtn}>
                  <Text style={{ color: themeColors.accent, fontSize: 16 }}>↗</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteRecentItem(item.uri)} style={styles.actionIconBtn}>
                  <Text style={{ color: '#ef4444', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📄</Text>
                <Text style={[styles.emptyText, { color: themeColors.textPrimary }]}>No documents found</Text>
                <Text style={[styles.emptySub, { color: themeColors.textMuted }]}>
                  Scan physical documents or pick a PDF from internal storage.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* SCANNER SCREEN */}
      {currentScreen === 'scan' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.cardBorder }]}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Multi-Page Scanner</Text>
            <View style={{ width: 45 }} />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, color: themeColors.textPrimary },
              ]}
              placeholder="Document Title (e.g., Receipt_May)"
              placeholderTextColor={themeColors.textMuted}
              value={scanDocName}
              onChangeText={setScanDocName}
            />
          </View>

          <View style={styles.scannerActions}>
            <TouchableOpacity style={[styles.scannerBtn, { backgroundColor: themeColors.accent }]} onPress={handleCameraCapture}>
              <Text style={styles.scannerBtnText}>📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scannerBtn, { backgroundColor: themeColors.accentSec }]} onPress={handleGalleryPick}>
              <Text style={styles.scannerBtnText}>🖼️ Pick Gallery</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={scannedPages}
            numColumns={3}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
            renderItem={({ item, index }) => (
              <View style={[styles.thumbCard, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }]}>
                <Image source={{ uri: item }} style={styles.thumbImage} />
                <TouchableOpacity
                  style={styles.thumbDelete}
                  onPress={() => setScannedPages(scannedPages.filter((_, i) => i !== index))}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
                <View style={styles.pagePill}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>P.{index + 1}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No Pages Captured</Text>
                <Text style={[styles.emptySub, { color: themeColors.textMuted }]}>
                  Capture photos or pick images to synthesize your PDF.
                </Text>
              </View>
            }
          />

          {scannedPages.length > 0 && (
            <View style={[styles.footer, { backgroundColor: themeColors.headerBg, borderTopColor: themeColors.cardBorder }]}>
              <TouchableOpacity style={styles.compileBtn} onPress={compilePagesToPdf}>
                <Text style={styles.compileBtnText}>Save {scannedPages.length} Pages to PDF</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* PDF VIEWER SCREEN */}
      {currentScreen === 'viewer' && viewerFile && (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.cardBorder }]}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={{ color: themeColors.accent, fontSize: 15, fontWeight: '700' }}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {viewerFile.title}
            </Text>
            <TouchableOpacity onPress={() => handleShare(viewerFile.uri, viewerFile.title)}>
              <Text style={{ color: themeColors.accent, fontSize: 15, fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </View>

          <WebView
            originWhitelist={['*']}
            source={{
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, minimum-scale=1.0" />
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
                    <style>
                      * { box-sizing: border-box; margin: 0; padding: 0; }
                      body { background-color: ${themeColors.bg}; display: flex; flex-direction: column; align-items: center; padding: 12px 0; }
                      .pdf-page { max-width: 96vw; height: auto; margin-bottom: 14px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); background:#fff; }
                    </style>
                  </head>
                  <body>
                    <div id="pdf-container"></div>
                    <script>
                      const rawData = atob("${viewerFile.base64 || ''}");
                      const uint8Array = new Uint8Array(rawData.length);
                      for (let i = 0; i < rawData.length; i++) { uint8Array[i] = rawData.charCodeAt(i); }

                      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                      pdfjsLib.getDocument({ data: uint8Array }).promise.then(function(pdf) {
                        const container = document.getElementById('pdf-container');
                        for (let p = 1; p <= pdf.numPages; p++) {
                          pdf.getPage(p).then(function(page) {
                            const viewport = page.getViewport({ scale: 1.5 });
                            const canvas = document.createElement('canvas');
                            canvas.className = 'pdf-page';
                            const ctx = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            container.appendChild(canvas);
                            page.render({ canvasContext: ctx, viewport: viewport });
                          });
                        }
                      }).catch(function() {
                        document.body.innerHTML = '<div style="color:red;padding:20px;text-align:center;">Failed to render PDF.</div>';
                      });
                    </script>
                  </body>
                </html>
              `,
            }}
            style={{ flex: 1, backgroundColor: themeColors.bg }}
            scalesPageToFit={true}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  brandSub: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  brandTitle: { fontSize: 22, fontWeight: '800' },
  headerTitle: { fontSize: 16, fontWeight: '700', maxWidth: '60%' },
  themeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  toolsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 14 },
  toolCard: { flex: 1, borderRadius: 12, padding: 14, minHeight: 100, justifyContent: 'space-between' },
  toolIcon: { fontSize: 24 },
  toolTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  toolSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  quickActionsContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  quickToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickToolText: { fontSize: 13, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 14, fontWeight: '600' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 20, flexGrow: 1 },
  docItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  pdfBadge: { width: 38, height: 38, borderRadius: 6, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  pdfBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 11, marginTop: 2 },
  actionIconBtn: { padding: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  inputContainer: { paddingHorizontal: 16, marginTop: 12 },
  textInput: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, fontSize: 14 },
  scannerActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  scannerBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  scannerBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  thumbCard: { position: 'relative', margin: 4, flex: 1 / 3, aspectRatio: 0.72, borderWidth: 1, borderRadius: 6 },
  thumbImage: { width: '100%', height: '100%', borderRadius: 5 },
  thumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePill: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 3 },
  footer: { padding: 16, borderTopWidth: 1 },
  compileBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  compileBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayText: { color: '#f8fafc', marginTop: 12, fontSize: 14, fontWeight: '600' },
});
