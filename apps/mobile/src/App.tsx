import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const API_URL = String(Constants.expoConfig?.extra?.apiUrl ?? "https://api.asst.xion.exiliadosrpv2.uk").replace(/\/$/, "");

type User = { id: string; email: string; displayName: string; isAdmin: boolean };
type AuthState = { token: string; user: User };
type Message = { id: string; role: "user" | "assistant" | "system"; text: string };
type AssistantResponse = { response: string; status?: string; error?: string };
type UpdateManifest = { version: string; download_url: string };

const quickCommands = [
  "Resume mis tareas de hoy",
  "Guarda que prefiero respuestas cortas",
  "Organiza mi dia",
  "Que tengo pendiente?"
];

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const initials = useMemo(() => {
    const name = auth?.user.displayName ?? "Xion";
    return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }, [auth?.user.displayName]);

  useEffect(() => {
    void AsyncStorage.getItem("xion_auth").then((value) => {
      if (value) setAuth(JSON.parse(value) as AuthState);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const apiFetch = async <T,>(path: string, init: RequestInit = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(auth?.token ? { authorization: `Bearer ${auth.token}` } : {}),
        ...(init.headers ?? {})
      }
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as T;
  };

  const saveAuth = async (next: AuthState) => {
    await AsyncStorage.setItem("xion_auth", JSON.stringify(next));
    setAuth(next);
    setMessages([{ id: String(Date.now()), role: "assistant", text: `Hola ${next.user.displayName}. Estoy listo y respondo con voz.` }]);
  };

  const submitAuth = async () => {
    setBusy(true);
    try {
      const body = mode === "register" ? { email, password, displayName: displayName || email.split("@")[0] } : { email, password };
      const data = await apiFetch<AuthState>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
      await saveAuth(data);
    } catch (error) {
      Alert.alert("No pude iniciar", error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const speak = async (text: string) => {
    try {
      const audio = await apiFetch<{ audio_base64?: string; format?: string }>("/api/voice/speak", {
        method: "POST",
        body: JSON.stringify({
          text,
          user_id: auth?.user.id ?? "mobile",
          voice_id: "Kore",
          language: "es-CL",
          speed: 1
        })
      });
      if (!audio.audio_base64) throw new Error("tts_empty");
      const ext = audio.format === "wav" ? "wav" : "mp3";
      const uri = `${FileSystem.cacheDirectory}xion-reply-${Date.now()}.${ext}`;
      await FileSystem.writeAsStringAsync(uri, audio.audio_base64, { encoding: FileSystem.EncodingType.Base64 });
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) void sound.unloadAsync();
      });
    } catch {
      Speech.speak(text, { language: "es-CL", rate: 1 });
    }
  };

  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    setBusy(true);
    const userMessage: Message = { id: cryptoId(), role: "user", text: clean };
    setMessages((items) => [...items, userMessage]);
    try {
      const data = await apiFetch<AssistantResponse>("/api/assistant/message", {
        method: "POST",
        body: JSON.stringify({
          message: clean,
          spokenResponse: false,
          platform: "android",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      const reply = data.response || data.error || "No pude responder ahora.";
      setMessages((items) => [...items, { id: cryptoId(), role: "assistant", text: reply }]);
      await speak(reply);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error";
      setMessages((items) => [...items, { id: cryptoId(), role: "system", text: msg }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      setBusy(true);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (!uri) throw new Error("audio_uri_missing");
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const data = await apiFetch<{ text: string }>("/api/voice/transcribe", {
          method: "POST",
          body: JSON.stringify({ audio_base64: base64, mime_type: "audio/mp4", language: "es-CL" })
        });
        setInput(data.text);
        await send(data.text);
      } catch (error) {
        Alert.alert("Microfono", error instanceof Error ? error.message : "No pude transcribir");
      } finally {
        setBusy(false);
      }
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microfono", "Permiso denegado.");
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(created.recording);
  };

  const openLatestApk = async () => {
    const data = await apiFetch<{ manifest: UpdateManifest }>("/api/updates/latest?platform=android&channel=stable");
    await Linking.openURL(data.manifest.download_url);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("xion_auth");
    setAuth(null);
    setMessages([]);
  };

  if (!ready) return <LoadingScreen />;

  if (!auth) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.authHero}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>X</Text></View>
          <Text style={styles.eyebrow}>Xion Assistant Mobile</Text>
          <Text style={styles.title}>Asistente por voz, memoria y control seguro.</Text>
          <Text style={styles.copy}>Conecta con tu Worker API. La clave IA queda en Cloudflare, no en la app.</Text>
        </View>
        <View style={styles.authCard}>
          <View style={styles.segmented}>
            <Pressable style={[styles.segmentButton, mode === "login" && styles.segmentActive]} onPress={() => setMode("login")}><Text style={styles.segmentText}>Entrar</Text></Pressable>
            <Pressable style={[styles.segmentButton, mode === "register" && styles.segmentActive]} onPress={() => setMode("register")}><Text style={styles.segmentText}>Crear</Text></Pressable>
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {mode === "register" ? <Field label="Nombre" value={displayName} onChangeText={setDisplayName} /> : null}
          <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy || !email || password.length < 8} onPress={submitAuth}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "login" ? "Entrar" : "Crear cuenta"}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topNav}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Xion Assistant</Text>
            <Text style={styles.brandSub}>Online - Mobile - Voice</Text>
          </View>
          <Pressable style={styles.smallButton} onPress={logout}><Text style={styles.smallButtonText}>Salir</Text></Pressable>
        </View>

        <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
          <View style={[styles.orbWrap, recording && styles.orbListening]}>
            <Pressable style={styles.orb} onPress={toggleRecording}>
              <Text style={styles.orbCore}>{recording ? "REC" : "X"}</Text>
            </Pressable>
          </View>
          <Text style={styles.promptTitle}>{recording ? "Escuchando..." : `Hey ${auth.user.displayName}`}</Text>
          <Text style={styles.promptCopy}>Toca el nucleo para hablar. Xion responde por audio siempre.</Text>

          <View style={styles.chips}>
            {quickCommands.map((command) => (
              <Pressable key={command} style={styles.chip} onPress={() => send(command)}>
                <Text style={styles.chipText}>{command}</Text>
              </Pressable>
            ))}
          </View>

          {messages.map((item) => (
            <View key={item.id} style={[styles.bubble, item.role === "user" ? styles.userBubble : item.role === "system" ? styles.systemBubble : styles.assistantBubble]}>
              <Text style={styles.bubbleLabel}>{item.role === "user" ? "Tu" : item.role === "system" ? "Sistema" : "Xion"}</Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput value={input} onChangeText={setInput} placeholder="Escribe o dicta un comando..." placeholderTextColor="#8b84a8" style={styles.input} multiline />
          <Pressable style={[styles.micButton, recording && styles.micActive]} onPress={toggleRecording} disabled={busy}>
            <Text style={styles.micText}>{recording ? "Stop" : "Mic"}</Text>
          </Pressable>
          <Pressable style={[styles.sendButton, busy && styles.disabled]} disabled={busy || !input.trim()} onPress={() => send()}>
            <Text style={styles.sendText}>{busy ? "..." : "Enviar"}</Text>
          </Pressable>
        </View>

        <View style={styles.bottomNav}>
          <Pressable style={styles.navItem}><Text style={styles.navText}>Inicio</Text></Pressable>
          <Pressable style={styles.navItem} onPress={openLatestApk}><Text style={styles.navText}>APK</Text></Pressable>
          <Pressable style={styles.navItem} onPress={() => Alert.alert("Permisos", "Microfono activo. Memoria aislada por usuario. Confirmaciones en API.")}><Text style={styles.navText}>Permisos</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor="#8b84a8" style={styles.authInput} />
    </View>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <ActivityIndicator color="#c084fc" size="large" />
    </SafeAreaView>
  );
}

function cryptoId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080713", paddingHorizontal: 18 },
  flex: { flex: 1 },
  authHero: { paddingTop: 56, gap: 12 },
  brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#8b5cf6", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  eyebrow: { color: "#38bdf8", fontWeight: "800", letterSpacing: 0 },
  title: { color: "#f8f6ff", fontSize: 36, lineHeight: 39, fontWeight: "900" },
  copy: { color: "#a8a0c6", fontSize: 15, lineHeight: 22 },
  authCard: { marginTop: 28, padding: 16, borderRadius: 22, backgroundColor: "rgba(32,25,62,0.82)", borderWidth: 1, borderColor: "rgba(190,160,255,0.18)" },
  segmented: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" },
  segmentButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  segmentActive: { backgroundColor: "#8b5cf6" },
  segmentText: { color: "#fff", fontWeight: "800" },
  field: { marginTop: 14, gap: 7 },
  label: { color: "#c8c1e2", fontSize: 13, fontWeight: "800" },
  authInput: { minHeight: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", color: "#fff", paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  primaryButton: { marginTop: 16, minHeight: 48, borderRadius: 15, backgroundColor: "#14b8a6", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.55 },
  topNav: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#8b5cf6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "900" },
  brandText: { flex: 1 },
  brandTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  brandSub: { color: "#a8a0c6", fontSize: 12 },
  smallButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center" },
  smallButtonText: { color: "#fff", fontWeight: "800" },
  chat: { flex: 1 },
  chatContent: { paddingBottom: 18 },
  orbWrap: { alignSelf: "center", width: 168, height: 168, borderRadius: 84, alignItems: "center", justifyContent: "center", marginTop: 12, backgroundColor: "rgba(139,92,246,0.14)", borderWidth: 1, borderColor: "rgba(192,132,252,0.25)" },
  orbListening: { backgroundColor: "rgba(20,184,166,0.22)", borderColor: "#14b8a6" },
  orb: { width: 118, height: 118, borderRadius: 59, alignItems: "center", justifyContent: "center", backgroundColor: "#8b5cf6" },
  orbCore: { color: "#fff", fontWeight: "900", fontSize: 28 },
  promptTitle: { color: "#fff", textAlign: "center", fontSize: 27, fontWeight: "900", marginTop: 16 },
  promptCopy: { color: "#a8a0c6", textAlign: "center", lineHeight: 21, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  chip: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  bubble: { marginTop: 12, padding: 13, borderRadius: 18, borderWidth: 1 },
  userBubble: { alignSelf: "flex-end", maxWidth: "86%", backgroundColor: "#0f766e", borderColor: "rgba(20,184,166,0.45)" },
  assistantBubble: { alignSelf: "flex-start", maxWidth: "92%", backgroundColor: "rgba(32,25,62,0.88)", borderColor: "rgba(190,160,255,0.18)" },
  systemBubble: { alignSelf: "center", backgroundColor: "rgba(251,113,133,0.12)", borderColor: "rgba(251,113,133,0.32)" },
  bubbleLabel: { color: "#c8c1e2", fontWeight: "900", fontSize: 11, marginBottom: 4 },
  bubbleText: { color: "#fff", lineHeight: 20 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingVertical: 10 },
  input: { flex: 1, minHeight: 46, maxHeight: 110, color: "#fff", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  micButton: { width: 54, minHeight: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(139,92,246,0.55)" },
  micActive: { backgroundColor: "#14b8a6" },
  micText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  sendButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#14b8a6" },
  sendText: { color: "#fff", fontWeight: "900" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  navItem: { paddingVertical: 8, paddingHorizontal: 12 },
  navText: { color: "#c8c1e2", fontWeight: "800", fontSize: 12 }
});
