import React, { useState, useCallback } from 'react';
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
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { fileUtils, storageUtils } from '../services/fileService';
import { pdfUtils } from '../services/pdfService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MergeScreen({ navigation, isDark }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const newFile = {
          id: Date.now(),
          uri: asset.uri,
          name: asset.name,
        };

        // Check for duplicates
        if (selectedFiles.some((f) => f.uri === newFile.uri)) {
          Alert.alert('Warning', 'This file is already selected');
          return;
        }

        setSelectedFiles([...selectedFiles, newFile]);
      }
    } catch (e) {
      Alert.alert('Error', `File picker failed: ${e.message}`);
    }
  };

  const removeFile = (id) => {
    setSelectedFiles(selectedFiles.filter((f) => f.id !== id));
  };

  const moveFileUp = (index) => {
    if (index === 0) return;
    const newFiles = [...selectedFiles];
    [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    setSelectedFiles(newFiles);
  };

  const moveFileDown = (index) => {
    if (index === selectedFiles.length - 1) return;
    const newFiles = [...selectedFiles];
    [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    setSelectedFiles(newFiles);
  };

  const mergePDFs = async () => {
    if (selectedFiles.length < 2) {
      Alert.alert('Error', 'Please select at least 2 PDF files to merge');
      return;
    }

    try {
      setIsProcessing(true);
      const mergedUri = await pdfUtils.mergePDFs(selectedFiles.map((f) => f.uri));
      const fileName = fileUtils.generateFileName('Merged');
      const savedUri = await fileUtils.saveFile(mergedUri, fileName);

      const doc = {
        uri: savedUri,
        name: 'Merged',
        date: new Date().toISOString(),
      };
      await storageUtils.addRecent(doc);

      Alert.alert('Success', 'PDFs merged successfully!', [
        { text: 'View', onPress: () => navigation.navigate('PDFViewer', { document: doc }) },
        { text: 'Close', onPress: () => { setSelectedFiles([]); } },
      ]);
    } catch (e) {
      Alert.alert('Error', `Merge failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    Alert.alert('Clear All', 'Remove all selected files?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setSelectedFiles([]),
      },
    ]);
  };

  const renderFileItem = ({ item, index }) => (
    <View style={[styles.fileItem, isDark && styles.darkFileItem]}>
      <View style={styles.fileInfo}>
        <View style={styles.fileIndex}>
          <Text style={styles.fileIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.fileDetails}>
          <Text
            style={[styles.fileName, isDark && { color: COLORS.DARK_TEXT }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={[styles.fileSize, isDark && { color: COLORS.DARK_MUTED }]}>
            PDF Document
          </Text>
        </View>
      </View>

      <View style={styles.fileActions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            index === 0 && styles.actionButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => moveFileUp(index)}
          disabled={index === 0}
        >
          <Text style={styles.actionButtonText}>▲</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            index === selectedFiles.length - 1 && styles.actionButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => moveFileDown(index)}
          disabled={index === selectedFiles.length - 1}
        >
          <Text style={styles.actionButtonText}>▼</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.removeButton, pressed && styles.buttonPressed]}
          onPress={() => removeFile(item.id)}
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
            Merge PDFs
          </Text>
          <Text style={[styles.headerSubtitle, isDark && { color: COLORS.DARK_MUTED }]}>
            Select and arrange PDF files to merge
          </Text>
        </View>

        {/* Instructions */}
        <View style={[styles.infoBox, isDark && styles.darkInfoBox]}>
          <Text style={[styles.infoTitle, isDark && { color: COLORS.DARK_TEXT }]}>
            ℹ️ How it works
          </Text>
          <Text style={[styles.infoText, isDark && { color: COLORS.DARK_MUTED }]}>
            1. Select multiple PDF files{'\n'}
            2. Arrange them in desired order{'\n'}
            3. Tap "Merge PDFs" to combine
          </Text>
        </View>

        {/* File List */}
        {selectedFiles.length > 0 ? (
          <View style={styles.fileListContainer}>
            <View style={styles.fileListHeader}>
              <Text style={[styles.fileListTitle, isDark && { color: COLORS.DARK_TEXT }]}>
                Selected Files ({selectedFiles.length})
              </Text>
            </View>
            <FlatList
              data={selectedFiles}
              renderItem={renderFileItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        ) : (
          <View style={[styles.emptyState, isDark && styles.darkEmptyState]}>
            <Text style={styles.emptyStateIcon}>📄</Text>
            <Text style={[styles.emptyStateTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              No Files Selected
            </Text>
            <Text style={[styles.emptyStateText, isDark && { color: COLORS.DARK_MUTED }]}>
              Tap "Add PDF" to select files
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.addButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={pickPDF}
          >
            <Text style={styles.buttonText}>+ Add PDF</Text>
          </Pressable>

          {selectedFiles.length > 0 && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.clearButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={clearAll}
              >
                <Text style={[styles.buttonText, styles.clearButtonText]}>Clear All</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.mergeButton,
                  isProcessing && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={mergePDFs}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Merge PDFs</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
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
  infoBox: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.ACCENT,
  },
  darkInfoBox: {
    backgroundColor: COLORS.DARK_CARD,
  },
  infoTitle: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
    marginBottom: SPACING.sm,
  },
  infoText: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.sm,
    lineHeight: 22,
  },
  fileListContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  fileListHeader: {
    marginBottom: SPACING.md,
  },
  fileListTitle: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  fileItem: {
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
  darkFileItem: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.lg,
  },
  fileIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIndexText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  fileSize: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  fileActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: COLORS.ACCENT,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
  },
  separator: {
    height: SPACING.sm,
  },
  emptyState: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxxl,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.BORDER,
  },
  darkEmptyState: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  emptyStateIcon: {
    fontSize: FONT_SIZES.xxxl,
    marginBottom: SPACING.lg,
  },
  emptyStateTitle: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.sm,
  },
  buttonContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.base,
  },
  addButton: {
    backgroundColor: COLORS.ACCENT,
  },
  clearButton: {
    backgroundColor: COLORS.BG,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  clearButtonText: {
    color: COLORS.TEXT_PRIMARY,
  },
  mergeButton: {
    backgroundColor: COLORS.ACCENT,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
