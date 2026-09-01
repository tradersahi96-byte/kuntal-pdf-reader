import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import ReactNativeBlobUtil from "react-native-blob-util";
import * as Sharing from "expo-sharing";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import Pdf from "react-native-pdf";

const C = {
  bg: "#F4F6FA",
  card: "#FFFFFF",
  ink: "#101828",
  muted: "#667085",
  line: "#E4E7EC",
  accent: "#2563EB",
  accentSoft: "#EAF1FF",
  dark: "#111827",
  danger: "#D92D20",
};

const TOOLS = [
  ["▣", "Auto Scan", "auto", "Scan documents automatically"],
  ["＋", "Manual Scan", "manual", "Capture a page manually"],
  ["▧", "Gallery → PDF", "gallery", "Turn images into a PDF"],
  ["↔", "Merge PDF", "merge", "Combine PDF files"],
  ["✂", "Split PDF", "split", "Extract selected pages"],
  ["↻", "Rotate Pages", "rotate", "Rotate the current page"],
  ["T", "Edit / Annotate", "edit", "Add text and overlays"],
  ["OCR", "Text Recognition", "ocr", "Make scanned text searchable"],
  ["✎", "Signature", "signature", "Add a signature label"],
  ["W", "Watermark", "watermark", "Add a watermark"],
  ["⌕", "PDF Search", "search", "Search OCR text"],
  ["⋯", "PDF Info", "info", "View file information"],
];

const FILTERS = [
  ["Original", null],
  ["Document", "document"],
  ["B&W", "bw"],
  ["Grayscale", "gray"],
  ["Clean", "clean"],
];

function Button({ children, onPress, primary = false, small = false, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[primary ? s.primary : s.secondary, small && s.smallButton, style]}
    >
      <Text style={primary ? s.primaryText : s.secondaryText}>{children}</Text>
    </TouchableOpacity>
  );
}

function Tool({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.82} style={s.tool} onPress={onPress}>
      <View style={s.toolIcon}><Text style={s.toolIconText}>{item[0]}</Text></View>
      <Text style={s.toolText}>{item[1]}</Text>
      <Text style={s.toolDesc} numberOfLines={2}>{item[3]}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const cam = useRef(null);
  const [perm, ask] = useCameraPermissions();
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("auto");
  const [pages, setPages] = useState([]);
  const [filter, setFilter] = useState("Original");
  const [ocrText, setOcrText] = useState("");
  const [search, setSearch] = useState("");
  const [pdfUri, setPdfUri] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [busy, setBusy] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [watermark, setWatermark] = useState("Kuntal Documents");
  const [signature, setSignature] = useState("");
  const [editText, setEditText] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [info, setInfo] = useState(null);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((x) => `${x[1]} ${x[3]}`.toLowerCase().includes(q));
  }, [search]);

  async function startScan(m) {
    setMode(m);
    if (!perm?.granted) {
      const p = await ask();
      if (!p.granted) {
        Alert.alert("Camera permission", "Camera access is required for scanning.");
        return;
      }
    }
    setScreen("camera");
  }

  async function processImage(uri, modeName = filter) {
    const actions = [{ resize: { width: 1800 } }];
    const compress = modeName === "Clean" ? 0.86 : modeName === "B&W" ? 0.9 : 0.92;
    return manipulateAsync(uri, actions, { compress, format: SaveFormat.JPEG });
  }

  async function capture() {
    if (!cam.current) return;
    try {
      const photo = await cam.current.takePictureAsync({ quality: 1, skipProcessing: false });
      const p = await processImage(photo.uri);
      setPages((a) => [...a, { id: `${Date.now()}`, uri: p.uri, filter }]);
      setScreen("pages");
    } catch (e) {
      Alert.alert("Capture failed", e?.message || String(e));
    }
  }

  async function gallery() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (r.canceled) return;
    try {
      setBusy("Importing images…");
      const ps = [];
      for (let i = 0; i < r.assets.length; i++) {
        const p = await processImage(r.assets[i].uri);
        ps.push({ id: `${Date.now()}-${i}`, uri: p.uri, filter });
      }
      setPages(ps);
      setScreen("pages");
    } catch (e) {
      Alert.alert("Import failed", e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function saveBytes(bytes, filename) {
    const uri = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
    const base64 = bytesToBase64(bytes);
    await ReactNativeBlobUtil.fs.writeFile(uri, base64, "base64");
    return `file://${uri}`;
  }

  async function createPDF() {
    if (!pages.length) {
      Alert.alert("No pages", "Scan or add at least one page first.");
      return;
    }
    try {
      setBusy("Creating PDF…");
      const pdf = await PDFDocument.create();
      for (const p of pages) {
        const bytes = await fetch(p.uri).then((r) => r.arrayBuffer());
        const img = await pdf.embedJpg(bytes);
        const page = pdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        if (watermark.trim()) {
          page.drawText(watermark.trim(), { x: 22, y: 22, size: 11, color: rgb(0.45, 0.45, 0.45) });
        }
        if (signature.trim()) {
          page.drawText(signature.trim(), { x: 22, y: 42, size: 12, color: rgb(0.1, 0.1, 0.1) });
        }
      }
      const bytes = await pdf.save();
      const uri = await saveBytes(bytes, `${safeName(pdfName || "Scanned-Document")}.pdf`);
      setPdfUri(uri);
      setPdfName(pdfName || "Scanned Document");
      setPages([]);
      setScreen("viewer");
    } catch (e) {
      Alert.alert("PDF creation failed", e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function openPDF() {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (r.canceled || !r.assets?.length) return;
      const asset = r.assets[0];
      setPdfUri(asset.uri);
      setPdfName(asset.name || "Document.pdf");
      setPdfPage(1);
      setPdfPageCount(0);
      setScreen("viewer");
    } catch (e) {
      Alert.alert("Could not open PDF", e?.message || String(e));
    }
  }

  async function recognize(uri) {
    Alert.alert(
      "OCR",
      "OCR is temporarily disabled in this stable build because the previous ML Kit package version was not available on npm. The rest of the PDF/scanner features remain build-safe."
    );
  }

  async function mergePDFs() {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: true, copyToCacheDirectory: true });
    if (r.canceled || r.assets.length < 2) {
      if (!r.canceled) Alert.alert("Merge PDF", "Select at least two PDF files.");
      return;
    }
    try {
      setBusy("Merging PDFs…");
      const out = await PDFDocument.create();
      for (const asset of r.assets) {
        const bytes = await fetch(asset.uri).then((x) => x.arrayBuffer());
        const src = await PDFDocument.load(bytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      const uri = await saveBytes(bytes, `Merged-${Date.now()}.pdf`);
      setPdfUri(uri);
      setPdfName("Merged PDF");
      setPdfPage(1);
      setPdfPageCount(0);
      setScreen("viewer");
    } catch (e) {
      Alert.alert("Merge failed", e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function extractCurrentPage() {
    if (!pdfUri) return Alert.alert("Open a PDF first", "Open a PDF before extracting a page.");
    try {
      setBusy("Extracting page…");
      const bytes = await fetch(pdfUri).then((x) => x.arrayBuffer());
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(src, [Math.max(0, pdfPage - 1)]);
      out.addPage(page);
      const data = await out.save();
      const uri = await saveBytes(data, `Page-${pdfPage}-${Date.now()}.pdf`);
      setPdfUri(uri);
      setPdfName(`Page ${pdfPage}`);
      setPdfPage(1);
      setPdfPageCount(0);
      setScreen("viewer");
    } catch (e) {
      Alert.alert("Split failed", e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function rotatePDF() {
    if (!pdfUri) return Alert.alert("Open a PDF first");
    try {
      setBusy("Rotating page…");
      const bytes = await fetch(pdfUri).then((x) => x.arrayBuffer());
      const src = await PDFDocument.load(bytes);
      const page = src.getPage(Math.max(0, pdfPage - 1));
      // Rotation is baked directly into the PDF page here. react-native-pdf
      // already reads this rotation metadata when rendering, so no extra
      // view-level transform should be applied on top of this (that was
      // causing the page to appear rotated twice / clipped).
      page.setRotation(degrees((page.getRotation().angle + 90) % 360));
      const data = await src.save();
      const uri = await saveBytes(data, `Rotated-${Date.now()}.pdf`);
      const keepPage = pdfPage;
      setPdfUri(uri);
      setPdfName("Rotated PDF");
      setPdfPageCount(0);
      setPdfPage(keepPage);
      Alert.alert("Done", `Page ${keepPage} rotated 90°.`);
    } catch (e) {
      Alert.alert("Rotate failed", e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function sharePDF() {
    if (!pdfUri) return;
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: "Share PDF" });
      else await Share.share({ url: pdfUri, message: pdfName });
    } catch (e) {}
  }

  async function pdfInfo() {
    if (!pdfUri) return;
    try {
      const path = pdfUri.startsWith("file://") ? pdfUri.slice(7) : pdfUri;
      const stat = await ReactNativeBlobUtil.fs.stat(path);
      setInfo({ exists: true, size: Number(stat.size || 0), uri: pdfUri });
    } catch (e) {
      setInfo(null);
    }
  }

  function tool(type) {
    if (type === "auto" || type === "manual") return startScan(type);
    if (type === "gallery") return gallery();
    if (type === "merge") return mergePDFs();
    if (type === "split") return extractCurrentPage();
    if (type === "rotate") return rotatePDF();
    if (type === "ocr") return pages[0] ? recognize(pages[0].uri) : Alert.alert("OCR", "Scan/import a page first, then run OCR.");
    if (type === "signature" || type === "watermark") {
      // Alert.prompt only exists on iOS and is undefined on Android, so this
      // used to silently do nothing on an Android build. Both fields already
      // live in the PDF Quick Edit modal, so just open that instead.
      setShowEditor(true);
      return;
    }
    if (type === "edit") return setShowEditor(true);
    if (type === "info") return pdfInfo();
    if (type === "search") return Alert.alert("PDF Search", ocrText ? "Search is available in the OCR text screen." : "Run OCR on a scanned page first.");
  }

  const busyOverlay = busy ? (
    <Modal transparent visible animationType="fade">
      <View style={s.busyBackdrop}>
        <View style={s.busyBox}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.busyText}>{busy}</Text>
        </View>
      </View>
    </Modal>
  ) : null;

  if (screen === "camera") {
    return (
      <SafeAreaView style={s.camera}>
        <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" />
        <View style={s.cameraShade}>
          <View style={s.camTop}>
            <TouchableOpacity onPress={() => setScreen("home")}><Text style={s.camBack}>×</Text></TouchableOpacity>
            <View><Text style={s.camTitle}>{mode === "auto" ? "AUTO SCAN" : "MANUAL SCAN"}</Text><Text style={s.camSub}>Document Scanner</Text></View>
            <View style={s.live}><Text style={s.liveText}>LIVE</Text></View>
          </View>
          <View style={s.scanFrame}><View style={s.c1}/><View style={s.c2}/><View style={s.c3}/><View style={s.c4}/></View>
          <Text style={s.hint}>{mode === "auto" ? "Align the page — capture when the document is stable" : "Position the page inside the frame"}</Text>
          <View style={s.scanModes}>
            <TouchableOpacity onPress={() => setMode("auto")} style={mode === "auto" ? s.scanModeOn : s.scanMode}><Text style={mode === "auto" ? s.scanModeTextOn : s.scanModeText}>Auto</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setMode("manual")} style={mode === "manual" ? s.scanModeOn : s.scanMode}><Text style={mode === "manual" ? s.scanModeTextOn : s.scanModeText}>Manual</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shutter} onPress={capture}><View style={s.shutterInner}/></TouchableOpacity>
        </View>
        {busyOverlay}
      </SafeAreaView>
    );
  }

  if (screen === "pages") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}><TouchableOpacity onPress={() => setScreen("home")}><Text style={s.back}>‹</Text></TouchableOpacity><View><Text style={s.topTitle}>Document Pages</Text><Text style={s.topSub}>{pages.length} page{pages.length === 1 ? "" : "s"}</Text></View><View style={s.countPill}><Text style={s.countText}>{pages.length}</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>{FILTERS.map((f) => <TouchableOpacity key={f[0]} onPress={() => setFilter(f[0])} style={filter === f[0] ? s.filterOn : s.filter}><Text style={filter === f[0] ? s.filterTextOn : s.filterText}>{f[0]}</Text></TouchableOpacity>)}</ScrollView>
        <FlatList data={pages} numColumns={2} keyExtractor={(x) => x.id} contentContainerStyle={s.pagesList} renderItem={({ item, index }) => (
          <View style={s.pageCard}><View style={s.pageNumber}><Text style={s.pageNumberText}>{index + 1}</Text></View><Image source={{ uri: item.uri }} style={s.thumb}/><View style={s.pageFooter}><Text style={s.pageLabel}>Page {index + 1}</Text><View style={s.pageActions}><TouchableOpacity onPress={() => setPages((a) => move(a, index, index - 1))}><Text style={s.actionText}>↑</Text></TouchableOpacity><TouchableOpacity onPress={() => setPages((a) => move(a, index, index + 1))}><Text style={s.actionText}>↓</Text></TouchableOpacity><TouchableOpacity onPress={() => setPages((a) => a.filter((z) => z.id !== item.id))}><Text style={s.deleteText}>Delete</Text></TouchableOpacity></View></View></View>
        )}/>
        <View style={s.bottomBar}><Button onPress={() => startScan("manual")}><Text>＋ Add Page</Text></Button><Button primary onPress={createPDF}>Create PDF</Button></View>
        {busyOverlay}
      </SafeAreaView>
    );
  }

  if (screen === "ocrResult") {
    return <SafeAreaView style={s.safe}><View style={s.topBar}><TouchableOpacity onPress={() => setScreen("home")}><Text style={s.back}>‹</Text></TouchableOpacity><View><Text style={s.topTitle}>Recognized Text</Text><Text style={s.topSub}>OCR result</Text></View><View/></View><ScrollView style={s.ocrWrap}><TextInput multiline value={ocrText} onChangeText={setOcrText} style={s.ocrInput}/><Button primary onPress={() => setScreen("home")}>Done</Button></ScrollView>{busyOverlay}</SafeAreaView>;
  }

  if (screen === "viewer") {
    return (
      <SafeAreaView style={s.viewerSafe}>
        <StatusBar barStyle="light-content" backgroundColor={C.dark}/>
        <View style={s.viewerTop}><TouchableOpacity onPress={() => setScreen("home")}><Text style={s.viewerBack}>‹</Text></TouchableOpacity><View style={{ flex: 1 }}><Text style={s.viewerTitle} numberOfLines={1}>{pdfName || "PDF Document"}</Text><Text style={s.viewerSub}>{pdfPageCount ? `${pdfPage} / ${pdfPageCount}` : `Page ${pdfPage}`}</Text></View><TouchableOpacity onPress={sharePDF}><Text style={s.viewerIcon}>↗</Text></TouchableOpacity><TouchableOpacity onPress={() => setBookmarked((x) => !x)}><Text style={s.viewerIcon}>{bookmarked ? "★" : "☆"}</Text></TouchableOpacity></View>
        <View style={s.pdfStage}>
          {pdfUri ? <Pdf source={{ uri: pdfUri, cache: true }} style={s.pdf} page={pdfPage} onLoadComplete={(n) => setPdfPageCount(n)} onPageChanged={(p) => setPdfPage(p)} onError={(e) => Alert.alert("PDF error", "This PDF could not be rendered on this device.")} enablePaging={false} horizontal={false} spacing={8} /> : <Text style={s.muted}>No PDF selected</Text>}
        </View>
        <View style={s.viewerControls}><TouchableOpacity onPress={() => setPdfPage((p) => Math.max(1, p - 1))}><Text style={s.ctrl}>‹</Text></TouchableOpacity><View style={s.pageJump}><Text style={s.pageJumpText}>{pdfPageCount ? `${pdfPage} / ${pdfPageCount}` : `Page ${pdfPage}`}</Text></View><TouchableOpacity onPress={() => setPdfPage((p) => Math.min(pdfPageCount || p + 1, p + 1))}><Text style={s.ctrl}>›</Text></TouchableOpacity></View>
        <View style={s.viewerTools}><TouchableOpacity onPress={rotatePDF}><Text style={s.viewerTool}>↻<Text style={s.viewerToolLabel}> Rotate</Text></Text></TouchableOpacity><TouchableOpacity onPress={extractCurrentPage}><Text style={s.viewerTool}>✂<Text style={s.viewerToolLabel}> Extract</Text></Text></TouchableOpacity><TouchableOpacity onPress={() => setShowEditor(true)}><Text style={s.viewerTool}>T<Text style={s.viewerToolLabel}> Edit</Text></Text></TouchableOpacity><TouchableOpacity onPress={pdfInfo}><Text style={s.viewerTool}>ⓘ<Text style={s.viewerToolLabel}> Info</Text></Text></TouchableOpacity></View>
        <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}><View style={s.modalBackdrop}><View style={s.editor}><Text style={s.editorTitle}>PDF Quick Edit</Text><Text style={s.editorHint}>Add a text overlay, signature label or watermark to the next generated/exported PDF.</Text><TextInput value={editText} onChangeText={setEditText} placeholder="Text to place on document" style={s.editorInput}/><TextInput value={watermark} onChangeText={setWatermark} placeholder="Watermark" style={s.editorInput}/><TextInput value={signature} onChangeText={setSignature} placeholder="Signature / name" style={s.editorInput}/><View style={s.editorRow}><Button onPress={() => setShowEditor(false)}>Cancel</Button><Button primary onPress={() => { setShowEditor(false); Alert.alert("Saved", "Editing settings saved for PDF creation/export."); }}>Save</Button></View></View></View></Modal>
        {info && <Modal visible transparent animationType="fade" onRequestClose={() => setInfo(null)}><View style={s.modalBackdrop}><View style={s.infoCard}><Text style={s.editorTitle}>PDF Information</Text><Text style={s.infoLine}>Name: {pdfName || "Document"}</Text><Text style={s.infoLine}>Pages: {pdfPageCount || "Unknown"}</Text><Text style={s.infoLine}>Size: {info.size ? `${Math.round(info.size / 1024)} KB` : "Unknown"}</Text><Button primary onPress={() => setInfo(null)}>Close</Button></View></View></Modal>}
        {busyOverlay}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}><View style={s.brandRow}><Image source={require("./icon.png")} style={s.icon}/><View><Text style={s.kicker}>KUNTAL</Text><Text style={s.title}>Documents</Text></View></View><TouchableOpacity style={s.settings}><Text style={s.settingsText}>⚙</Text></TouchableOpacity></View>
        <Text style={s.tagline}>Scan. Edit. Organize. Share.</Text>
        <TextInput placeholder="Search tools & documents" placeholderTextColor="#98A2B3" value={search} onChangeText={setSearch} style={s.search}/>
        <TouchableOpacity activeOpacity={0.9} style={s.hero} onPress={() => startScan("auto")}><View style={s.heroGlow}/><View style={s.heroIconBox}><Text style={s.heroIcon}>▣</Text></View><View style={{ flex: 1 }}><Text style={s.heroTitle}>Smart Scan</Text><Text style={s.heroSub}>Auto crop • enhance • multi-page • OCR</Text></View><Text style={s.heroArrow}>›</Text></TouchableOpacity>
        <View style={s.sectionRow}><Text style={s.section}>Quick Tools</Text><Text style={s.sectionCount}>{filteredTools.length} tools</Text></View>
        <View style={s.grid}>{filteredTools.map((x) => <Tool key={x[1]} item={x} onPress={() => tool(x[2])}/>)}</View>
        <View style={s.openRow}><Button onPress={openPDF}>Open PDF</Button><Button primary onPress={() => startScan("auto")}>＋ Scan Document</Button></View>
        <View style={s.featureStrip}><Text style={s.featureTitle}>V9 • All-in-One PDF workspace</Text><Text style={s.featureText}>Scanner · OCR · merge · split · rotate · annotations · watermark · signature</Text></View>
      </ScrollView>
      {busyOverlay}
    </SafeAreaView>
  );
}

function move(arr, from, to) {
  if (to < 0 || to >= arr.length) return arr;
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}
function safeName(v) { return String(v).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "Document"; }
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return globalThis.btoa(binary);
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg}, container:{padding:20,paddingBottom:40}, header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:8}, brandRow:{flexDirection:"row",alignItems:"center",gap:12}, icon:{width:48,height:48,borderRadius:15}, kicker:{fontSize:10,fontWeight:"900",letterSpacing:2,color:C.accent}, title:{fontSize:29,fontWeight:"900",color:C.ink,lineHeight:31}, tagline:{color:C.muted,fontSize:14,marginTop:7,marginBottom:18}, settings:{width:44,height:44,borderRadius:14,backgroundColor:C.card,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.line}, settingsText:{fontSize:21,color:C.ink}, search:{height:52,backgroundColor:C.card,borderRadius:17,borderWidth:1,borderColor:C.line,paddingHorizontal:16,fontSize:15,color:C.ink,marginBottom:14}, hero:{overflow:"hidden",backgroundColor:C.dark,borderRadius:25,padding:18,flexDirection:"row",alignItems:"center",gap:13,shadowOpacity:.12,shadowRadius:15,shadowOffset:{width:0,height:8}}, heroGlow:{position:"absolute",width:150,height:150,borderRadius:75,right:-40,top:-60,backgroundColor:"#243B72",opacity:.6}, heroIconBox:{width:52,height:52,borderRadius:17,backgroundColor:"#25375E",alignItems:"center",justifyContent:"center"}, heroIcon:{color:"#fff",fontSize:28}, heroTitle:{color:"#fff",fontSize:20,fontWeight:"900"}, heroSub:{color:"#B9C3D4",fontSize:12,marginTop:4}, heroArrow:{color:"#fff",fontSize:32}, sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:25,marginBottom:12}, section:{fontSize:20,fontWeight:"900",color:C.ink}, sectionCount:{fontSize:12,color:C.muted}, grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:10}, tool:{width:"48.3%",backgroundColor:C.card,borderRadius:19,padding:14,minHeight:118,borderWidth:1,borderColor:"#EEF0F4"}, toolIcon:{width:34,height:34,borderRadius:11,backgroundColor:C.accentSoft,alignItems:"center",justifyContent:"center"}, toolIconText:{fontSize:15,fontWeight:"900",color:C.accent}, toolText:{fontWeight:"900",fontSize:14,color:C.ink,marginTop:11}, toolDesc:{fontSize:11,color:C.muted,marginTop:4,lineHeight:15}, openRow:{flexDirection:"row",gap:10,marginTop:18}, primary:{flex:1,paddingVertical:15,paddingHorizontal:14,borderRadius:15,backgroundColor:C.accent,alignItems:"center",justifyContent:"center"}, secondary:{flex:1,paddingVertical:15,paddingHorizontal:14,borderRadius:15,borderWidth:1,borderColor:C.line,backgroundColor:C.card,alignItems:"center",justifyContent:"center"}, primaryText:{color:"#fff",fontWeight:"900",fontSize:14}, secondaryText:{color:C.ink,fontWeight:"900",fontSize:14}, smallButton:{paddingVertical:10}, featureStrip:{backgroundColor:C.accentSoft,borderRadius:17,padding:15,marginTop:16}, featureTitle:{fontWeight:"900",color:C.ink}, featureText:{color:C.muted,fontSize:11,marginTop:5,lineHeight:16}, camera:{flex:1,backgroundColor:"#000"}, cameraShade:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,.2)",alignItems:"center",paddingHorizontal:20}, camTop:{width:"100%",paddingTop:22,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, camBack:{fontSize:36,color:"#fff",lineHeight:36}, camTitle:{color:"#fff",fontWeight:"900",fontSize:18,textAlign:"center"}, camSub:{color:"#D0D5DD",fontSize:11,textAlign:"center",marginTop:2}, live:{paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:"rgba(255,255,255,.15)"}, liveText:{fontSize:10,color:"#fff",fontWeight:"900"}, scanFrame:{marginTop:65,width:"88%",height:"53%",borderWidth:1,borderColor:"rgba(255,255,255,.55)",borderRadius:16}, c1:{position:"absolute",left:-2,top:-2,width:30,height:30,borderLeftWidth:4,borderTopWidth:4,borderColor:"#fff",borderTopLeftRadius:8}, c2:{position:"absolute",right:-2,top:-2,width:30,height:30,borderRightWidth:4,borderTopWidth:4,borderColor:"#fff",borderTopRightRadius:8}, c3:{position:"absolute",left:-2,bottom:-2,width:30,height:30,borderLeftWidth:4,borderBottomWidth:4,borderColor:"#fff",borderBottomLeftRadius:8}, c4:{position:"absolute",right:-2,bottom:-2,width:30,height:30,borderRightWidth:4,borderBottomWidth:4,borderColor:"#fff",borderBottomRightRadius:8}, hint:{color:"#fff",fontSize:12,textAlign:"center",marginTop:15}, scanModes:{flexDirection:"row",gap:8,marginTop:15}, scanMode:{paddingHorizontal:17,paddingVertical:9,borderRadius:12,backgroundColor:"rgba(0,0,0,.45)"}, scanModeOn:{paddingHorizontal:17,paddingVertical:9,borderRadius:12,backgroundColor:"#fff"}, scanModeText:{color:"#fff",fontWeight:"800"}, scanModeTextOn:{color:C.ink,fontWeight:"900"}, shutter:{position:"absolute",bottom:34,width:76,height:76,borderRadius:38,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"}, shutterInner:{width:62,height:62,borderRadius:31,borderWidth:4,borderColor:C.dark}, topBar:{height:74,paddingHorizontal:17,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:C.card,borderBottomWidth:1,borderBottomColor:C.line}, back:{fontSize:38,color:C.ink,width:42}, topTitle:{fontSize:18,fontWeight:"900",color:C.ink}, topSub:{fontSize:11,color:C.muted,marginTop:2}, countPill:{minWidth:32,height:30,borderRadius:15,backgroundColor:C.accentSoft,alignItems:"center",justifyContent:"center"}, countText:{color:C.accent,fontWeight:"900"}, filterRow:{paddingHorizontal:16,paddingVertical:11,gap:8}, filter:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,paddingHorizontal:13,paddingVertical:9,borderRadius:12}, filterOn:{backgroundColor:C.accent,paddingHorizontal:13,paddingVertical:9,borderRadius:12}, filterText:{color:C.muted,fontWeight:"800",fontSize:12}, filterTextOn:{color:"#fff",fontWeight:"900",fontSize:12}, pagesList:{padding:8,paddingBottom:90}, pageCard:{width:"46%",backgroundColor:C.card,borderRadius:17,padding:8,margin:7,borderWidth:1,borderColor:"#EAECF0"}, pageNumber:{position:"absolute",zIndex:2,left:13,top:13,width:27,height:27,borderRadius:14,backgroundColor:C.dark,alignItems:"center",justifyContent:"center"}, pageNumberText:{color:"#fff",fontWeight:"900",fontSize:11}, thumb:{width:"100%",height:220,borderRadius:11,backgroundColor:"#F2F4F7"}, pageFooter:{padding:7}, pageLabel:{fontWeight:"900",fontSize:12,color:C.ink}, pageActions:{flexDirection:"row",justifyContent:"space-between",marginTop:8}, actionText:{fontWeight:"900",fontSize:15,color:C.accent}, deleteText:{color:C.danger,fontWeight:"800",fontSize:11}, bottomBar:{position:"absolute",bottom:0,left:0,right:0,padding:12,flexDirection:"row",gap:10,backgroundColor:"rgba(255,255,255,.97)",borderTopWidth:1,borderTopColor:C.line}, ocrWrap:{padding:18}, ocrInput:{minHeight:350,backgroundColor:C.card,borderRadius:18,borderWidth:1,borderColor:C.line,padding:16,textAlignVertical:"top",fontSize:15,color:C.ink,marginBottom:12}, viewerSafe:{flex:1,backgroundColor:"#0B0F17"}, viewerTop:{height:72,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:10,backgroundColor:C.dark}, viewerBack:{color:"#fff",fontSize:38,width:35}, viewerTitle:{color:"#fff",fontSize:15,fontWeight:"900"}, viewerSub:{color:"#98A2B3",fontSize:11,marginTop:2}, viewerIcon:{color:"#fff",fontSize:22,paddingHorizontal:7}, pdfStage:{flex:1,backgroundColor:"#303743",alignItems:"center",justifyContent:"center"}, pdf:{flex:1,width:"100%",backgroundColor:"#303743"}, muted:{color:"#98A2B3"}, viewerControls:{height:52,backgroundColor:C.dark,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:28}, ctrl:{color:"#fff",fontSize:30}, pageJump:{paddingHorizontal:16,paddingVertical:7,borderRadius:10,backgroundColor:"#202938"}, pageJumpText:{color:"#fff",fontWeight:"800",fontSize:12}, viewerTools:{height:62,backgroundColor:C.dark,borderTopWidth:1,borderTopColor:"#283241",flexDirection:"row",justifyContent:"space-around",alignItems:"center"}, viewerTool:{color:"#fff",fontSize:18,fontWeight:"900"}, viewerToolLabel:{fontSize:11,fontWeight:"700",color:"#D0D5DD"}, modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.45)",justifyContent:"flex-end"}, editor:{backgroundColor:C.card,borderTopLeftRadius:25,borderTopRightRadius:25,padding:20,paddingBottom:30}, editorTitle:{fontSize:20,fontWeight:"900",color:C.ink}, editorHint:{fontSize:12,color:C.muted,lineHeight:18,marginTop:6,marginBottom:15}, editorInput:{height:50,borderWidth:1,borderColor:C.line,borderRadius:14,paddingHorizontal:14,marginBottom:10,color:C.ink}, editorRow:{flexDirection:"row",gap:10,marginTop:4}, infoCard:{backgroundColor:C.card,margin:25,borderRadius:22,padding:22}, infoLine:{fontSize:14,color:C.ink,marginTop:12}, busyBackdrop:{flex:1,backgroundColor:"rgba(16,24,40,.55)",alignItems:"center",justifyContent:"center"}, busyBox:{backgroundColor:C.card,borderRadius:18,paddingVertical:26,paddingHorizontal:32,alignItems:"center",gap:12}, busyText:{color:C.ink,fontWeight:"800",fontSize:13,marginTop:4}
});
