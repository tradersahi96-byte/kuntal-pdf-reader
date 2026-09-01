import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../context/ThemeContext';
import { generatePdfFromImages } from '../services/pdfService';

export const ScanScreen = ({ navigation }: any) => {
  const { colors } = useAppTheme();
  const [pages, setPages] = useState<string[]>([]);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const capturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      Alert.alert('Camera Error', 'Could not access the camera hardware.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photos permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const selectedUris = result.assets.map((asset) => asset.uri);
        setPages((prev) => [...prev, ...selectedUris]);
      }
    } catch (e) {
      Alert.alert('Gallery Error', 'Could not access device photos.');
    }
  };

  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      Alert.alert('Empty Scan', 'Please add at least one page before generating a PDF.');
      return;
    }

    setLoading(true);
    try {
      const defaultName = `Kuntal_Doc_${Date.now()}`;
      const name = documentTitle.trim().length > 0 ? documentTitle : defaultName;
      const pdfUri = await generatePdfFromImages(pages, name);

      navigation.replace('PdfViewer', {
        uri: pdfUri,
        title: `${name}.pdf`,
      });
    } catch (err: any) {
      Alert.alert('Generation Error', err.message || 'Failed to create PDF from scanned pages.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.cancelText, { color: colors.danger }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Multi-Page Scanner</Text>
        <View style={{ width: 45 }} />
      </View>

      {/* Document Name Input */}
      <View style={styles.inputSection}>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textPrimary },
          ]}
          placeholder="Document name (e.g. Scanned_Invoice)"
          placeholderTextColor={colors.textMuted}
          value={documentTitle}
          onChangeText={setDocumentTitle}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={capturePhoto}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accentSecondary }]}
          onPress={pickFromGallery}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>🖼️ Pick Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Pages Grid */}
      <FlatList
        data={pages}
        numColumns={3}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item, index }) => (
          <View style={[styles.pageCard, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
            <Image source={{ uri: item }} style={styles.pageImage} />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setPages(pages.filter((_, i) => i !== index))}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>P. {index + 1}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Text style={[styles.emptyGridTitle, { color: colors.textSecondary }]}>No Pages Captured</Text>
            <Text style={[styles.emptyGridSub, { color: colors.textMuted }]}>
              Use the camera or gallery buttons above to compile pages for this document.
            </Text>
          </View>
        }
      />

      {/* Footer Generate CTA */}
      {pages.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.headerBg, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: colors.success }]}
            onPress={handleGeneratePdf}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.generateBtnText}>
                Save as PDF ({pages.length} {pages.length === 1 ? 'Page' : 'Pages'})
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerBtn: { padding: 6 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  inputSection: { paddingHorizontal: 16, marginTop: 12 },
  textInput: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  actionsBar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  gridContent: { padding: 12, flexGrow: 1 },
  pageCard: { position: 'relative', margin: 4, flex: 1 / 3, aspectRatio: 0.72, borderWidth: 1, borderRadius: 6 },
  pageImage: { width: '100%', height: '100%', borderRadius: 5 },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  pageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pageBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  emptyGrid: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyGridTitle: { fontSize: 16, fontWeight: '700' },
  emptyGridSub: { fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 36 },
  footer: { padding: 16, borderTopWidth: 1 },
  generateBtn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  generateBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
