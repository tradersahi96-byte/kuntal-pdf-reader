import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ToolCard({ item, onPress, dark }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        dark && styles.darkCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: dark ? '#1C2A42' : item.tone }]}>
        <Text style={[styles.icon, dark && { color: '#CFE0FF' }]}>{item.icon}</Text>
      </View>
      <Text style={[styles.title, dark && { color: COLORS.DARK_TEXT }]}>{item.title}</Text>
      <Text style={[styles.subtitle, dark && { color: COLORS.DARK_MUTED }]}>{item.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - 52) / 2,
    minHeight: 188,
    backgroundColor: COLORS.CARD,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    justifyContent: 'flex-start',
    elevation: 1,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  darkCard: {
    backgroundColor: COLORS.DARK_CARD,
    borderColor: COLORS.DARK_BORDER,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  icon: {
    color: COLORS.ACCENT,
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  title: {
    color: COLORS.NAVY,
    fontWeight: FONT_WEIGHTS.extrabold,
    fontSize: FONT_SIZES.xl,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.MUTED,
    fontSize: FONT_SIZES.sm,
    lineHeight: 19,
    marginTop: SPACING.sm,
  },
});
