import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../context/ThemeContext';
import { getRecentDocuments, deleteDocumentFromStorage, DocumentItem } from '../services/storageService';
import {
  importPdfFromStorage,
  sharePdf,
  mergePdfs,
  splitPdf,
  rotatePdf,
  watermarkPdf,
} from '../services/pdfService';

export const HomeScreen = ({ navigation }: any) => {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const [recents, setRecents] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [splitStart, setSplitStart] = useState('1');
  const [splitEnd, setSplitEnd] = useState('1');
  const [watermarkModalVisible, setWatermarkModalVisible] = useState(false);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');

  const loadDocuments = async () => {
    const docs = await getRecentDocuments();
    setRecents(docs);
  };

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleOpenPdf = async () => {
    try {
      const doc = await importPdfFromStorage();
      if (doc) {
        navigation.navigate('PdfViewer', { uri: doc.uri, title: doc.name });
      }
    } catch {
      Alert.alert('Error', 'Failed to open PDF from storage.');
    }
  };

  const handleMerge = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length >= 2) {
        setLoading(true);
        setLoadingMsg('Merging selected documents...');
        const uris = res.assets.map((a) => a.uri);
        const mergedUri = await mergePdfs(uris);
        await loadDocuments();
        navigation.navigate('PdfViewer', { uri: mergedUri, title: 'Merged Document' });
      } else if (!res.canceled) {
        Alert.alert('Merge Notice', 'Please select at least 2 PDF documents.');
      }
    } catch (err: any) {
      Alert.alert('Merge Failed', err.message || 'Error occurred while merging.');
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setLoading(true);
        setLoadingMsg('Rotating pages (90°)...');
        const rotatedUri = await rotatePdf(res.assets[0].uri, 90);
        await loadDocuments();
        navigation.navigate('PdfViewer', { uri: rotatedUri, title: 'Rotated Document' });
      }
    } catch (err: any) {
      Alert.alert('Rotation Failed', err.message || 'Error rotating pages.');
    } finally {
      setLoading(false);
    }
  };

  const executeSplit = async () => {
    setSplitModalVisible(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setLoading(true);
        setLoadingMsg('Extracting pages...');
        const splitUri = await splitPdf(
          res.assets[0].uri,
          parseInt(splitStart, 10) || 1,
          parseInt(splitEnd, 10) || 1
        );
        await loadDocuments();
        navigation.navigate('PdfViewer', { uri: splitUri, title: 'Split Document' });
      }
    } catch (err: any) {
      Alert.alert('Split Failed', err.message || 'Error splitting PDF.');
    } finally {
      setLoading(false);
    }
  };

  const executeWatermark = async () => {
    setWatermarkModalVisible(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setLoading(true);
        setLoadingMsg('Applying watermark...');
        const wmUri = await watermarkPdf(res.assets[0].uri, watermarkText || 'CONFIDENTIAL');
        await loadDocuments();
        navigation.navigate('PdfViewer', { uri: wmUri, title: 'Watermarked Document' });
      }
    } catch (err: any) {
      Alert.alert('Watermark Failed', err.message || 'Error watermarking PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item: DocumentItem) => {
    Alert.alert('Delete Document', `Remove "${item.name}" from your storage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocumentFromStorage(item.uri);
          await loadDocuments();
        },
      },
    ]);
  };

  const filteredRecents = recents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <View>
          <Text style={[styles.brandSubtitle, { color: colors.accent }]}>KUNTAL DOCUMENTS</Text>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>Workspace</Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolsContainer}>
        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('Scan')}
          activeOpacity={0.85}
        >
          <Text style={styles.toolIcon}>📸</Text>
          <View>
            <Text style={styles.toolTitle}>Scan Document</Text>
            <Text style={styles.toolSubtitle}>Camera & Multi-Page</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: colors.accentSecondary }]}
          onPress={handleOpenPdf}
          activeOpacity={0.85}
        >
          <Text style={styles.toolIcon}>📂</Text>
          <View>
            <Text style={styles.toolTitle}>Open PDF</Text>
            <Text style={styles.toolSubtitle}>Device File Picker</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.quickToolsRow}>
        <TouchableOpacity
          style={[styles.quickToolBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={handleMerge}
        >
          <Text style={styles.quickToolEmoji}>📑</Text>
          <Text style={[styles.quickToolText, { color: colors.textPrimary }]}>Merge</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickToolBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => setSplitModalVisible(true)}
        >
          <Text style={styles.quickToolEmoji}>✂️</Text>
          <Text style={[styles.quickToolText, { color: colors.textPrimary }]}>Split</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickToolBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={handleRotate}
        >
          <Text style={styles.quickToolEmoji}>🔄</Text>
          <Text style={[styles.quickToolText, { color: colors.textPrimary }]}>Rotate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickToolBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => setWatermarkModalVisible(true)}
        >
          <Text style={styles.quickToolEmoji}>💧</Text>
          <Text style={[styles.quickToolText, { color: colors.textPrimary }]}>Watermark</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Documents</Text>
        <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{filteredRecents.length}</Text>
      </View>

      {recents.length > 3 && (
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textPrimary },
            ]}
            placeholder="Search recent documents..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <FlatList
        data={filteredRecents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => navigation.navigate('PdfViewer', { uri: item.uri, title: item.name })}
            activeOpacity={0.7}
          >
            <View style={styles.docIconBox}>
              <Text style={styles.docIconText}>PDF</Text>
            </View>

            <View style={styles.docInfo}>
              <Text style={[styles.docName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.docMeta, { color: colors.textMuted }]}>
                {new Date(item.timestamp).toLocaleDateString()} •{' '}
                {item.size ? `${(item.size / 1024).toFixed(0)} KB` : 'Local'}
                {item.pageCount ? ` • ${item.pageCount} pgs` : ''}
              </Text>
            </View>

            <View style={styles.docActions}>
              <TouchableOpacity onPress={() => sharePdf(item.uri, item.name)} style={styles.actionBtn}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                <Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Documents Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Scan new documents using your camera or import existing PDF files.
            </Text>
          </View>
        }
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>{loadingMsg || 'Processing...'}</Text>
        </View>
      )}

      <Modal visible={splitModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Split PDF Page Range</Text>
            <View style={styles.modalRow}>
              <TextInput
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.cardBorder }]}
                keyboardType="numeric"
                value={splitStart}
                onChangeText={setSplitStart}
                placeholder="Start"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={{ color: colors.textPrimary, marginHorizontal: 8 }}>to</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.cardBorder }]}
                keyboardType="numeric"
                value={splitEnd}
                onChangeText={setSplitEnd}
                placeholder="End"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSplitModalVisible(false)} style={styles.modalBtnCancel}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={executeSplit} style={[styles.modalBtnConfirm, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Select File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={watermarkModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Apply Watermark Text</Text>
            <TextInput
              style={[styles.modalInputFull, { color: colors.textPrimary, borderColor: colors.cardBorder }]}
              value={watermarkText}
              onChangeText={setWatermarkText}
              placeholder="e.g. CONFIDENTIAL, DRAFT"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setWatermarkModalVisible(false)} style={styles.modalBtnCancel}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={executeWatermark} style={[styles.modalBtnConfirm, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Select File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  brandSubtitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  brandTitle: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toolsContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 14 },
  toolCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 105,
    justifyContent: 'space-between',
    elevation: 3,
  },
  toolIcon: { fontSize: 24 },
  toolTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  toolSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  quickToolsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 12 },
  quickToolBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickToolEmoji: { fontSize: 18 },
  quickToolText: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 14, fontWeight: '600' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 8 },
  searchInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  docIconBox: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  docInfo: { flex: 1, marginLeft: 12 },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 12, marginTop: 3 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 36 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: '#ffffff', marginTop: 12, fontSize: 14, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 12, borderWidth: 1, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 6, padding: 8, width: 70, textAlign: 'center' },
  modalInputFull: { borderWidth: 1, borderRadius: 6, padding: 10, width: '100%', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancel: { paddingVertical: 8, paddingHorizontal: 14 },
  modalBtnConfirm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
});
