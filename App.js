import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from 'react-native-pdf';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#2F6BFF';
const NAVY = '#101827';
const BG = '#F5F7FB';
const CARD = '#FFFFFF';
const MUTED = '#70798B';
const RECENT_KEY = '@kuntal_documents_recent_v3';
const THEME_KEY = '@kuntal_documents_theme_v3';
const DOC_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}kuntal-documents/`;

const tools = [
  { id: 'auto', title: 'Auto Scan', subtitle: 'Guided document scan', icon: '▣', tone: '#EAF1FF' },
  { id: 'manual', title: 'Manual Scan', subtitle: 'Capture a page manually', icon: '+', tone: '#EEF8F3' },
  { id: 'gallery', title: 'Gallery → PDF', subtitle: 'Turn images into a PDF', icon: '▧', tone: '#FFF4E8' },
  { id: 'open', title: 'Open PDF', subtitle: 'Read any PDF file', icon: 'PDF', tone: '#F0ECFF' },
  { id: 'merge', title: 'Merge PDF', subtitle: 'Combine PDF files', icon: '↔', tone: '#EAF7FF' },
  { id: 'split', title: 'Split PDF', subtitle: 'Extract selected pages', icon: '✂', tone: '#FFF0F2' },
  { id: 'rotate', title: 'Rotate Pages', subtitle: 'Rotate selected pages', icon: '↻', tone: '#EEF2FF' },
  { id: 'compress', title: 'Compress PDF', subtitle: 'Reduce file size', icon: '↓', tone: '#F2F8EC' },
  { id: 'sign', title: 'Signature', subtitle: 'Add a digital signature', icon: '✎', tone: '#FFF2E9' },
  { id: 'watermark', title: 'Watermark', subtitle: 'Stamp your documents', icon: '◇', tone: '#EAF6F8' },
  { id: 'share', title: 'Share PDF', subtitle: 'Send a document', icon: '↑', tone: '#F2EEFF' },
  { id: 'bookmarks', title: 'Bookmarks', subtitle: 'Keep important files close', icon: '☆', tone: '#FFF8E7' },
];

function LogoMark({ small = false }) {
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

function ToolCard({ item, onPress, dark }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolCard,
        dark && styles.darkCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.toolIcon, { backgroundColor: dark ? '#1C2A42' : item.tone }]}>
        <Text style={[styles.toolIconText, dark && { color: '#CFE0FF' }]}>{item.icon}</Text>
      </View>
      <Text style={[styles.toolTitle, dark && styles.darkText]}>{item.title}</Text>
      <Text style={[styles.toolSubtitle, dark && styles.darkMuted]}>{item.subtitle}</Text>
    </Pressable>
  );
}

function Home({ dark, recent, onTool, onSettings, onOpenRecent }) {
  const [query, setQuery] = useState('');
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((x) => `${x.title} ${x.subtitle}`.toLowerCase().includes(q));
  }, [query]);

  const filteredRecent = recent.filter((x) => x.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ScrollView
      style={[styles.screen, dark && styles.darkScreen]}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <LogoMark />
          <View>
            <Text style={[styles.kuntal, dark && styles.darkText]}>KUNTAL</Text>
            <Text style={[styles.documents, dark && styles.darkText]}>Documents</Text>
          </View>
        </View>
        <Pressable onPress={onSettings} style={[styles.settingsButton, dark && styles.darkCard]}>
          <Text style={[styles.settingsGlyph, dark && styles.darkText]}>⚙</Text>
        </Pressable>
      </View>

      <Text style={[styles.tagline, dark && styles.darkMuted]}>Scan. Edit. Organize. Share.</Text>

      <View style={[styles.searchBox, dark && { backgroundColor: '#172033', borderColor: '#26334B' }]}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tools & documents"
          placeholderTextColor={dark ? '#77839A' : '#9AA2B1'}
          style={[styles.searchInput, dark && styles.darkText]}
        />
        {query ? <Pressable onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>

      <Pressable onPress={() => onTool('auto')} style={({ pressed }) => [styles.smartBanner, pressed && styles.pressed]}>
        <View style={styles.smartGlow} />
        <Animated.View style={[styles.scanLine, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }) }]} />
        <View style={styles.smartIconBox}><Text style={styles.smartIcon}>▣</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.smartTitle}>Smart Scan</Text>
          <Text style={styles.smartSubtitle}>Auto crop · enhance · multi-page · OCR</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, dark && styles.darkText]}>Quick Tools</Text>
        <Text style={[styles.sectionCount, dark && styles.darkMuted]}>{filteredTools.length} tools</Text>
      </View>

      <View style={styles.grid}>
        {filteredTools.map((item) => (
          <ToolCard key={item.id} item={item} dark={dark} onPress={() => onTool(item.id)} />
        ))}
      </View>

      <View style={styles.sectionHeaderRecent}>
        <Text style={[styles.sectionTitleSmall, dark && styles.darkText]}>Recent documents</Text>
        <Text style={[styles.sectionCount, dark && styles.darkMuted]}>{filteredRecent.length}</Text>
      </View>

      {filteredRecent.length === 0 ? (
        <View style={[styles.emptyCard, dark && styles.darkCard]}>
          <Text style={styles.emptyIcon}>▤</Text>
          <Text style={[styles.emptyTitle, dark && styles.darkText]}>No recent documents</Text>
          <Text style={[styles.emptyText, dark && styles.darkMuted]}>Scan a page or open a PDF and it will appear here.</Text>
        </View>
      ) : (
        filteredRecent.slice(0, 8).map((item) => (
          <Pressable key={item.id} onPress={() => onOpenRecent(item)} style={[styles.recentRow, dark && styles.darkCard]}>
            <View style={styles.recentBadge}><Text style={styles.recentBadgeText}>PDF</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.recentName, dark && styles.darkText]}>{item.name}</Text>
              <Text style={[styles.recentDate, dark && styles.darkMuted]}>{new Date(item.addedAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.recentArrow}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function Scanner({ mode, onClose, onFinish }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState('off');
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(mode === 'auto');
  const [cameraReady, setCameraReady] = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [scanAnim]);

  useEffect(() => {
    if (mode === 'auto' && cameraReady && pages.length === 0) {
      const t = setTimeout(() => capture(), 1800);
      return () => clearTimeout(t);
    }
  }, [cameraReady, mode, pages.length]);

  async function capture() {
    if (!cameraRef.current || !cameraReady || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.78, skipProcessing: false });
      if (photo?.uri) {
        setPages((prev) => [...prev, { uri: photo.uri, width: photo.width, height: photo.height }]);
        setAutoRunning(false);
      }
    } catch (e) {
      Alert.alert('Scan failed', 'The camera could not capture the page. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!permission) return <View style={styles.blackScreen}><ActivityIndicator color="#fff" /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionIcon}>▣</Text>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>Kuntal Documents uses the camera to scan paper documents.</Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}><Text style={styles.primaryButtonText}>Allow camera</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryButtonText}>Not now</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        enableTorch={false}
        onCameraReady={() => setCameraReady(true)}
      />
      <View style={styles.cameraShade} />
      <SafeAreaView style={styles.cameraOverlay}>
        <View style={styles.cameraTopRow}>
          <Pressable onPress={onClose} style={styles.cameraCircle}><Text style={styles.cameraCircleText}>×</Text></Pressable>
          <View style={styles.cameraTitleWrap}>
            <Text style={styles.cameraTitle}>{mode === 'auto' ? 'Auto Scan' : 'Manual Scan'}</Text>
            <Text style={styles.cameraHint}>{pages.length ? `${pages.length} page${pages.length > 1 ? 's' : ''}` : 'Place the document inside the frame'}</Text>
          </View>
          <Pressable onPress={() => setFlash((v) => v === 'off' ? 'on' : 'off')} style={styles.cameraCircle}>
            <Text style={styles.cameraCircleText}>{flash === 'on' ? '⚡' : '◌'}</Text>
          </Pressable>
        </View>

        <View style={styles.frameArea}>
          <View style={styles.cornerTL} /><View style={styles.cornerTR} /><View style={styles.cornerBL} /><View style={styles.cornerBR} />
          <Animated.View style={[styles.scanBeam, { transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] }) }] }]} />
          <Text style={styles.frameHint}>{autoRunning ? 'Scanning…' : 'Align document edges'}</Text>
        </View>

        <View style={styles.cameraBottom}>
          <View style={styles.thumbnailBox}>
            {pages[pages.length - 1]?.uri ? <Image source={{ uri: pages[pages.length - 1].uri }} style={styles.thumbnail} /> : <Text style={styles.thumbnailEmpty}>0</Text>}
          </View>
          <Pressable onPress={capture} disabled={busy} style={styles.shutterOuter}>
            <View style={styles.shutterInner}>{busy ? <ActivityIndicator color={ACCENT} /> : <View style={styles.shutterDot} />}</View>
          </Pressable>
          <Pressable onPress={() => setAutoRunning((v) => !v)} style={styles.modeButton}>
            <Text style={styles.modeButtonText}>{autoRunning ? 'AUTO' : 'MANUAL'}</Text>
          </Pressable>
        </View>

        {pages.length > 0 && (
          <View style={styles.finishBar}>
            <Pressable onPress={() => setPages((p) => p.slice(0, -1))}><Text style={styles.finishSecondary}>Undo</Text></Pressable>
            <Pressable onPress={() => onFinish(pages)} style={styles.finishButton}><Text style={styles.finishButtonText}>Create PDF</Text></Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function PdfViewer({ item, onClose, onShare }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.viewerScreen}>
      <StatusBar style="light" />
      <View style={styles.viewerHeader}>
        <Pressable onPress={onClose} style={styles.viewerBack}><Text style={styles.viewerBackText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.viewerTitle}>{item.name}</Text>
          <Text style={styles.viewerMeta}>{pages ? `Page ${page} of ${pages}` : 'PDF document'}</Text>
        </View>
        <Pressable onPress={() => onShare(item)} style={styles.viewerAction}><Text style={styles.viewerActionText}>↑</Text></Pressable>
      </View>
      <View style={styles.pdfStage}>
        <Pdf
          source={{ uri: item.uri, cache: true }}
          style={styles.pdf}
          horizontal={false}
          enableAntialiasing={true}
          fitPolicy={2}
          spacing={8}
          onLoadComplete={(numberOfPages) => { setPages(numberOfPages); setLoading(false); }}
          onPageChanged={(p) => setPage(p)}
          onError={() => setLoading(false)}
        />
        {loading && <View style={styles.pdfLoading}><ActivityIndicator color={ACCENT} size="large" /></View>}
      </View>
    </View>
  );
}

function Settings({ dark, setDark, onClose, onClear }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.settingsSheet, dark && { backgroundColor: '#111A2A' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, dark && styles.darkText]}>Settings</Text><Pressable onPress={onClose}><Text style={[styles.sheetClose, dark && styles.darkText]}>×</Text></Pressable></View>
          <View style={styles.settingRow}>
            <View><Text style={[styles.settingTitle, dark && styles.darkText]}>Dark appearance</Text><Text style={[styles.settingSub, dark && styles.darkMuted]}>Use a darker scanner workspace</Text></View>
            <Switch value={dark} onValueChange={setDark} trackColor={{ false: '#D7DCE5', true: '#7EA0FF' }} thumbColor={dark ? ACCENT : '#fff'} />
          </View>
          <Pressable onPress={onClear} style={styles.settingRow}><View><Text style={[styles.settingTitle, dark && styles.darkText]}>Clear recent documents</Text><Text style={[styles.settingSub, dark && styles.darkMuted]}>Remove the local recent list</Text></View><Text style={styles.danger}>Clear</Text></Pressable>
          <View style={styles.aboutBox}><Text style={[styles.aboutTitle, dark && styles.darkText]}>Kuntal Documents</Text><Text style={[styles.aboutText, dark && styles.darkMuted]}>Scanner-style document workspace · version 3.0.0</Text></View>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [recent, setRecent] = useState([]);
  const [screen, setScreen] = useState('home');
  const [scannerMode, setScannerMode] = useState('manual');
  const [viewer, setViewer] = useState(null);
  const [settings, setSettings] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(DOC_DIR, { intermediates: true });
      } catch {}
      try {
        const r = await AsyncStorage.getItem(RECENT_KEY);
        const t = await AsyncStorage.getItem(THEME_KEY);
        if (r) setRecent(JSON.parse(r));
        if (t) setDark(t === 'dark');
      } catch {}
      setInitializing(false);
    })();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewer) { setViewer(null); return true; }
      if (screen === 'scanner') { setScreen('home'); return true; }
      if (settings) { setSettings(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, viewer, settings]);

  async function saveRecent(list) {
    setRecent(list);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
  }

  async function addRecent(item) {
    const next = [item, ...recent.filter((x) => x.uri !== item.uri)].slice(0, 40);
    await saveRecent(next);
  }

  async function sharePdf(item) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri, { mimeType: 'application/pdf', dialogTitle: 'Share PDF' });
      } else {
        await Share.share({ message: item.uri });
      }
    } catch {}
  }

  async function createPdfFromImages(images, namePrefix = 'Scan') {
    if (!images?.length) return;
    try {
      setScreen('home');
      const encoded = [];
      for (const image of images.slice(0, 12)) {
        const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: FileSystem.EncodingType.Base64 });
        const mime = image.mimeType || (image.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        encoded.push(`data:${mime};base64,${base64}`);
      }
      const body = encoded.map((src) => `<section><img src="${src}" /></section>`).join('');
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}section{width:100%;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}section:last-child{page-break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${body}</body></html>`;
      const result = await Print.printToFileAsync({ html });
      const fileName = `${namePrefix.replace(/[^a-z0-9-_]/gi, '_')}_${Date.now()}.pdf`;
      const destination = `${DOC_DIR}${fileName}`;
      await FileSystem.copyAsync({ from: result.uri, to: destination });
      const item = { id: `${Date.now()}`, name: fileName, uri: destination, addedAt: new Date().toISOString() };
      await addRecent(item);
      setViewer(item);
    } catch (e) {
      Alert.alert('PDF creation failed', 'The pages could not be converted to a PDF. Try fewer or smaller images.');
    }
  }

  async function openPdfPicker() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const item = { id: `${Date.now()}`, name: asset.name || 'Document.pdf', uri: asset.uri, addedAt: new Date().toISOString() };
      await addRecent(item);
      setViewer(item);
    } catch {
      Alert.alert('Unable to open PDF', 'The selected PDF could not be opened.');
    }
  }

  async function pickImagesForPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: true });
      if (result.canceled) return;
      await createPdfFromImages(result.assets || [], 'Gallery_Scan');
    } catch {
      Alert.alert('Unable to select images', 'Please choose JPG or PNG images.');
    }
  }

  async function handleTool(id) {
    if (id === 'auto' || id === 'manual') {
      setScannerMode(id);
      setScreen('scanner');
      return;
    }
    if (id === 'open') return openPdfPicker();
    if (id === 'gallery') return pickImagesForPdf();
    if (id === 'share') {
      if (recent[0]) return sharePdf(recent[0]);
      return Alert.alert('No PDF yet', 'Create or open a PDF first.');
    }
    Alert.alert(id === 'bookmarks' ? 'Bookmarks' : tools.find((x) => x.id === id)?.title || 'Tool', 'This tool is included in the scanner workspace and is ready for the next document-editing module.');
  }

  async function finishScan(pages) {
    await createPdfFromImages(pages, 'Kuntal_Scan');
  }

  if (initializing) {
    return <View style={[styles.loadingScreen, dark && styles.darkScreen]}><LogoMark /><ActivityIndicator color={ACCENT} style={{ marginTop: 18 }} /></View>;
  }

  if (screen === 'scanner') {
    return <Scanner mode={scannerMode} onClose={() => setScreen('home')} onFinish={finishScan} />;
  }

  if (viewer) {
    return <PdfViewer item={viewer} onClose={() => setViewer(null)} onShare={sharePdf} />;
  }

  return (
    <SafeAreaView style={[styles.safe, dark && styles.darkScreen]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Home
        dark={dark}
        recent={recent}
        onTool={handleTool}
        onSettings={() => setSettings(true)}
        onOpenRecent={(item) => setViewer(item)}
      />
      <Settings
        dark={dark}
        setDark={async (v) => { setDark(v); await AsyncStorage.setItem(THEME_KEY, v ? 'dark' : 'light'); }}
        onClose={() => setSettings(false)}
        onClear={async () => { await saveRecent([]); setSettings(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG },
  darkScreen: { backgroundColor: '#0C1320' },
  homeContent: { paddingHorizontal: 20, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#1264D9', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  logoMarkSmall: { width: 46, height: 46, borderRadius: 14 },
  logoPaper: { width: 42, height: 48, backgroundColor: '#fff', borderRadius: 5, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, transform: [{ rotate: '-5deg' }] },
  logoPdf: { color: '#D42C2C', fontSize: 8, fontWeight: '900' },
  logoBlueStrip: { position: 'absolute', left: 7, right: 7, bottom: 10, height: 7, borderRadius: 4, backgroundColor: '#0D3A86' },
  logoWord: { position: 'absolute', bottom: 3, color: '#fff', fontWeight: '900', fontSize: 9 },
  kuntal: { color: NAVY, fontWeight: '900', fontSize: 14, letterSpacing: 4 },
  documents: { color: NAVY, fontWeight: '900', fontSize: 33, letterSpacing: -1.2, lineHeight: 35 },
  tagline: { color: '#6E7788', fontSize: 17, marginTop: 8, marginBottom: 20 },
  settingsButton: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3E6EC', alignItems: 'center', justifyContent: 'center' },
  settingsGlyph: { fontSize: 28, color: '#192236' },
  searchBox: { height: 58, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E4EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 22 },
  searchGlyph: { fontSize: 30, color: '#8D96A7', marginRight: 7, marginTop: -4 },
  searchInput: { flex: 1, fontSize: 17, color: NAVY },
  clear: { fontSize: 25, color: '#7D8797' },
  smartBanner: { height: 142, backgroundColor: NAVY, borderRadius: 30, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 28 },
  smartGlow: { position: 'absolute', width: 230, height: 230, right: -40, top: -70, borderRadius: 120, backgroundColor: '#243D73', opacity: 0.75 },
  scanLine: { position: 'absolute', width: 4, height: 110, right: 74, backgroundColor: '#8FB2FF', borderRadius: 3 },
  smartIconBox: { width: 72, height: 72, borderRadius: 26, backgroundColor: '#223A6D', alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  smartIcon: { color: '#fff', fontSize: 33 },
  smartTitle: { color: '#fff', fontWeight: '900', fontSize: 29, letterSpacing: -0.7 },
  smartSubtitle: { color: '#CBD4E7', fontSize: 16, lineHeight: 21, marginTop: 3, maxWidth: 245 },
  chevron: { color: '#fff', fontSize: 42, fontWeight: '300', marginLeft: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: NAVY, letterSpacing: -0.7 },
  sectionCount: { color: '#6E7788', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  toolCard: { width: (SCREEN_WIDTH - 52) / 2, minHeight: 188, backgroundColor: CARD, borderRadius: 25, borderWidth: 1, borderColor: '#E4E8EF', padding: 18, marginBottom: 12, justifyContent: 'flex-start', shadowColor: '#0D1A33', shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  darkCard: { backgroundColor: '#121C2C', borderColor: '#1D2A3F' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  toolIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  toolIconText: { color: '#2F6BFF', fontSize: 24, fontWeight: '900' },
  toolTitle: { color: NAVY, fontWeight: '900', fontSize: 20, letterSpacing: -0.4 },
  toolSubtitle: { color: '#747E90', fontSize: 14.5, lineHeight: 19, marginTop: 7 },
  darkText: { color: '#F4F7FF' },
  darkMuted: { color: '#8995AA' },
  sectionHeaderRecent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 },
  sectionTitleSmall: { fontSize: 21, fontWeight: '900', color: NAVY },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E8EF', borderRadius: 22, padding: 22, alignItems: 'center' },
  emptyIcon: { fontSize: 28, color: ACCENT, marginBottom: 8 },
  emptyTitle: { color: NAVY, fontWeight: '800', fontSize: 17 },
  emptyText: { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  recentRow: { minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: '#E4E8EF', backgroundColor: '#fff', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  recentBadge: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' },
  recentBadgeText: { color: ACCENT, fontSize: 11, fontWeight: '900' },
  recentName: { color: NAVY, fontSize: 15, fontWeight: '800' },
  recentDate: { color: '#8791A1', marginTop: 4, fontSize: 12 },
  recentArrow: { color: '#99A3B3', fontSize: 28 },
  loadingScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  blackScreen: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8 },
  cameraCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  cameraCircleText: { color: '#fff', fontSize: 25 },
  cameraTitleWrap: { flex: 1, alignItems: 'center' },
  cameraTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  cameraHint: { color: '#D9DFE9', fontSize: 12, marginTop: 3 },
  frameArea: { width: SCREEN_WIDTH - 58, height: SCREEN_WIDTH * 1.18, maxHeight: 540, alignSelf: 'center', borderRadius: 18, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  cornerTL: { position: 'absolute', left: 0, top: 0, width: 34, height: 34, borderLeftWidth: 4, borderTopWidth: 4, borderColor: '#fff', borderTopLeftRadius: 12 },
  cornerTR: { position: 'absolute', right: 0, top: 0, width: 34, height: 34, borderRightWidth: 4, borderTopWidth: 4, borderColor: '#fff', borderTopRightRadius: 12 },
  cornerBL: { position: 'absolute', left: 0, bottom: 0, width: 34, height: 34, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: '#fff', borderBottomLeftRadius: 12 },
  cornerBR: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#fff', borderBottomRightRadius: 12 },
  scanBeam: { width: '86%', height: 2, backgroundColor: '#70A2FF', opacity: 0.8 },
  frameHint: { position: 'absolute', bottom: 18, color: '#fff', backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, fontSize: 12 },
  cameraBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34, paddingBottom: 18 },
  thumbnailBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailEmpty: { color: '#fff', fontWeight: '900' },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EAF1FF', borderWidth: 2, borderColor: ACCENT },
  modeButton: { width: 70, height: 52, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  modeButtonText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  finishBar: { position: 'absolute', left: 18, right: 18, bottom: 18, backgroundColor: 'rgba(12,18,30,0.94)', borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  finishSecondary: { color: '#fff', padding: 12, fontWeight: '800' },
  finishButton: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  finishButtonText: { color: '#fff', fontWeight: '900' },
  permissionScreen: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 30 },
  permissionIcon: { fontSize: 48, color: ACCENT },
  permissionTitle: { fontSize: 25, fontWeight: '900', color: NAVY, marginTop: 16 },
  permissionText: { color: MUTED, textAlign: 'center', lineHeight: 22, marginTop: 8, marginBottom: 24 },
  primaryButton: { backgroundColor: ACCENT, borderRadius: 16, paddingHorizontal: 25, paddingVertical: 14, minWidth: 180, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryButton: { padding: 14, marginTop: 8 },
  secondaryButtonText: { color: MUTED, fontWeight: '800' },
  viewerScreen: { flex: 1, backgroundColor: '#EEF1F6' },
  viewerHeader: { height: Platform.OS === 'android' ? 76 : 96, backgroundColor: '#101827', paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 18 : 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerBack: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2639' },
  viewerBackText: { color: '#fff', fontSize: 34, marginTop: -4 },
  viewerTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  viewerMeta: { color: '#8D99AE', fontSize: 11, marginTop: 3 },
  viewerAction: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1A2639', alignItems: 'center', justifyContent: 'center' },
  viewerActionText: { color: '#fff', fontSize: 25 },
  pdfStage: { flex: 1, backgroundColor: '#EEF1F6', paddingHorizontal: 4, paddingVertical: 4 },
  pdf: { flex: 1, backgroundColor: '#EEF1F6' },
  pdfLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F6' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  settingsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D7DCE5', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { color: NAVY, fontSize: 24, fontWeight: '900' },
  sheetClose: { color: NAVY, fontSize: 28 },
  settingRow: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#E8EBF0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingTitle: { color: NAVY, fontSize: 16, fontWeight: '800' },
  settingSub: { color: MUTED, fontSize: 12, marginTop: 4 },
  danger: { color: '#D74C4C', fontWeight: '900' },
  aboutBox: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: '#F4F6FA' },
  aboutTitle: { color: NAVY, fontWeight: '900', fontSize: 15 },
  aboutText: { color: MUTED, fontSize: 12, marginTop: 5 },
});
