import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { fileUtils, storageUtils } from '../services/fileService';
import { uploadService } from '../services/uploadService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function UploadScreen({ navigation, isDark }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = async () => {
    try {
      const history = await storageUtils.getUploadHistory();
      setUploads(history || []);
    } catch (e) {
      console.log('Error loading upload history:', e);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);

        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: fileInfo.size,
          id: Date.now(),
        });
      }
    } catch (e) {
      Alert.alert('Error', `File picker failed: ${e.message}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadUrl.trim()) {
      Alert.alert('Error', 'Please select a file and enter upload URL');
      return;
    }

    if (!uploadUrl.includes('http')) {
      Alert.alert('Error', 'Invalid URL format');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const uploadRecord = await uploadService.uploadFile(
        selectedFile.uri,
        uploadUrl,
        (progress) => {
          setUploadProgress(Math.round(progress * 100));
        }
      );

      const newUpload = {
        id: Date.now(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadUrl,
        uploadedAt: new Date().toISOString(),
        status: 'success',
      };

      const updated = [newUpload, ...uploads];
      setUploads(updated);
      await storageUtils.saveUploadHistory(updated);

      Alert.alert('Success', 'File uploaded successfully!', [
        { text: 'OK', onPress: () => resetForm() },
      ]);
    } catch (e) {
      Alert.alert('Error', `Upload failed: ${e.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setUploadUrl('');
    setUploadProgress(0);
  };

  const removeFromHistory = (id) => {
    const updated = uploads.filter((u) => u.id !== id);
    setUploads(updated);
    storageUtils.saveUploadHistory(updated);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderHistoryItem = ({ item }) => (
    <View style={[styles.historyItem, isDark && styles.darkHistoryItem]}>
      <View style={styles.historyInfo}>
        <Text style={[styles.historyFileName, isDark && { color: COLORS.DARK_TEXT }]} numberOfLines={1}>
          {item.fileName}
        </Text>
        <Text style={[styles.historyDetails, isDark && { color: COLORS.DARK_MUTED }]}>
          {formatFileSize(item.fileSize)} • {formatDate(item.uploadedAt)}
        </Text>
        <Text
          style={[styles.historyUrl, isDark && { color: COLORS.DARK_MUTED }]}
          numberOfLines={1}
        >
          {item.uploadUrl}
        </Text>
      </View>

      <View style={styles.historyActions}>
        <View style={[styles.statusBadge, item.status === 'success' && styles.statusSuccess]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.removeButton, pressed && styles.buttonPressed]}
          onPress={() => removeFromHistory(item.id)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && { color: COLORS.DARK_TEXT }]}>
            Upload PDF
          </Text>
          <Text style={[styles.headerSubtitle, isDark && { color: COLORS.DARK_MUTED }]}>
            Upload files to cloud storage
          </Text>
        </View>

        {/* Upload Section */}
        <View style={[styles.uploadCard, isDark && styles.darkUploadCard]}>
          {/* File Selection */}
          <View style={styles.fileSection}>
            <Text style={[styles.sectionTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              Selected File
            </Text>

            {selectedFile ? (
              <View style={[styles.selectedFile, isDark && styles.darkSelectedFile]}>
                <View style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>📄</Text>
                </View>
                <View style={styles.fileInfo}>
                  <Text
                    style={[styles.selectedFileName, isDark && { color: COLORS.DARK_TEXT }]}
                    numberOfLines={1}
                  >
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.selectedFileSize, isDark && { color: COLORS.DARK_MUTED }]}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.clearButton, pressed && styles.buttonPressed]}
                  onPress={() => setSelectedFile(null)}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.selectButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={pickFile}
              >
                <Text style={styles.selectButtonIcon}>📁</Text>
                <Text style={styles.selectButtonText}>Select PDF File</Text>
              </Pressable>
            )}
          </View>

          {/* URL Input */}
          <View style={styles.urlSection}>
            <Text style={[styles.sectionTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              Upload URL
            </Text>
            <Text style={[styles.urlHint, isDark && { color: COLORS.DARK_MUTED }]}>
              Enter the server endpoint URL
            </Text>
            {/* Note: In production, use TextInput */}
            <View style={[styles.urlInput, isDark && styles.darkUrlInput]}>
              <Text style={[styles.urlInputPlaceholder, !uploadUrl && styles.urlInputEmpty]}>
                {uploadUrl || 'https://api.example.com/upload'}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.urlEditButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                Alert.prompt('Upload URL', 'Enter server endpoint', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'OK',
                    onPress: (url) => setUploadUrl(url || ''),
                  },
                ]);
              }}
            >
              <Text style={styles.urlEditButtonText}>Edit</Text>
            </Pressable>
          </View>

          {/* Upload Progress */}
          {isUploading && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${uploadProgress}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, isDark && { color: COLORS.DARK_TEXT }]}>
                {uploadProgress}%
              </Text>
            </View>
          )}

          {/* Upload Button */}
          <Pressable
            style={({ pressed }) => [
              styles.uploadButton,
              (!selectedFile || !uploadUrl || isUploading) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleUpload}
            disabled={!selectedFile || !uploadUrl || isUploading}
          >
            {isUploading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>Uploading...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>📤 Upload File</Text>
            )}
          </Pressable>
        </View>

        {/* Upload History */}
        {uploads.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={[styles.historySectionTitle, isDark && { color: COLORS.DARK_TEXT }]}>
                Upload History
              </Text>
              <Text style={[styles.historyCount, isDark && { color: COLORS.DARK_MUTED }]}>
                {uploads.length}
              </Text>
            </View>

            <FlatList
              data={uploads}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  darkContainer: {
    backgroundColor: COLORS.DARK_BG,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    color: COLORS.NAVY,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.extrabold,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },
  uploadCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  darkUploadCard: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  fileSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
    marginBottom: SPACING.md,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.lg,
  },
  darkSelectedFile: {
    backgroundColor: COLORS.DARK_BG,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: FONT_SIZES.xl,
  },
  fileInfo: {
    flex: 1,
  },
  selectedFileName: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  selectedFileSize: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
  },
  selectButton: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.ACCENT,
    alignItems: 'center',
    gap: SPACING.md,
  },
  selectButtonIcon: {
    fontSize: FONT_SIZES.xxxl,
  },
  selectButtonText: {
    color: COLORS.ACCENT,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  urlSection: {
    marginBottom: SPACING.lg,
  },
  urlHint: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginBottom: SPACING.md,
  },
  urlInput: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: SPACING.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  darkUrlInput: {
    backgroundColor: COLORS.DARK_BG,
    borderColor: COLORS.DARK_BORDER,
  },
  urlInputPlaceholder: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZES.sm,
  },
  urlInputEmpty: {
    color: COLORS.MUTED,
    fontStyle: 'italic',
  },
  urlEditButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignSelf: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ACCENT,
  },
  urlEditButtonText: {
    color: COLORS.ACCENT,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.sm,
  },
  progressSection: {
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.ACCENT,
  },
  progressText: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    textAlign: 'center',
  },
  uploadButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.ACCENT,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  buttonText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  historySection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  historySectionTitle: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.lg,
  },
  historyCount: {
    color: COLORS.MUTED,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  darkHistoryItem: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  historyInfo: {
    flex: 1,
  },
  historyFileName: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  historyDetails: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  historyUrl: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginLeft: SPACING.lg,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.BG,
  },
  statusSuccess: {
    backgroundColor: '#D4EDDA',
  },
  statusText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.xs,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  separator: {
    height: SPACING.sm,
  },
});
