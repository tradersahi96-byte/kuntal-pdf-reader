import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import PdfView from 'react-native-pdf';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { fileUtils, storageUtils } from '../services/fileService';
import { pdfUtils } from '../services/pdfService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function PDFViewerScreen({ route, navigation, isDark }) {
  const { document } = route.params;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const pdfViewRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: document.name || 'Document',
      headerRight: () => (
        <Pressable onPress={handleMenu} style={{ marginRight: SPACING.lg }}>
          <Text style={{ fontSize: FONT_SIZES.xl }}>⋮</Text>
        </Pressable>
      ),
    });
  }, [navigation, document]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleLoadComplete = (numberOfPages) => {
    setTotalPages(numberOfPages);
  };

  const handleMenu = () => {
    Alert.alert('Options', 'Choose an action', [
      { text: 'Share', onPress: handleShare },
      { text: 'Rename', onPress: handleRename },
      { text: 'Delete', onPress: handleDelete, style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(document.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${document.name}`,
        });
      } else {
        Alert.alert('Sharing not available on this device');
      }
    } catch (e) {
      Alert.alert('Error', `Sharing failed: ${e.message}`);
    }
  };

  const handleRename = () => {
    Alert.prompt('Rename Document', 'Enter new name', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        onPress: async (newName) => {
          if (!newName.trim()) return;
          try {
            const newFileName = fileUtils.generateFileName(newName);
            const newUri = await fileUtils.renameFile(document.uri, newFileName);
            const updated = { ...document, uri: newUri, name: newName };
            await storageUtils.updateRecent(updated);
            navigation.setParams({ document: updated });
            Alert.alert('Success', 'Document renamed');
          } catch (e) {
            Alert.alert('Error', `Rename failed: ${e.message}`);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Document', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fileUtils.deleteFile(document.uri);
            await storageUtils.removeRecent(document);
            navigation.goBack();
            Alert.alert('Success', 'Document deleted');
          } catch (e) {
            Alert.alert('Error', `Delete failed: ${e.message}`);
          }
        },
      },
    ]);
  };

  const handleGoToPage = () => {
    Alert.prompt('Go to Page', `Enter page number (1-${totalPages})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go',
        onPress: (pageStr) => {
          const page = parseInt(pageStr);
          if (page > 0 && page <= totalPages) {
            pdfViewRef.current?.setPage(page);
            setCurrentPage(page);
          } else {
            Alert.alert('Invalid page number');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.ACCENT} />
        </View>
      )}

      <PdfView
        ref={pdfViewRef}
        source={{ uri: document.uri }}
        onLoadComplete={handleLoadComplete}
        onPageChanged={handlePageChange}
        onError={(error) => {
          Alert.alert('Error', `Failed to load PDF: ${error}`);
          navigation.goBack();
        }}
        style={styles.pdfView}
        trustAllCerts={false}
      />

      {/* Toolbar */}
      {showToolbar && (
        <View style={[styles.toolbar, isDark && styles.darkToolbar]}>
          <View style={styles.toolbarContent}>
            <View style={styles.pageInfo}>
              <Text style={[styles.pageText, isDark && { color: COLORS.DARK_TEXT }]}>
                {currentPage} / {totalPages}
              </Text>
            </View>

            <View style={styles.toolbarButtons}>
              <Pressable
                style={({ pressed }) => [styles.toolButton, pressed && styles.buttonPressed]}
                onPress={handleGoToPage}
              >
                <Text style={styles.toolButtonText}>📍</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.toolButton, pressed && styles.buttonPressed]}
                onPress={handleShare}
              >
                <Text style={styles.toolButtonText}>📤</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.toolButton, pressed && styles.buttonPressed]}
                onPress={handleMenu}
              >
                <Text style={styles.toolButtonText}>⋮</Text>
              </Pressable>
            </View>
          </View>

          {/* Page Navigation */}
          <View style={styles.pageNavigation}>
            <Pressable
              style={({ pressed }) => [
                styles.navButton,
                currentPage === 1 && styles.navButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                if (currentPage > 1) {
                  pdfViewRef.current?.setPage(currentPage - 1);
                }
              }}
              disabled={currentPage === 1}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </Pressable>

            <View style={styles.pageSlider}>
              <Text style={[styles.sliderText, isDark && { color: COLORS.DARK_MUTED }]}>
                Swipe or tap navigation
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.navButton,
                currentPage === totalPages && styles.navButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                if (currentPage < totalPages) {
                  pdfViewRef.current?.setPage(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages}
            >
              <Text style={styles.navButtonText}>›</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Toggle Toolbar */}
      <Pressable
        style={styles.toggleButton}
        onPress={() => setShowToolbar(!showToolbar)}
      >
        <Text style={styles.toggleButtonText}>{showToolbar ? '▼' : '▲'}</Text>
      </Pressable>
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
  pdfView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
  toolbar: {
    backgroundColor: COLORS.CARD,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  darkToolbar: {
    backgroundColor: COLORS.DARK_CARD,
    borderTopColor: COLORS.DARK_BORDER,
  },
  toolbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pageInfo: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.BG,
    borderRadius: BORDER_RADIUS.md,
  },
  pageText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  toolbarButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonText: {
    fontSize: FONT_SIZES.lg,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  pageNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
  },
  pageSlider: {
    flex: 1,
    alignItems: 'center',
  },
  sliderText: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  toggleButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.lg,
  },
});
