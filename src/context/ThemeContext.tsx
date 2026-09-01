import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@kuntal_theme_v3';

export interface ThemeColors {
  bg: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSecondary: string;
  danger: string;
  success: string;
  headerBg: string;
  statusBar: 'light-content' | 'dark-content';
}

const darkColors: ThemeColors = {
  bg: '#090d16',
  card: '#131b2e',
  cardBorder: '#1e293b',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  accent: '#0284c7',
  accentSecondary: '#0f766e',
  danger: '#ef4444',
  success: '#10b981',
  headerBg: '#0f172a',
  statusBar: 'light-content',
};

const lightColors: ThemeColors = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#94a3b8',
  accent: '#0284c7',
  accentSecondary: '#0d9488',
  danger: '#dc2626',
  success: '#059669',
  headerBg: '#ffffff',
  statusBar: 'dark-content',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved !== null) {
          setIsDark(saved === 'dark');
        } else {
          setIsDark(systemScheme === 'dark');
        }
      } catch {
        setIsDark(true);
      }
    })();
  }, [systemScheme]);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
