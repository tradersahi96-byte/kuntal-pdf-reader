import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOC_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}kuntal-documents/`;
const CACHE_DIR = `${FileSystem.cacheDirectory}kuntal-cache/`;

export const fileUtils = {
  async initDirectories() {
    try {
      await FileSystem.makeDirectoryAsync(DOC_DIR, { intermediates: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    } catch (e) {
      console.warn('Directory init failed:', e);
    }
  },

  async getDocumentDirectory() {
    return DOC_DIR;
  },

  async getCacheDirectory() {
    return CACHE_DIR;
  },

  async saveFile(uri, fileName) {
    try {
      const destination = `${DOC_DIR}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: destination });
      return destination;
    } catch (e) {
      throw new Error(`Failed to save file: ${e.message}`);
    }
  },

  async deleteFile(uri) {
    try {
      await FileSystem.deleteAsync(uri);
      return true;
    } catch (e) {
      throw new Error(`Failed to delete file: ${e.message}`);
    }
  },

  async renameFile(oldUri, newName) {
    try {
      const newUri = `${DOC_DIR}${newName}`;
      const content = await FileSystem.readAsStringAsync(oldUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(newUri, content, { encoding: FileSystem.EncodingType.Base64 });
      await this.deleteFile(oldUri);
      return newUri;
    } catch (e) {
      throw new Error(`Failed to rename file: ${e.message}`);
    }
  },

  async shareFile(uri, fileName) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share ${fileName}` });
      }
    } catch (e) {
      throw new Error(`Failed to share file: ${e.message}`);
    }
  },

  async getFileSize(uri) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.size || 0;
    } catch {
      return 0;
    }
  },

  async listFiles() {
    try {
      const files = await FileSystem.readDirectoryAsync(DOC_DIR);
      return files.filter(f => f.endsWith('.pdf'));
    } catch {
      return [];
    }
  },

  async clearCache() {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      for (const file of files) {
        await FileSystem.deleteAsync(`${CACHE_DIR}${file}`);
      }
    } catch (e) {
      console.warn('Cache clear failed:', e);
    }
  },

  generateFileName(prefix = 'Document') {
    return `${prefix.replace(/[^a-z0-9-_]/gi, '_')}_${Date.now()}.pdf`;
  },
};

export const storageUtils = {
  async getRecent() {
    try {
      const r = await AsyncStorage.getItem('@kuntal_recent_v3');
      return r ? JSON.parse(r) : [];
    } catch {
      return [];
    }
  },

  async setRecent(items) {
    try {
      await AsyncStorage.setItem('@kuntal_recent_v3', JSON.stringify(items));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  },

  async addRecent(item) {
    const recent = await this.getRecent();
    const updated = [item, ...recent.filter(x => x.uri !== item.uri)].slice(0, 50);
    await this.setRecent(updated);
    return updated;
  },

  async clearRecent() {
    await this.setRecent([]);
  },

  async getTheme() {
    try {
      const t = await AsyncStorage.getItem('@kuntal_theme_v3');
      return t || 'light';
    } catch {
      return 'light';
    }
  },

  async setTheme(theme) {
    try {
      await AsyncStorage.setItem('@kuntal_theme_v3', theme);
    } catch (e) {
      console.warn('Theme storage error:', e);
    }
  },

  async getSettings() {
    try {
      const s = await AsyncStorage.getItem('@kuntal_settings_v3');
      return s ? JSON.parse(s) : { haptics: true, defaultQuality: 'medium', autoSave: true };
    } catch {
      return { haptics: true, defaultQuality: 'medium', autoSave: true };
    }
  },

  async updateSettings(updates) {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...updates };
      await AsyncStorage.setItem('@kuntal_settings_v3', JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Settings update error:', e);
    }
  },
};
