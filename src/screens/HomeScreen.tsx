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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { getRecentDocuments, deleteDocumentFromStorage, DocumentItem } from '../services/storageService';
import { importPdfFromStorage, shareDocument } from '../services/pdfService';

export const HomeScreen = ({ navigation }: any) => {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const [recents, setRecents] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

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

  const handleOpenLocalPdf = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const doc = await importPdfFromStorage();
      if (doc) {
        navigation.navigate('PdfViewer', {
          uri: doc.uri,
          title: doc.name,
        });
      }
    } catch {
      Alert.alert('Import Failed', 'Unable to import the requested PDF file.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = (item: DocumentItem) => {
    Alert.alert(
      'Delete Document',
      `Permanently delete "${item.name}" from your local storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDocumentFromStorage(item.uri);
            await loadDocuments();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <View>
          <Text style={[styles.brandSubtitle, { color: colors.accent }]}>KUNTAL DOCUMENTS 3.0</Text>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>Workspace</Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          accessibilityLabel="Toggle Theme"
        >
          <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Tools Grid */}
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
          onPress={handleOpenLocalPdf}
          disabled={isImporting}
          activeOpacity={0.85}
        >
          {isImporting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.toolIcon}>📂</Text>
              <View>
                <Text style={styles.toolTitle}>Open PDF</Text>
                <Text style={styles.toolSubtitle}>From Device Storage</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Documents</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.cardBorder }]}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>{recents.length}</Text>
        </View>
      </View>

      {/* Recents List */}
      <FlatList
        data={recents}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => navigation.navigate('PdfViewer', { uri: item.uri, title: item.name })}
            onLongPress={() => handleDelete(item)}
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
              <TouchableOpacity
                onPress={() => shareDocument(item.uri, item.name)}
                style={styles.actionBtn}
                accessibilityLabel="Share PDF"
              >
                <Text style={{ color: colors.accent, fontSize: 16 }}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.actionBtn}
                accessibilityLabel="Delete PDF"
              >
                <Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Documents Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Scan new documents using your camera or import existing PDF files from your phone.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  brandSubtitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  brandTitle: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toolsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  toolCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  toolIcon: { fontSize: 26 },
  toolTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  toolSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '600' },
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
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  docInfo: { flex: 1, marginLeft: 12 },
  docName: { fontSize: 14, fontWeight: '600' },
  docMeta: { fontSize: 12, marginTop: 3 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { padding: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 70 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 36,
    lineHeight: 18,
  },
});
