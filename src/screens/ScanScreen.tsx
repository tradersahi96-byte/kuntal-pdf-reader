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
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPages((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const uris = result.assets.map((a) => a.uri);
        setPages((prev) => [...prev, ...uris]);
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      Alert.alert('No Pages', 'Please add at least one scanned page.');
      return;
    }

    setLoading(true);
    try {
      const name = documentTitle.trim().length > 0 ? documentTitle : `Kuntal_Doc_${Date.now()}`;
      const pdfUri = await generatePdfFromImages(pages, name);

      navigation.replace('PdfViewer', { uri: pdfUri, title: `${name}.pdf` });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate PDF document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.cancelText, { color: colors.danger }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Document Scanner</Text>
        <View style={{ width: 45 }} />
      </View>

      <View style={styles.inputSection}>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textPrimary },
          ]}
          placeholder="Document name (e.g., Contract_July)"
          placeholderTextColor={colors.textMuted}
          value={documentTitle}
          onChangeText={setDocumentTitle}
        />
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={capturePhoto}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>📷 Camera Capture</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accentSecondary }]}
          onPress={pickFromGallery}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>🖼️ Pick Gallery</Text>
        </TouchableOpacity>
      </View>

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
              Use the camera or gallery buttons above to add pages to your document.
            </Text>
          </View>
        }
      />

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
                Compile {pages.length} Page{pages.length > 1 ? 's' : ''} to PDF
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
