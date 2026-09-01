import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const RECENTS_KEY = '@kuntal_recent_docs_v3';
export const DOCUMENTS_DIR = `${FileSystem.documentDirectory}KuntalDocuments/`;

export interface DocumentItem {
  id: string;
  name: string;
  uri: string;
  size?: number;
  timestamp: number;
  pageCount?: number;
}

export const ensureAppDirectories = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  }
};

export const getRecentDocuments = async (): Promise<DocumentItem[]> => {
  try {
    const data = await AsyncStorage.getItem(RECENTS_KEY);
    if (!data) return [];
    
    const parsed: DocumentItem[] = JSON.parse(data);
    const verified = await Promise.all(
      parsed.map(async (doc) => {
        try {
          const info = await FileSystem.getInfoAsync(doc.uri);
          return info.exists ? doc : null;
        } catch {
          return null;
        }
      })
    );
    return verified.filter((d): d is DocumentItem => d !== null);
  } catch (error) {
    console.error('Failed to load recent docs:', error);
    return [];
  }
};

export const saveRecentDocument = async (doc: Omit<DocumentItem, 'timestamp'>): Promise<void> => {
  try {
    const recents = await getRecentDocuments();
    const updated = [
      { ...doc, timestamp: Date.now() },
      ...recents.filter((item) => item.uri !== doc.uri)
    ].slice(0, 30);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent doc:', error);
  }
};

export const deleteDocumentFromStorage = async (uri: string): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    const recents = await getRecentDocuments();
    const filtered = recents.filter((item) => item.uri !== uri);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete doc:', error);
  }
};
