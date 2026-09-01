import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { useAppTheme } from '../context/ThemeContext';
import { shareDocument } from '../services/pdfService';

export const PdfViewerScreen = ({ route, navigation }: any) => {
  const { colors } = useAppTheme();
  const { uri, title } = route.params;
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPdfFile = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          throw new Error('PDF file does not exist on local storage.');
        }

        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (active) {
          setBase64Data(b64);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to render PDF.');
          setLoading(false);
        }
      }
    };

    loadPdfFile();

    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      active = false;
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [uri, navigation]);

  const pdfViewerHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, minimum-scale=1.0" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: ${colors.background};
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 0;
          }
          .pdf-page-canvas {
            max-width: 96vw;
            height: auto;
            margin-bottom: 14px;
            border-radius: 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            background-color: #ffffff;
          }
        </style>
      </head>
      <body>
        <div id="pdf-container"></div>
        <script>
          const rawData = atob("${base64Data || ''}");
          const uint8Array = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; i++) {
            uint8Array[i] = rawData.charCodeAt(i);
          }

          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          pdfjsLib.getDocument({ data: uint8Array }).promise.then(function(pdf) {
            const container = document.getElementById('pdf-container');
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
              pdf.getPage(pageNumber).then(function(page) {
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page-canvas';
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                container.appendChild(canvas);

                page.render({
                  canvasContext: context,
                  viewport: viewport
                });
              });
            }
          }).catch(function(err) {
            document.body.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Failed to render PDF format.</div>';
          });
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {title || 'Document Viewer'}
        </Text>
        <TouchableOpacity onPress={() => shareDocument(uri, title)} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Viewer Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading Document...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryBtnText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: pdfViewerHtml }}
          style={[styles.webView, { backgroundColor: colors.background }]}
          scalesPageToFit={true}
          bounces={false}
        />
      )}
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
  headerTitle: { fontSize: 16, fontWeight: '700', maxWidth: '60%' },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 15, fontWeight: '600' },
  webView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6 },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },
});
