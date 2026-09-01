import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { fileUtils, storageUtils } from '../services/fileService';
import { pdfUtils } from '../services/pdfService';
import { scannerUtils } from '../services/scannerService';

export function ScannerScreen({ navigation, isDark }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [scans, setScans] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState('scan'); // scan | preview
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (permission?.granted === false) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      setScans([...scans, { uri: photo.uri, id: Date.now() }]);
      Alert.alert('Success', 'Image captured. Take more or create PDF.');
    } catch (e) {
      Alert.alert('Error', `Failed to capture: ${e.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const applyFilter = async (scanId, filter) => {
    try {
      setIsProcessing(true);
      const scan = scans.find((s) => s.id === scanId);
      if (!scan) return;

      const filtered = await scannerUtils.applyFilter(scan.uri, filter);
      const updated = scans.map((s) => (s.id === scanId ? { ...s, uri: filtered } : s));
      setScans(updated);
      setSelectedFilter(filter);
    } catch (e) {
      Alert.alert('Error', `Filter failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeScan = (scanId) => {
    setScans(scans.filter((s) => s.id !== scanId));
  };

  const createPdf = async () => {
    if (scans.length === 0) {
      Alert.alert('Error', 'Please capture at least one image.');
      return;
    }

    try {
      setIsProcessing(true);
      const pdfUri = await pdfUtils.createPdfFromImages(scans, 'Scan');
      const fileName = fileUtils.generateFileName('Scan');
      const savedUri = await fileUtils.saveFile(pdfUri, fileName);

      const doc = { uri: savedUri, name: fileName.replace('.pdf', ''), date: new Date().toISOString() };
      await storageUtils.addRecent(doc);

      Alert.alert('Success', 'PDF created and saved!', [
        { text: 'View', onPress: () => navigation.navigate('PDFViewer', { document: doc }) },
        { text: 'Close', onPress: () => { setScans([]); setCameraMode('scan'); } },
      ]);
    } catch (e) {
      Alert.alert('Error', `PDF creation failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, isDark && { color: COLORS.DARK_TEXT }]}>
            Camera permission is required
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      {cameraMode === 'scan' ? (
        <>
          <CameraView style={styles.camera} ref={cameraRef} facing="back" />
          <View style={[styles.controls, isDark && styles.darkControls]}>
            <Pressable
              style={({ pressed }) => [
                styles.captureButton,
                isCapturing && styles.captureButtonDisabled,
                pressed && styles.captureButtonPressed,
              ]}
              onPress={takePicture}
              disabled={isCapturing}
            >
              <Text style={styles.captureButtonText}>{isCapturing ? '⏳' : '📷'}</Text>
            </Pressable>
            {scans.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
                onPress={() => setCameraMode('preview')}
              >
                <Text style={styles.buttonText}>Review ({scans.length})</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <ScrollView style={styles.previewScroll}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, isDark && { color: COLORS.DARK_TEXT }]}>
              Preview & Enhance
            </Text>
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
              onPress={() => setCameraMode('scan')}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {/* Filters */}
          <View style={styles.filtersSection}>
            <Text style={[styles.filterLabel, isDark && { color: COLORS.DARK_TEXT }]}>Filters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {['original', 'grayscale', 'bw', 'enhance'].map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => applyFilter(scans[0]?.id, filter)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selectedFilter === filter && styles.filterChipActive,
                    isDark && styles.darkFilterChip,
                    pressed && styles.filterChipPressed,
                  ]}
                >
                  <Text style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Scans Grid */}
          <View style={styles.scansGrid}>
            {scans.map((scan, idx) => (
              <View key={scan.id} style={styles.scanItem}>
                <Image source={{ uri: scan.uri }} style={styles.scanImage} />
                <View style={styles.scanOverlay}>
                  <Pressable
                    style={({ pressed }) => [styles.removeButton, pressed && styles.buttonPressed]}
                    onPress={() => removeScan(scan.id)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.scanLabel}>Page {idx + 1}</Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={() => { setScans([]); setCameraMode('scan'); }}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Clear All</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.createPdfButton,
                isProcessing && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={createPdf}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create PDF</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
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
  camera: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.CARD,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  darkControls: {
    backgroundColor: COLORS.DARK_CARD,
    borderTopColor: COLORS.DARK_BORDER,
  },
  captureButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureButtonText: {
    fontSize: FONT_SIZES.xxl,
  },
  createButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.ACCENT,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  permissionText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.NAVY,
    textAlign: 'center',
  },
  previewScroll: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  previewTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.NAVY,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.NAVY,
  },
  filtersSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.NAVY,
    marginBottom: SPACING.md,
  },
  filterScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  filterChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.BG,
    marginRight: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  darkFilterChip: {
    backgroundColor: COLORS.DARK_CARD,
  },
  filterChipActive: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  filterChipPressed: {
    opacity: 0.85,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.TEXT_PRIMARY,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  scansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scanItem: {
    width: '48%',
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.BORDER,
  },
  scanImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scanOverlay: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
  },
  scanLabel: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semibold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
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
  createPdfButton: {
    flex: 1,
    backgroundColor: COLORS.ACCENT,
  },
});
