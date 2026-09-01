import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { useAppTheme } from '../context/ThemeContext';
import { sharePdf, printPdf } from '../services/pdfService';

export const PdfViewerScreen = ({ route, navigation }: any) => {
  const { colors } = useAppTheme();
  const { uri, title } = route.params;

  const [base64Content, setBase64Content] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) throw new Error('File not found on local storage.');

        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (isMounted) {
          setBase64Content(b64);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to read PDF document.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      isMounted = false;
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [uri, navigation]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'PAGE_UPDATE') {
        setPageInfo({ current: data.current, total: data.total });
      }
    } catch {
      // Ignored
    }
  };

  const executeSearch = () => {
    if (!webViewRef.current || !searchQuery) return;
    webViewRef.current.injectJavaScript(`window.searchInPdf("${searchQuery}"); true;`);
  };

  const pdfJsHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, minimum-scale=1.0" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: ${colors.bg};
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 0;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .page-wrapper {
            position: relative;
            margin-bottom: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border-radius: 4px;
            background: #ffffff;
            transform: translateZ(0);
          }
          canvas {
            display: block;
            max-width: 96vw;
            height: auto;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div id="viewer"></div>
        <script>
          const raw = atob("${base64Content || ''}");
          const uint8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            uint8[i] = raw.charCodeAt(i);
          }

          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          let pdfDoc = null;
          pdfjsLib.getDocument({ data: uint8 }).promise.then(function(pdf) {
            pdfDoc = pdf;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAGE_UPDATE',
              current: 1,
              total: pdf.numPages
            }));

            const container = document.getElementById('viewer');
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const wrapper = document.createElement('div');
              wrapper.className = 'page-wrapper';
              wrapper.id = 'page-' + pageNum;

              const canvas = document.createElement('canvas');
              wrapper.appendChild(canvas);
              container.appendChild(wrapper);

              pdf.getPage(pageNum).then(function(page) {
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const ctx = canvas.getContext('2d');
                page.render({ canvasContext: ctx, viewport: viewport });
              });
            }
          }).catch(function(e) {
            document.body.innerHTML = '<div style="color:#ef4444;text-align:center;padding:24px;">Failed to render PDF document.</div>';
          });

          window.searchInPdf = function(query) {
            if (!pdfDoc || !query) return;
            const q = query.toLowerCase();
            for (let p = 1; p <= pdfDoc.numPages; p++) {
              pdfDoc.getPage(p).then(function(page) {
                page.getTextContent().then(function(tc) {
                  const text = tc.items.map(function(item) { return item.str; }).join(' ').toLowerCase();
                  if (text.includes(q)) {
                    const el = document.getElementById('page-' + p);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                });
              });
            }
          };
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title || 'Document'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSearchOpen(!searchOpen)} style={styles.iconBtn}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => printPdf(uri)} style={styles.iconBtn}>
            <Text style={{ fontSize: 16 }}>🖨️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => sharePdf(uri, title)} style={styles.iconBtn}>
            <Text style={{ fontSize: 16 }}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search keywords in PDF..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={executeSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={executeSearch} style={[styles.searchBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.searchBtnText}>Find</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Rendering Document...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionBtnText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: pdfJsHtml }}
          style={[styles.webView, { backgroundColor: colors.bg }]}
          onMessage={handleMessage}
          scalesPageToFit={true}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      )}

      <View style={[styles.footer, { backgroundColor: colors.headerBg, borderTopColor: colors.cardBorder }]}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {pageInfo.total > 0 ? `Total ${pageInfo.total} Page${pageInfo.total > 1 ? 's' : ''}` : 'Document Ready'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

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
  title: { fontSize: 16, fontWeight: '700', maxWidth: '45%' },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 15, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  searchBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  searchBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  webView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#ffffff', fontWeight: '700' },
  footer: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1 },
  footerText: { fontSize: 12, fontWeight: '600' },
});
