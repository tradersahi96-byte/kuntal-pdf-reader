import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, SafeAreaView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';
import { LogoMark } from '../components/LogoMark';
import { ToolCard } from '../components/ToolCard';
import { fileUtils, storageUtils } from '../services/fileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function HomeScreen({ navigation, isDark }) {
  const [recentDocs, setRecentDocs] = useState([]);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    fileUtils.initDirectories();
    loadRecentDocs();
    loadDocCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentDocs();
      loadDocCount();
    }, [])
  );

  const loadRecentDocs = async () => {
    const recent = await storageUtils.getRecent();
    setRecentDocs(recent.slice(0, 3));
  };

  const loadDocCount = async () => {
    const files = await fileUtils.listFiles();
    setDocCount(files.length);
  };

  const tools = [
    {
      id: 'scan',
      icon: '📷',
      title: 'Scan',
      subtitle: 'Capture documents with camera',
      tone: '#E8F0FF',
      screen: 'Scanner',
    },
    {
      id: 'upload',
      icon: '📄',
      title: 'Upload',
      subtitle: 'Import PDFs from device',
      tone: '#FFF4E8',
      screen: 'Upload',
    },
    {
      id: 'merge',
      icon: '🔗',
      title: 'Merge',
      subtitle: 'Combine multiple PDFs',
      tone: '#F0E8FF',
      screen: 'Merge',
    },
    {
      id: 'split',
      icon: '✂️',
      title: 'Split',
      subtitle: 'Extract pages from PDF',
      tone: '#E8FFF0',
      screen: 'Split',
    },
  ];

  const handleToolPress = (tool) => {
    navigation.navigate(tool.screen);
  };

  const handleDocumentPress = (doc) => {
    navigation.navigate('PDFViewer', { document: doc });
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerArea}>
          <View style={styles.headerContent}>
            <LogoMark small={false} dark={isDark} />
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, isDark && { color: COLORS.DARK_TEXT }]}>
                Kuntal Documents
              </Text>
              <Text style={[styles.headerSubtitle, isDark && { color: COLORS.DARK_MUTED }]}>
                {docCount} documents
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={[styles.statsContainer, isDark && styles.darkStatsContainer]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, isDark && { color: COLORS.DARK_MUTED }]}>Documents</Text>
            <Text style={[styles.statValue, isDark && { color: COLORS.DARK_TEXT }]}>{docCount}</Text>
          </View>
          <View style={[styles.statDivider, isDark && { backgroundColor: COLORS.DARK_BORDER }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, isDark && { color: COLORS.DARK_MUTED }]}>Recent</Text>
            <Text style={[styles.statValue, isDark && { color: COLORS.DARK_TEXT }]}>{recentDocs.length}</Text>
          </View>
        </View>

        {/* Tools Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDark && { color: COLORS.DARK_TEXT }]}>Tools</Text>
          <View style={styles.toolsGrid}>
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                item={tool}
                onPress={() => handleToolPress(tool)}
                dark={isDark}
              />
            ))}
          </View>
        </View>

        {/* Recent Documents */}
        {recentDocs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: COLORS.DARK_TEXT }]}>Recent</Text>
            {recentDocs.map((doc, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleDocumentPress(doc)}
                style={({ pressed }) => [
                  styles.recentItem,
                  isDark && styles.darkRecentItem,
                  pressed && styles.recentItemPressed,
                ]}
              >
                <View style={[styles.recentIcon, isDark && { backgroundColor: COLORS.DARK_BORDER }]}>
                  <Text style={styles.recentIconText}>📄</Text>
                </View>
                <View style={styles.recentInfo}>
                  <Text
                    style={[styles.recentName, isDark && { color: COLORS.DARK_TEXT }]}
                    numberOfLines={1}
                  >
                    {doc.name || 'Untitled'}
                  </Text>
                  <Text style={[styles.recentDate, isDark && { color: COLORS.DARK_MUTED }]}>
                    {new Date(doc.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.recentArrow, isDark && { color: COLORS.DARK_MUTED }]}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, isDark && { color: COLORS.DARK_MUTED }]}>
            Version 3.0.0
          </Text>
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
  headerArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  headerText: {
    flex: 1,
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
    marginTop: SPACING.xs,
  },
  statsContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  darkStatsContainer: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statValue: {
    color: COLORS.NAVY,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.extrabold,
    marginTop: SPACING.sm,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.BORDER,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    color: COLORS.NAVY,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    marginBottom: SPACING.lg,
    letterSpacing: -0.3,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  darkRecentItem: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  recentItemPressed: {
    opacity: 0.85,
  },
  recentIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  recentIconText: {
    fontSize: FONT_SIZES.lg,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    color: COLORS.NAVY,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  recentDate: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  recentArrow: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.light,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    marginTop: SPACING.xxxl,
  },
  footerText: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
});
