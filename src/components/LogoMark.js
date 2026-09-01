import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function LogoMark({ small = false, dark = false }) {
  return (
    <View style={[styles.logoMark, small && styles.logoMarkSmall]}>
      <View style={styles.logoPaper}>
        <Text style={styles.logoPdf}>PDF</Text>
      </View>
      <View style={styles.logoBlueStrip} />
      <Text style={styles.logoWord}>K</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#1264D9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  logoMarkSmall: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  logoPaper: {
    width: 42,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 7,
    transform: [{ rotate: '-5deg' }],
  },
  logoPdf: {
    color: '#D42C2C',
    fontSize: 8,
    fontWeight: '900',
  },
  logoBlueStrip: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 10,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0D3A86',
  },
  logoWord: {
    position: 'absolute',
    bottom: 3,
    color: '#fff',
    fontWeight: '900',
    fontSize: 9,
  },
});
