import React, { useState, useRef } from 'react';
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
import PdfView from 'react-native-pdf';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { fileUtils, storageUtils } from '../services/fileService';
import { pdfUtils } from '../services/pdfService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function SplitScreen({ navigation, isDark }) {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [mode, setMode] = useState('select'); // select | preview
  const [isProcessing, setIsProcessing] = useState(false);
  const pdfViewRef = useRef(null);

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedPdf({
          uri: asset.uri,
          name: asset.name,
        });
        setSelectedPages([]);
        setMode('preview');
      }
    } catch (e) {
      Alert.alert('Error', `File picker failed: ${e.message}`);
    }
  };

  const handleLoadComplete = (numberOfPages) => {
    setTotalPages(numberOfPages);
  };

  const togglePageSelection = (page) => {
    if (selectedPages.includes(page)) {
      setSelectedPages(selectedPages.filter((p) => p !== page));
    } else {
      setSelectedPages([...selectedPages, page]);
    }
  };

  const selectAllPages = () => {
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    setSelectedPages(allPages);
  };

  const deselectAllPages = () => {
    setSelectedPages([]);
  };

  const selectRange = () => {
    Alert.prompt(
      'Select Range',
      `Enter range (e.g., 1-5 or 3,5,7)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (input) => {
            try {
              let pages = [];
              if (input.includes('-')) {
                const [start, end] = input.split('-').map(Number);
                pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
              } else {
                pages = input.split(',').map((p) => parseInt(p.trim()));
              }

              const validPages = pages.filter((p) => p > 0 && p <= totalPages);
              if (validPages.length === 0) {
                Alert.alert('Invalid range');
                return;
              }

              setSelectedPages(validPages);
            } catch (e) {
              Alert.alert('Error', 'Invalid input format');
            }
          },
        },
      ]
    );
  };

  const extractPages = async () => {
    if (selectedPages.length === 0) {
      Alert.alert('Error', 'Please select at least one page');
      return;
    }

    try {
      setIsProcessing(true);
      const extractedUri = await pdfUtils.extractPages(selectedPdf.uri, selectedPages);
      const fileName = fileUtils.generateFileName('Extracted');
      const savedUri = await fileUtils.saveFile(extractedUri, fileName);

      const doc = {
        uri: savedUri,
        name: 'Extracted',
        date: new Date().toISOString(),
      };
      await storageUtils.addRecent(doc);

      Alert.alert('Success', 'Pages extracted successfully!', [
        { text: 'View', onPress: () => navigation.navigate('PDFViewer', { document: doc }) },
        { text: 'Close', onPress: () => resetForm() },
      ]);
    } catch (e) {
      Alert.alert('Error', `Extraction failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedPdf(null);
    setSelectedPages([]);
    setTotalPages(0);
    setMode('select');
  };

  const renderPageItem = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.pageButton,
        selectedPages.includes(item) && styles.pageButtonSelected,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => togglePageSelection(item)}
    >
      <Text
        style={[
          styles.pageButtonText,
          selectedPages.includes(item) && styles.pageButtonTextSelected,
        ]}
      >
        {item}
      </Text>
    </Pressable>
  );

  if (mode === 'select') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              Split PDF
            </Text>
            <Text style={[styles.headerSubtitle, isDark && { color: COLORS.DARK_MUTED }]}>
              Extract specific pages from PDF
            </Text>
          </View>

          {/* Instructions */}
          <View style={[styles.infoBox, isDark && styles.darkInfoBox]}>
            <Text style={[styles.infoTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              ℹ️ How it works
            </Text>
            <Text style={[styles.infoText, isDark && { color: COLORS.DARK_MUTED }]}>
              1. Select a PDF file{'\n'}
              2. Choose pages to extract{'\n'}
              3. Tap "Extract Pages" to save
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={pickPDF}
            >
              <Text style={styles.buttonText}>📄 Select PDF</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={[styles.previewTitle, isDark && { color: COLORS.DARK_TEXT }]}>
            {selectedPdf?.name}
          </Text>
          <Text style={[styles.previewSubtitle, isDark && { color: COLORS.DARK_MUTED }]}>
            {selectedPages.length} pages selected
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
          onPress={resetForm}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* PDF Preview */}
      <PdfView
        ref={pdfViewRef}
        source={{ uri: selectedPdf?.uri }}
        onLoadComplete={handleLoadComplete}
        style={styles.pdfPreview}
        trustAllCerts={false}
      />

      {/* Page Selection Controls */}
      <View style={[styles.controlsSection, isDark && styles.darkControlsSection]}>
        <View style={styles.controlButtons}>
          <Pressable
            style={({ pressed }) => [styles.controlButton, pressed && styles.buttonPressed]}
            onPress={selectAllPages}
          >
            <Text style={styles.controlButtonText}>Select All</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.controlButton, pressed && styles.buttonPressed]}
            onPress={deselectAllPages}
          >
            <Text style={styles.controlButtonText}>Clear All</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.controlButton, pressed && styles.buttonPressed]}
            onPress={selectRange}
          >
            <Text style={styles.controlButtonText}>Range</Text>
          </Pressable>
        </View>

        {/* Page Grid */}
        <Text style={[styles.pagesLabel, isDark && { color: COLORS.DARK_TEXT }]}>
          Select Pages
        </Text>
        <FlatList
          data={Array.from({ length: totalPages }, (_, i) => i + 1)}
          renderItem={renderPageItem}
          keyExtractor={(item) => item.toString()}
          numColumns={6}
          scrollEnabled={false}
          columnWrapperStyle={styles.pageRow}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.cancelButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={resetForm}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.extractButton,
            selectedPages.length === 0 && styles.buttonDisabled,
            isProcessing && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={extractPages}
          disabled={selectedPages.length === 0 || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Extract Pages</Text>
          )}
        </Pressable>
      </View>
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
  primaryButton: {
    backgroundColor: COLORS.ACCENT,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  previewTitle: {
    color: COLORS.NAVY,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  previewSubtitle: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.TEXT_PRIMARY,
  },
  pdfPreview: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  controlsSection: {
    backgroundColor: COLORS.CARD,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    maxHeight: 250,
  },
  darkControlsSection: {
    backgroundColor: COLORS.DARK_CARD,
    borderTopColor: COLORS.DARK_BORDER,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  controlButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  controlButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.xs,
  },
  pagesLabel: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
  },
  pageRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  pageButton: {
    width: '15%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  pageButtonSelected: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  pageButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.xs,
  },
  pageButtonTextSelected: {
    color: '#fff',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.BG,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  cancelButtonText: {
    color: COLORS.TEXT_PRIMARY,
  },
  extractButton: {
    flex: 1,
    backgroundColor: COLORS.ACCENT,
  },
});
