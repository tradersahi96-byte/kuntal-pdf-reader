import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, BackHandler, FlatList, Modal, Pressable, SafeAreaView,
  Share, StyleSheet, Text, TextInput, View
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import Pdf from "react-native-pdf";

const RECENT_KEY = "@kuntal_recent_v2";
const THEME_KEY = "@kuntal_theme_v2";
const BOOKMARK_KEY = "@kuntal_bookmarks_v2";

export default function App() {
  const [recent, setRecent] = useState([]);
  const [bookmarks, setBookmarks] = useState({});
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState(null);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await AsyncStorage.getItem(RECENT_KEY);
        const b = await AsyncStorage.getItem(BOOKMARK_KEY);
        const t = await AsyncStorage.getItem(THEME_KEY);
        if (r) setRecent(JSON.parse(r));
        if (b) setBookmarks(JSON.parse(b));
        if (t) setDark(t === "dark");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (viewer) {
        setViewer(null);
        return true;
      }
      if (settings) {
        setSettings(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [viewer, settings]);

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
        multiple: false
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const item = {
        id: `${Date.now()}`,
        name: asset.name || "Document.pdf",
        uri: asset.uri,
        addedAt: new Date().toISOString()
      };

      const next = [item, ...recent.filter(x => x.uri !== item.uri)].slice(0, 50);
      await saveRecent(next);
      setViewer({ ...item, page: 1, pages: 0 });
    } catch (e) {
      Alert.alert("Unable to open PDF", "The PDF could not be selected.");
    }
  }

  function openRecent(item) {
    setViewer({ ...item, page: 1, pages: 0 });
  }

  async function removeRecent(item) {
    Alert.alert("Delete from recent?", item.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => saveRecent(recent.filter(x => x.id !== item.id)) }
    ]);
  }

  async function sharePdf(item) {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(item.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share PDF"
        });
      } else {
        await Share.share({ message: item.uri });
      }
    } catch {}
  }

  function bookmarkPage() {
    if (!viewer) return;
    const key = viewer.uri;
    const pages = Array.isArray(bookmarks[key]) ? bookmarks[key] : [];
    const nextPages = pages.includes(viewer.page)
      ? pages.filter(p => p !== viewer.page)
      : [...pages, viewer.page].sort((a,b) => a-b);

    const next = { ...bookmarks, [key]: nextPages };
    setBookmarks(next);
    AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
  }

  const isBookmarked = viewer && (bookmarks[viewer.uri] || []).includes(viewer.page);

  const filtered = useMemo(
    () => recent.filter(x => x.name.toLowerCase().includes(query.toLowerCase())),
    [recent, query]
  );

  if (viewer) {
    return (
      <SafeAreaView style={[styles.safe, theme.bg]}>
        <View style={styles.viewerHeader}>
          <Pressable onPress={() => setViewer(null)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>‹</Text>
          </Pressable>
          <Text numberOfLines={1} style={[styles.viewerTitle, theme.text]}>{viewer.name}</Text>
          <Pressable onPress={bookmarkPage} style={styles.headerBtn}>
            <Text style={styles.star}>{isBookmarked ? "★" : "☆"}</Text>
          </Pressable>
        </View>

        <View style={styles.pdfArea}>
          <Pdf
            source={{ uri: viewer.uri, cache: true }}
            style={styles.pdf}
            page={viewer.page}
            horizontal={false}
            enablePaging={false}
            enableDoubleTapZoom
            onLoadComplete={(numberOfPages) => {
              setViewer(v => v ? { ...v, pages: numberOfPages } : v);
            }}
            onPageChanged={(page, numberOfPages) => {
              setViewer(v => v ? { ...v, page, pages: numberOfPages } : v);
            }}
            onError={() => {
              Alert.alert(
                "PDF error",
                "This PDF could not be rendered. It may be encrypted, corrupted, or unsupported."
              );
            }}
          />
        </View>

        <View style={styles.pageBar}>
          <Pressable
            disabled={viewer.page <= 1}
            onPress={() => setViewer(v => ({ ...v, page: Math.max(1, v.page - 1) }))}
            style={[styles.pageBtn, viewer.page <= 1 && styles.disabled]}
          >
            <Text style={styles.pageBtnText}>‹</Text>
          </Pressable>

          <Text style={[styles.pageText, theme.text]}>
            Page {viewer.page}{viewer.pages ? ` / ${viewer.pages}` : ""}
          </Text>

          <Pressable
            disabled={viewer.pages > 0 && viewer.page >= viewer.pages}
            onPress={() => setViewer(v => ({ ...v, page: v.page + 1 }))}
            style={[styles.pageBtn, viewer.pages > 0 && viewer.page >= viewer.pages && styles.disabled]}
          >
            <Text style={styles.pageBtnText}>›</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, theme.bg]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, theme.text]}>Kuntal PDF Reader</Text>
          <Text style={[styles.subtitle, theme.muted]}>Version 2.0</Text>
        </View>
        <Pressable onPress={() => setSettings(true)} style={styles.iconBtn}>
          <Text style={[styles.icon, theme.text]}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Pressable onPress={pickPdf} style={styles.openButton}>
          <Text style={styles.openButtonText}>＋  Open PDF</Text>
        </Pressable>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search recent PDF names"
          placeholderTextColor={dark ? "#9ca3af" : "#777"}
          style={[styles.search, theme.input]}
        />

        <Text style={[styles.section, theme.text]}>Recent PDFs</Text>

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
                <Text style={styles.pdfBadge}>PDF</Text>
                <Pressable onPress={() => openRecent(item)} style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.fileName, theme.text]}>{item.name}</Text>
                  <Text style={theme.muted}>{new Date(item.addedAt).toLocaleDateString()}</Text>
                </Pressable>
                <Pressable onPress={() => sharePdf(item)}>
                  <Text style={styles.action}>Share</Text>
                </Pressable>
                <Pressable onPress={() => removeRecent(item)}>
                  <Text style={styles.action}>Delete</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={settings} animationType="slide" transparent onRequestClose={() => setSettings(false)}>
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
                setRecent([]);
                AsyncStorage.removeItem(RECENT_KEY);
              }}
            >
              <Text style={[styles.settingText, theme.text]}>Clear recent history</Text>
            </Pressable>
            <Text style={[styles.about, theme.muted]}>
              Kuntal PDF Reader 2.0{"\n"}Native PDF rendering enabled through react-native-pdf.
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

const styles = StyleSheet.create({
  safe:{flex:1},
  header:{padding:20,flexDirection:"row",alignItems:"center"},
  brand:{fontSize:25,fontWeight:"900"},
  subtitle:{marginTop:3,fontSize:13},
  iconBtn:{padding:8},
  icon:{fontSize:23},
  content:{flex:1,paddingHorizontal:20},
  openButton:{backgroundColor:"#2563eb",padding:17,borderRadius:15,alignItems:"center"},
  openButtonText:{color:"#fff",fontSize:17,fontWeight:"800"},
  search:{marginTop:16,padding:14,borderWidth:1,borderRadius:12,fontSize:16},
  section:{fontSize:20,fontWeight:"800",marginTop:25,marginBottom:12},
  empty:{padding:30,borderRadius:16,alignItems:"center"},
  emptyIcon:{fontSize:45},
  emptyTitle:{fontSize:18,fontWeight:"800",marginTop:10},
  emptyText:{textAlign:"center",marginTop:6,lineHeight:21},
  row:{padding:14,borderRadius:14,marginBottom:10,flexDirection:"row",alignItems:"center",gap:10},
  pdfBadge:{fontSize:11,fontWeight:"900",borderWidth:1,borderRadius:7,padding:7},
  fileName:{fontSize:15,fontWeight:"700"},
  action:{fontSize:12,fontWeight:"800",marginLeft:3},
  viewerHeader:{height:58,paddingHorizontal:10,flexDirection:"row",alignItems:"center"},
  headerBtn:{width:45,height:45,alignItems:"center",justifyContent:"center"},
  headerBtnText:{fontSize:36,fontWeight:"300"},
  viewerTitle:{flex:1,textAlign:"center",fontSize:16,fontWeight:"800"},
  star:{fontSize:27},
  pdfArea:{flex:1,backgroundColor:"#303030"},
  pdf:{flex:1,width:"100%",backgroundColor:"#303030"},
  pageBar:{height:62,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:25},
  pageBtn:{width:44,height:44,borderRadius:12,backgroundColor:"#2563eb",alignItems:"center",justifyContent:"center"},
  pageBtnText:{color:"#fff",fontSize:30,lineHeight:32},
  pageText:{fontSize:15,fontWeight:"700"},
  disabled:{opacity:0.35},
  modalBackdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,.45)"},
  modal:{padding:24,borderTopLeftRadius:25,borderTopRightRadius:25},
  modalTitle:{fontSize:25,fontWeight:"900",marginBottom:10},
  setting:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:"#ddd",flexDirection:"row",justifyContent:"space-between"},
  settingText:{fontSize:16,fontWeight:"700"},
  about:{marginTop:20,lineHeight:21},
  close:{marginTop:20,padding:15,borderRadius:12,backgroundColor:"#2563eb",alignItems:"center"},
  closeText:{color:"#fff",fontWeight:"800"}
});
const lightTheme={bg:{backgroundColor:"#f7f8fb"},card:{backgroundColor:"#fff"},text:{color:"#111827"},muted:{color:"#6b7280"},input:{backgroundColor:"#fff",borderColor:"#d1d5db",color:"#111827"}};
const darkTheme={bg:{backgroundColor:"#111827"},card:{backgroundColor:"#1f2937"},text:{color:"#f9fafb"},muted:{color:"#9ca3af"},input:{backgroundColor:"#1f2937",borderColor:"#4b5563",color:"#fff"}};
