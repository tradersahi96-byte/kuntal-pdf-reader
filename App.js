import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { PDFDocument, degrees } from "pdf-lib";
import Pdf from "react-native-pdf";

const RECENT_KEY = "@kuntal_recent_v3";
const THEME_KEY = "@kuntal_theme_v3";
const BOOKMARK_KEY = "@kuntal_bookmarks_v3";

export default function App() {
  const [recent, setRecent] = useState([]);
  const [bookmarks, setBookmarks] = useState({});
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null);
  const [settings, setSettings] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolBusy, setToolBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, b, t] = await Promise.all([
          AsyncStorage.getItem(RECENT_KEY),
          AsyncStorage.getItem(BOOKMARK_KEY),
          AsyncStorage.getItem(THEME_KEY),
        ]);
        if (r) setRecent(JSON.parse(r));
        if (b) setBookmarks(JSON.parse(b));
        if (t) setDark(t === "dark");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (infoOpen) {
        setInfoOpen(false);
        return true;
      }
      if (bookmarksOpen) {
        setBookmarksOpen(false);
        return true;
      }
      if (settings) {
        setSettings(false);
        return true;
      }
      if (viewer) {
        setViewer(null);
        setFullscreen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [viewer, settings, bookmarksOpen, infoOpen]);

  const theme = dark ? darkTheme : lightTheme;

  async function saveRecent(list) {
    setRecent(list);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
  }

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const item = {
        id: `${Date.now()}`,
        name: asset.name || "Document.pdf",
        uri: asset.uri,
        addedAt: new Date().toISOString(),
        lastPage: 1,
      };

      const next = [item, ...recent.filter(x => x.uri !== item.uri)].slice(0, 50);
      await saveRecent(next);
      openRecent(item);
    } catch {
      Alert.alert("Unable to open PDF", "The PDF could not be selected.");
    }
  }

  function openRecent(item) {
    setViewer({
      ...item,
      page: item.lastPage || 1,
      pages: 0,
      scale: 1,
    });
    setPageInput(String(item.lastPage || 1));
  }

  async function updateLastPage(page) {
    if (!viewer) return;
    const next = recent.map(x =>
      x.uri === viewer.uri ? { ...x, lastPage: page } : x
    );
    await saveRecent(next);
  }

  function closeViewer() {
    setViewer(null);
    setFullscreen(false);
  }

  async function removeRecent(item) {
    Alert.alert("Delete from recent?", item.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => saveRecent(recent.filter(x => x.id !== item.id)),
      },
    ]);
  }

  async function renameRecent(item) {
    Alert.prompt(
      "Rename PDF",
      "Enter a new display name:",
      async (text) => {
        const name = text?.trim();
        if (!name) return;
        const finalName = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
        await saveRecent(
          recent.map(x => x.id === item.id ? { ...x, name: finalName } : x)
        );
        if (viewer?.id === item.id) setViewer(v => ({ ...v, name: finalName }));
      },
      "plain-text",
      item.name
    );
  }

  async function sharePdf(item) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share PDF",
        });
      } else {
        await Share.share({ message: item.uri });
      }
    } catch {}
  }

  async function readPdfBytes(uri) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  async function writePdfBytes(bytes, fileName) {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uri = `${FileSystem.cacheDirectory}${Date.now()}_${safe}`;
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    await FileSystem.writeAsStringAsync(uri, btoa(binary), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  }

  async function pickManyPdfs() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled) return [];
    return result.assets || [];
  }

  async function mergePdfs() {
    setToolBusy(true);
    try {
      const files = await pickManyPdfs();
      if (files.length < 2) {
        Alert.alert("Merge PDF", "Select at least 2 PDF files.");
        return;
      }
      const output = await PDFDocument.create();
      for (const file of files) {
        const src = await PDFDocument.load(await readPdfBytes(file.uri));
        const pages = await output.copyPages(src, src.getPageIndices());
        pages.forEach(p => output.addPage(p));
      }
      const bytes = await output.save();
      const uri = await writePdfBytes(bytes, "merged.pdf");
      const item = { id: `${Date.now()}`, name: "merged.pdf", uri, addedAt: new Date().toISOString(), lastPage: 1 };
      await saveRecent([item, ...recent.filter(x => x.uri !== uri)].slice(0, 50));
      setToolsOpen(false);
      openRecent(item);
    } catch (e) {
      Alert.alert("Merge failed", "The selected PDFs could not be merged.");
    } finally { setToolBusy(false); }
  }

  async function splitPdf() {
    if (!viewer) return;
    setToolBusy(true);
    try {
      const src = await PDFDocument.load(await readPdfBytes(viewer.uri));
      const start = Math.max(1, viewer.page);
      const end = Math.min(src.getPageCount(), viewer.page);
      const output = await PDFDocument.create();
      const pages = await output.copyPages(src, Array.from({length: end-start+1}, (_,i)=>start-1+i));
      pages.forEach(p => output.addPage(p));
      const uri = await writePdfBytes(await output.save(), `page-${start}.pdf`);
      setToolsOpen(false);
      await sharePdf({ uri, name: `page-${start}.pdf` });
      Alert.alert("PDF created", `Page ${start} was exported as a new PDF.`);
    } catch {
      Alert.alert("Split failed", "Could not export the selected page.");
    } finally { setToolBusy(false); }
  }

  async function rotateCurrentPage() {
    if (!viewer) return;
    setToolBusy(true);
    try {
      const src = await PDFDocument.load(await readPdfBytes(viewer.uri));
      const page = src.getPage(Math.max(0, viewer.page - 1));
      page.setRotation(degrees((page.getRotation().angle + 90) % 360));
      const uri = await writePdfBytes(await src.save(), `rotated-${viewer.name}`);
      setToolsOpen(false);
      await sharePdf({ uri, name: `rotated-${viewer.name}` });
      Alert.alert("Rotated PDF created", "The current page was rotated 90° and exported.");
    } catch {
      Alert.alert("Rotate failed", "Could not rotate this PDF.");
    } finally { setToolBusy(false); }
  }

  async function extractPages() {
    if (!viewer) return;
    setToolBusy(true);
    try {
      const src = await PDFDocument.load(await readPdfBytes(viewer.uri));
      const output = await PDFDocument.create();
      const indices = src.getPageIndices();
      const pages = await output.copyPages(src, indices);
      pages.forEach(p => output.addPage(p));
      const uri = await writePdfBytes(await output.save(), `copy-${viewer.name}`);
      setToolsOpen(false);
      await sharePdf({ uri, name: `copy-${viewer.name}` });
      Alert.alert("PDF copied", "A copy of the complete PDF was created.");
    } catch {
      Alert.alert("Export failed", "Could not create the PDF copy.");
    } finally { setToolBusy(false); }
  }

  async function printPdf() {
    if (!viewer) return;
    try {
      await Print.printAsync({ uri: viewer.uri });
    } catch {
      Alert.alert("Print", "Printing is not available for this file/device.");
    }
  }

  function showTools() {
    setToolsOpen(true);
  }

  function bookmarkPage(page = viewer?.page) {
    if (!viewer || !page) return;
    const key = viewer.uri;
    const pages = Array.isArray(bookmarks[key]) ? bookmarks[key] : [];
    const nextPages = pages.includes(page)
      ? pages.filter(p => p !== page)
      : [...pages, page].sort((a, b) => a - b);

    const next = { ...bookmarks, [key]: nextPages };
    setBookmarks(next);
    AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
  }

  function goToPage() {
    if (!viewer) return;
    const p = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(p) || p < 1 || (viewer.pages > 0 && p > viewer.pages)) {
      Alert.alert("Invalid page", `Enter a page between 1 and ${viewer.pages || "the last page"}.`);
      return;
    }
    setViewer(v => ({ ...v, page: p }));
  }

  function changePage(delta) {
    setViewer(v => {
      if (!v) return v;
      const next = Math.max(1, Math.min(v.pages || Infinity, v.page + delta));
      setPageInput(String(next));
      updateLastPage(next);
      return { ...v, page: next };
    });
  }

  function changeZoom(delta) {
    setViewer(v => {
      if (!v) return v;
      const scale = Math.max(0.7, Math.min(4, +(v.scale + delta).toFixed(1)));
      return { ...v, scale };
    });
  }

  const isBookmarked = viewer
    ? (bookmarks[viewer.uri] || []).includes(viewer.page)
    : false;

  const filtered = useMemo(
    () => recent.filter(x => x.name.toLowerCase().includes(query.toLowerCase())),
    [recent, query]
  );

  if (viewer) {
    return (
      <SafeAreaView style={[styles.safe, theme.bg]}>
        <StatusBar hidden={fullscreen} barStyle={dark ? "light-content" : "dark-content"} />
        {!fullscreen && (
          <>
            <View style={styles.viewerHeader}>
              <Pressable onPress={closeViewer} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, theme.text]}>‹</Text>
              </Pressable>
              <Text numberOfLines={1} style={[styles.viewerTitle, theme.text]}>
                {viewer.name}
              </Text>
              <Pressable onPress={() => sharePdf(viewer)} style={styles.headerBtn}>
                <Text style={[styles.toolText, theme.text]}>↗</Text>
              </Pressable>
              <Pressable onPress={() => bookmarkPage()} style={styles.headerBtn}>
                <Text style={styles.star}>{isBookmarked ? "★" : "☆"}</Text>
              </Pressable>
              <Pressable onPress={() => setFullscreen(true)} style={styles.headerBtn}>
                <Text style={[styles.toolText, theme.text]}>⛶</Text>
              </Pressable>
            </View>

            <View style={styles.toolbar}>
              <ToolButton label="−" onPress={() => changeZoom(-0.2)} />
              <Text style={[styles.zoomText, theme.text]}>
                {Math.round(viewer.scale * 100)}%
              </Text>
              <ToolButton label="＋" onPress={() => changeZoom(0.2)} />
              <ToolButton label="Reset" onPress={() => setViewer(v => ({ ...v, scale: 1 }))} />
              <ToolButton label="🔖" onPress={() => setBookmarksOpen(true)} />
              <ToolButton label="ⓘ" onPress={() => setInfoOpen(true)} />
              <ToolButton label="🛠" onPress={showTools} />
            </View>
          </>
        )}

        {fullscreen && (
          <Pressable onPress={() => setFullscreen(false)} style={styles.exitFullscreen}>
            <Text style={styles.exitText}>Exit full screen</Text>
          </Pressable>
        )}

        <View style={styles.pdfArea}>
          <Pdf
            source={{ uri: viewer.uri, cache: true }}
            style={styles.pdf}
            page={viewer.page}
            scale={viewer.scale}
            minScale={0.7}
            maxScale={4}
            horizontal={false}
            enablePaging={false}
            enableDoubleTapZoom
            fitPolicy={0}
            spacing={8}
            onLoadComplete={(numberOfPages) => {
              setViewer(v => v ? { ...v, pages: numberOfPages } : v);
            }}
            onPageChanged={(page, numberOfPages) => {
              setViewer(v => v ? { ...v, page, pages: numberOfPages } : v);
              setPageInput(String(page));
              updateLastPage(page);
            }}
            onError={() => {
              Alert.alert(
                "PDF error",
                "This PDF could not be rendered. It may be encrypted, corrupted, or unsupported."
              );
            }}
          />
        </View>

        {!fullscreen && (
          <View style={[styles.pageBar, theme.bg]}>
            <Pressable
              disabled={viewer.page <= 1}
              onPress={() => changePage(-1)}
              style={[styles.pageBtn, viewer.page <= 1 && styles.disabled]}
            >
              <Text style={styles.pageBtnText}>‹</Text>
            </Pressable>

            <TextInput
              value={pageInput}
              onChangeText={setPageInput}
              onSubmitEditing={goToPage}
              keyboardType="number-pad"
              returnKeyType="go"
              style={[styles.pageInput, theme.input]}
              selectTextOnFocus
            />
            <Text style={[styles.pageText, theme.text]}>
              / {viewer.pages || "…"}
            </Text>

            <Pressable
              disabled={viewer.pages > 0 && viewer.page >= viewer.pages}
              onPress={() => changePage(1)}
              style={[
                styles.pageBtn,
                viewer.pages > 0 && viewer.page >= viewer.pages && styles.disabled,
              ]}
            >
              <Text style={styles.pageBtnText}>›</Text>
            </Pressable>
          </View>
        )}

        <Modal
          visible={bookmarksOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setBookmarksOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modal, theme.card]}>
              <Text style={[styles.modalTitle, theme.text]}>Bookmarks</Text>
              {(bookmarks[viewer.uri] || []).length === 0 ? (
                <Text style={[styles.emptyText, theme.muted]}>
                  No bookmarks yet. Tap ★ on a page to bookmark it.
                </Text>
              ) : (
                <FlatList
                  data={bookmarks[viewer.uri] || []}
                  keyExtractor={p => String(p)}
                  renderItem={({ item: p }) => (
                    <Pressable
                      style={styles.bookmarkRow}
                      onPress={() => {
                        setViewer(v => ({ ...v, page: p }));
                        setPageInput(String(p));
                        setBookmarksOpen(false);
                      }}
                    >
                      <Text style={[styles.settingText, theme.text]}>Page {p}</Text>
                      <Text style={styles.star}>★</Text>
                    </Pressable>
                  )}
                />
              )}
              <Pressable onPress={() => setBookmarksOpen(false)} style={styles.close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>


        <Modal
          visible={toolsOpen}
          animationType="slide"
          transparent
          onRequestClose={() => !toolBusy && setToolsOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modal, theme.card]}>
              <Text style={[styles.modalTitle, theme.text]}>PDF Tools</Text>
              <Text style={[styles.emptyText, theme.muted]}>
                {toolBusy ? "Working… please wait." : "Tools that create or modify PDF files."}
              </Text>

              <Pressable disabled={toolBusy} style={styles.setting} onPress={mergePdfs}>
                <Text style={[styles.settingText, theme.text]}>📚 Merge PDFs</Text>
                <Text style={theme.muted}>Combine 2+ files</Text>
              </Pressable>

              <Pressable disabled={toolBusy || !viewer} style={styles.setting} onPress={splitPdf}>
                <Text style={[styles.settingText, theme.text]}>✂️ Split / Extract current page</Text>
                <Text style={theme.muted}>Create a one-page PDF</Text>
              </Pressable>

              <Pressable disabled={toolBusy || !viewer} style={styles.setting} onPress={rotateCurrentPage}>
                <Text style={[styles.settingText, theme.text]}>🔄 Rotate current page</Text>
                <Text style={theme.muted}>Rotate 90° and export</Text>
              </Pressable>

              <Pressable disabled={toolBusy || !viewer} style={styles.setting} onPress={extractPages}>
                <Text style={[styles.settingText, theme.text]}>📄 Make a PDF copy</Text>
                <Text style={theme.muted}>Export a new copy</Text>
              </Pressable>

              <Pressable disabled={toolBusy || !viewer} style={styles.setting} onPress={printPdf}>
                <Text style={[styles.settingText, theme.text]}>🖨️ Print PDF</Text>
                <Text style={theme.muted}>Open Android print dialog</Text>
              </Pressable>

              <Text style={[styles.about, theme.muted]}>
                Note: PDF operations run locally on the device. Image-to-PDF, OCR,
                compression and password encryption need additional native capabilities
                and are not falsely presented as implemented here.
              </Text>

              <Pressable disabled={toolBusy} onPress={() => setToolsOpen(false)} style={styles.close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={infoOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setInfoOpen(false)}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={[styles.infoCard, theme.card]}>
              <Text style={[styles.modalTitle, theme.text]}>PDF Information</Text>
              <InfoRow label="File" value={viewer.name} theme={theme} />
              <InfoRow label="Pages" value={String(viewer.pages || "Loading…")} theme={theme} />
              <InfoRow label="Current page" value={String(viewer.page)} theme={theme} />
              <InfoRow label="Zoom" value={`${Math.round(viewer.scale * 100)}%`} theme={theme} />
              <Pressable onPress={() => setInfoOpen(false)} style={styles.close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, theme.bg]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, theme.text]}>Kuntal PDF Reader</Text>
          <Text style={[styles.subtitle, theme.muted]}>Version 4.0</Text>
        </View>
        <Pressable onPress={() => setSettings(true)} style={styles.iconBtn}>
          <Text style={[styles.icon, theme.text]}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>K</Text></View>
            <View style={styles.heroPill}><Text style={styles.heroPillText}>PDF • READER</Text></View>
          </View>
          <Text style={styles.heroTitle}>Your PDFs, beautifully organized.</Text>
          <Text style={styles.heroSubtitle}>Read, manage, share and work with documents in one clean workspace.</Text>
          <Pressable onPress={pickPdf} style={styles.openButton}>
            <Text style={styles.openButtonText}>＋  Open PDF</Text>
          </Pressable>
        </View>

        <View style={[styles.searchWrap, theme.card]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your documents"
            placeholderTextColor={dark ? "#9ca3af" : "#8a8f98"}
            style={[styles.search, theme.searchInput]}
          />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.section, theme.text]}>Recent PDFs</Text>
            <Text style={[styles.sectionHint, theme.muted]}>Pick up where you left off</Text>
          </View>
          <View style={styles.countPill}><Text style={styles.countText}>{filtered.length}</Text></View>
        </View>

        {filtered.length === 0 ? (
          <View style={[styles.empty, theme.card]}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, theme.text]}>No recent PDFs</Text>
            <Text style={[styles.emptyText, theme.muted]}>
              Choose a PDF from your phone to start reading.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={x => x.id}
            renderItem={({ item }) => (
              <View style={[styles.row, theme.card]}>
                <Pressable onPress={() => openRecent(item)} style={styles.rowMain}>
                  <View style={styles.pdfIconBox}><Text style={styles.pdfIconText}>PDF</Text></View>
                  <View style={styles.fileMeta}>
                    <Text numberOfLines={1} style={[styles.fileName, theme.text]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.fileSub, theme.muted]}>
                      Page {item.lastPage || 1}  •  {new Date(item.addedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, theme.muted]}>›</Text>
                </Pressable>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => sharePdf(item)} style={styles.smallAction}><Text style={styles.smallActionText}>Share</Text></Pressable>
                  <Pressable onPress={() => renameRecent(item)} style={styles.moreAction}><Text style={[styles.moreActionText, theme.text]}>•••</Text></Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal
        visible={settings}
        animationType="slide"
        transparent
        onRequestClose={() => setSettings(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, theme.card]}>
            <Text style={[styles.modalTitle, theme.text]}>Settings</Text>
            <Pressable
              style={styles.setting}
              onPress={async () => {
                const next = !dark;
                setDark(next);
                await AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
              }}
            >
              <Text style={[styles.settingText, theme.text]}>Dark mode</Text>
              <Text style={theme.text}>{dark ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable
              style={styles.setting}
              onPress={() => {
                setBookmarks({});
                AsyncStorage.removeItem(BOOKMARK_KEY);
              }}
            >
              <Text style={[styles.settingText, theme.text]}>Clear all bookmarks</Text>
            </Pressable>
            <Pressable
              style={styles.setting}
              onPress={() => {
                Alert.alert("Clear recent history?", "This removes the list only; PDF files on your phone are not deleted.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                      setRecent([]);
                      AsyncStorage.removeItem(RECENT_KEY);
                    },
                  },
                ]);
              }}
            >
              <Text style={[styles.settingText, theme.text]}>Clear recent history</Text>
            </Pressable>
            <Text style={[styles.about, theme.muted]}>
              Kuntal PDF Reader 4.0{"\n"}
              Native PDF rendering with reader controls, bookmarks, zoom, page jump,
              full-screen mode, sharing and recent-file management.
            </Text>
            <Pressable onPress={() => setSettings(false)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToolButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.toolBtn}>
      <Text style={styles.toolBtnText}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value, theme }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, theme.muted]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.infoValue, theme.text]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10, flexDirection: "row", alignItems: "center" },
  brand: { fontSize: 27, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { marginTop: 3, fontSize: 13, fontWeight: "600" },
  iconBtn: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  icon: { fontSize: 21 },
  content: { flex: 1, paddingHorizontal: 20 },
  heroCard: { marginTop: 6, padding: 20, borderRadius: 27, backgroundColor: "#172554", overflow: "hidden", minHeight: 205 },
  heroGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "#2563eb", right: -65, top: -70, opacity: 0.42 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  logoMarkText: { color: "#172554", fontSize: 21, fontWeight: "900" },
  heroPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)" },
  heroPillText: { color: "#dbeafe", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 18, maxWidth: 310, letterSpacing: -0.5 },
  heroSubtitle: { color: "#cbd5e1", fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 330 },
  openButton: { marginTop: 16, backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 18, borderRadius: 15, alignItems: "center" },
  openButtonText: { color: "#172554", fontSize: 16, fontWeight: "900" },
  searchWrap: { marginTop: 15, height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)" },
  searchIcon: { fontSize: 25, color: "#64748b", marginRight: 7, marginTop: -3 },
  search: { flex: 1, paddingVertical: 0, fontSize: 15, fontWeight: "600" },
  sectionHeader: { marginTop: 21, marginBottom: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { fontSize: 21, fontWeight: "900", letterSpacing: -0.4 },
  sectionHint: { fontSize: 12, marginTop: 3, fontWeight: "600" },
  countPill: { minWidth: 32, height: 30, paddingHorizontal: 9, borderRadius: 15, backgroundColor: "#e8efff", alignItems: "center", justifyContent: "center" },
  countText: { color: "#2563eb", fontSize: 12, fontWeight: "900" },
  empty: { padding: 30, borderRadius: 20, alignItems: "center" },
  emptyIcon: { fontSize: 45 },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 10 },
  emptyText: { textAlign: "center", marginTop: 6, lineHeight: 21 },
  row: { padding: 12, borderRadius: 20, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(148,163,184,0.13)", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  pdfIconBox: { width: 49, height: 55, borderRadius: 14, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dbeafe" },
  pdfIconText: { color: "#2563eb", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  fileMeta: { flex: 1, marginLeft: 12 },
  fileName: { fontSize: 15, fontWeight: "800", letterSpacing: -0.1 },
  fileSub: { fontSize: 11, marginTop: 5, fontWeight: "600" },
  chevron: { fontSize: 27, marginHorizontal: 5 },
  rowActions: { flexDirection: "row", alignItems: "center", marginLeft: 4 },
  smallAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, backgroundColor: "#eef2ff" },
  smallActionText: { color: "#2563eb", fontSize: 11, fontWeight: "900" },
  moreAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  moreActionText: { fontSize: 14, letterSpacing: 2 },
  viewerHeader: { height: 58, paddingHorizontal: 5, flexDirection: "row", alignItems: "center" },
  headerBtn: { minWidth: 42, height: 45, alignItems: "center", justifyContent: "center" },
  headerBtnText: { fontSize: 36, fontWeight: "300" },
  viewerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800" },
  toolText: { fontSize: 21, fontWeight: "800" },
  star: { fontSize: 26 },
  toolbar: { height: 52, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  toolBtn: { minWidth: 40, height: 38, paddingHorizontal: 9, borderRadius: 10, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  toolBtnText: { fontSize: 14, fontWeight: "800", color: "#111827" },
  zoomText: { minWidth: 50, textAlign: "center", fontSize: 13, fontWeight: "800" },
  pdfArea: { flex: 1, backgroundColor: "#303030" },
  pdf: { flex: 1, width: "100%", backgroundColor: "#303030" },
  pageBar: { height: 66, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pageBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  pageBtnText: { color: "#fff", fontSize: 30, lineHeight: 32 },
  pageInput: { width: 58, height: 44, borderWidth: 1, borderRadius: 10, textAlign: "center", fontSize: 16, fontWeight: "800" },
  pageText: { fontSize: 15, fontWeight: "700", minWidth: 30 },
  disabled: { opacity: 0.35 },
  exitFullscreen: { position: "absolute", zIndex: 10, top: 12, right: 12, backgroundColor: "rgba(0,0,0,.65)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  exitText: { color: "#fff", fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.45)" },
  modalBackdropCenter: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,.45)" },
  modal: { padding: 24, borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: "80%" },
  infoCard: { padding: 24, borderRadius: 22 },
  modalTitle: { fontSize: 25, fontWeight: "900", marginBottom: 12 },
  bookmarkRow: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#ddd", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  setting: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: "#ddd", flexDirection: "row", justifyContent: "space-between" },
  settingText: { fontSize: 16, fontWeight: "700" },
  about: { marginTop: 20, lineHeight: 21 },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  infoLabel: { fontSize: 12, marginBottom: 3 },
  infoValue: { fontSize: 15, fontWeight: "700" },
  close: { marginTop: 20, padding: 15, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  closeText: { color: "#fff", fontWeight: "800" },
});

const lightTheme = {
  bg: { backgroundColor: "#f7f8fb" },
  card: { backgroundColor: "#fff" },
  text: { color: "#111827" },
  muted: { color: "#6b7280" },
  input: { backgroundColor: "#fff", borderColor: "#d1d5db", color: "#111827" },
  searchInput: { backgroundColor: "transparent", color: "#111827" },
};

const darkTheme = {
  bg: { backgroundColor: "#111827" },
  card: { backgroundColor: "#1f2937" },
  text: { color: "#f9fafb" },
  muted: { color: "#9ca3af" },
  input: { backgroundColor: "#1f2937", borderColor: "#4b5563", color: "#fff" },
  searchInput: { backgroundColor: "transparent", color: "#fff" },
};
