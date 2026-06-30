import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bell,
  Bot,
  Brain,
  CalendarDays,
  Check,
  CircleAlert,
  Contact,
  Download,
  Gauge,
  Headphones,
  KeyRound,
  Link2,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Mic,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Volume2,
  X
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8787";
const VERSION = "0.12.2";

type AuthState = { token: string; user: { id: string; email: string; displayName: string; isAdmin: boolean } };
type View = "dashboard" | "assistant" | "memory" | "contacts" | "voice" | "commands" | "connectors" | "updates" | "settings";
type Route = "app" | "admin";
type ApiState = "idle" | "loading" | "ok" | "error";
type Risk = "low" | "medium" | "high";
type ActionStatus = "draft" | "pending_confirmation" | "running" | "completed" | "failed" | "cancelled";
type Health = { ok: boolean; name: string; version: string; routes?: { web?: string; api?: string } };
type Voice = { id: string; provider: string; voiceKey: string; displayName: string; language: string };
type VoiceSettings = { userId: string; ttsEnabled: boolean; sttEnabled: boolean; wakeWordEnabled: boolean; selectedVoiceId: string; language: string; speed: number; pitch: number; volume: number; autoPlayResponses: boolean };
type Memory = { id: string; memoryType: string; key: string; value: string; confirmed: boolean; confidence: number; createdAt: string };
type ContactRecord = { id: string; displayName: string; notes?: string; createdAt: string; updatedAt: string };
type OAuthAccount = { id: string; provider: "google" | "spotify"; providerUserId: string; scopes: string[]; expiresAt?: string; createdAt: string };
type CommandDefinition = { name: string; description: string; examples: string[]; riskLevel: Risk; requiresConfirmation: boolean };
type Shortcut = { id: string; shortcut: string; intent: string; params: Record<string, unknown>; isActive: boolean; confirmed: boolean; confidence: number };
type Usage = { totals: { uses: number; aiFallbacks: number; estimatedTokensSaved: number } };
type UpdateManifest = { version: string; platform: "windows" | "android"; channel: string; download_url: string; sha256: string; size: number; changelog: string; required: boolean; published_at: string };
type AssistantStep = { id?: string; order?: number; title: string; status: string; requiresConfirmation?: boolean };
type AssistantResponse = {
  ok?: boolean;
  status: ActionStatus | "needs_clarification" | "completed";
  response: string;
  usedAiFallback?: boolean;
  command?: string;
  action?: { id: string; toolName: string; riskLevel: Risk; status: ActionStatus };
  plan?: { id?: string; title: string; riskLevel: Risk; ai?: { provider: string; model: string }; steps: AssistantStep[] } | null;
  audio?: { audio_base64?: string; format: "mp3" | "wav" | "opus"; provider: string; voice_id: string } | null;
  error?: string;
};
type ChatItem = { id: string; role: "user" | "assistant" | "system"; text: string; response?: AssistantResponse; createdAt: string };
type StoredMessage = { id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const defaultVoiceSettings = (userId: string): VoiceSettings => ({
  userId,
  ttsEnabled: true,
  sttEnabled: false,
  wakeWordEnabled: false,
  selectedVoiceId: "Kore",
  language: "es-CL",
  speed: 1,
  pitch: 1,
  volume: 1,
  autoPlayResponses: true
});

function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => readStorage<AuthState>("xion_auth"));
  const [route, setRoute] = useState<Route>(() => currentRoute());
  const [view, setView] = useState<View>("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<ApiState>("idle");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => readStorage<"light" | "dark">("xion_theme") ?? "light");

  const api = useMemo(() => createApi(auth?.token), [auth?.token]);
  const apiHost = useMemo(() => API_URL.replace(/^https?:\/\//, ""), []);

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    localStorage.setItem("xion_theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("auth=") && !hash.startsWith("auth_error=")) return;
    const [key, value] = hash.split("=");
    if (!key || !value) return;
    try {
      const payload = decodeAuthFragment(value);
      if (key === "auth") {
        setSession(payload as AuthState);
        notify("Sesion Google iniciada");
      } else {
        notify(`Google OAuth: ${(payload as { error?: string }).error ?? "error"}`);
      }
    } catch {
      notify("Google OAuth: respuesta invalida");
    } finally {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const loadHealth = async () => {
    setHealthState("loading");
    try {
      setHealth(await createApi().get<Health>("/api/health"));
      setHealthState("ok");
    } catch {
      setHealthState("error");
    }
  };

  const setSession = (next: AuthState) => {
    localStorage.setItem("xion_auth", JSON.stringify(next));
    setAuth(next);
    setView("dashboard");
    if (currentRoute() === "admin" && !next.user.isAdmin) navigateTo("app");
  };

  const logout = () => {
    localStorage.removeItem("xion_auth");
    setAuth(null);
    setView("dashboard");
    navigateTo("app");
  };

  const navigateTo = (next: Route) => {
    const path = next === "admin" ? "/admin" : "/";
    window.history.pushState(null, "", path);
    setRoute(next);
  };

  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <main className={`app-shell ${theme}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div>
            <p>Xion Assistant</p>
            <span>v{VERSION} · {apiHost}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <StatusPill state={healthState} label={health?.version ? `API ${health.version}` : "API"} />
          {auth?.user.isAdmin ? <button className="secondary route-button" onClick={() => navigateTo(route === "admin" ? "app" : "admin")}>{route === "admin" ? "Chat" : "Admin"}</button> : null}
          <button className="icon-button" title="Tema" onClick={toggleTheme}>{theme === "dark" ? <Power size={18} /> : <Sparkles size={18} />}</button>
          {auth ? <button className="icon-button" title="Cerrar sesion" onClick={logout}><LogOut size={18} /></button> : null}
        </div>
      </header>

      {!auth ? (
        <AuthPanel onAuthenticated={setSession} />
      ) : route === "admin" ? (
        auth.user.isAdmin ? (
          <AdminShell api={api} auth={auth} health={health} view={view} setView={setView} notify={notify} />
        ) : (
          <AccessDenied user={auth.user} />
        )
      ) : (
        <UserShell api={api} auth={auth} notify={notify} />
      )}
      {toast ? <div className="toast"><Check size={16} />{toast}</div> : null}
    </main>
  );
}

function currentRoute(): Route {
  return window.location.pathname.startsWith("/admin") ? "admin" : "app";
}

function UserShell({ api, auth, notify }: { api: ApiClient; auth: AuthState; notify: (message: string) => void }) {
  return (
    <div className="user-home">
      <AssistantPanel api={api} auth={auth} notify={notify} />
      <AccountPanel api={api} user={auth.user} notify={notify} />
    </div>
  );
}

function AdminShell({ api, auth, health, view, setView, notify }: { api: ApiClient; auth: AuthState; health: Health | null; view: View; setView: (view: View) => void; notify: (message: string) => void }) {
  return (
    <div className="layout">
      <Sidebar view={view} setView={setView} user={auth.user} />
      <section className="main-surface">
        {view === "dashboard" ? <Dashboard api={api} health={health} user={auth.user} setView={setView} /> : null}
        {view === "assistant" ? <AssistantPanel api={api} auth={auth} notify={notify} /> : null}
        {view === "memory" ? <MemoryPanel api={api} userId={auth.user.id} notify={notify} /> : null}
        {view === "contacts" ? <ContactsPanel api={api} userId={auth.user.id} notify={notify} /> : null}
        {view === "voice" ? <VoicePanel api={api} userId={auth.user.id} notify={notify} /> : null}
        {view === "commands" ? <CommandsPanel api={api} notify={notify} /> : null}
        {view === "connectors" ? <ConnectorsPanel api={api} userId={auth.user.id} notify={notify} /> : null}
        {view === "updates" ? <UpdatesPanel api={api} /> : null}
        {view === "settings" ? <SettingsPanel apiUrl={API_URL} health={health} /> : null}
      </section>
    </div>
  );
}

function AccountPanel({ api, user, notify }: { api: ApiClient; user: AuthState["user"]; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const downloadAndroid = async () => {
    setBusy(true);
    try {
      const data = await api.get<{ manifest: UpdateManifest }>("/api/updates/latest?platform=android&channel=stable");
      window.location.href = data.manifest.download_url;
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell title="Cuenta" subtitle="Sesion y perfil" icon={<ShieldCheck size={20} />}>
      <div className="settings-list">
        <InfoRow label="Usuario" value={user.displayName} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Rol" value={user.isAdmin ? "admin" : "usuario"} />
        <InfoRow label="Panel admin" value={user.isAdmin ? "/admin habilitado" : "sin acceso"} />
      </div>
      <div className="account-actions">
        <button className="primary wide" disabled={busy} onClick={() => void downloadAndroid()}>
          {busy ? <RefreshCcw className="spin" size={16} /> : <Download size={16} />}
          Descargar app Android
        </button>
      </div>
    </PanelShell>
  );
}

function AccessDenied({ user }: { user: AuthState["user"] }) {
  return (
    <div className="user-home">
      <PanelShell title="Sin acceso" subtitle="Ruta admin protegida" icon={<ShieldCheck size={20} />}>
        <p className="muted-line">{user.email} no tiene `is_admin = 1` en D1.</p>
      </PanelShell>
    </div>
  );
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: (auth: AuthState) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = { email, password, ...(mode === "register" ? { displayName: displayName || email.split("@")[0] } : {}) };
      const data = await createApi().post<AuthState & { error?: string }>(`/api/auth/${mode}`, payload);
      onAuthenticated(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo autenticar");
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await createApi().get<{ authorizationUrl: string; configured: boolean }>("/api/auth/google/start");
      if (!data.configured) {
        setError("Google OAuth falta configurar en Worker");
        setBusy(false);
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo iniciar Google");
      setBusy(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-copy">
        <div className="brand-mark large"><Bot size={34} /></div>
        <h1>Asistente privado con memoria, voz y confirmaciones.</h1>
        <p>Todo lo sensible vive tras Worker API. La web nunca recibe API keys de IA, OAuth ni cifrado.</p>
        <div className="auth-benefits">
          <span><ShieldCheck size={16} />Datos por usuario</span>
          <span><Volume2 size={16} />Voz configurable</span>
          <span><ListChecks size={16} />Acciones confirmadas</span>
        </div>
      </div>
      <form className="auth-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}><LogIn size={16} />Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}><UserPlus size={16} />Crear</button>
        </div>
        <button type="button" className="google-button" disabled={busy} onClick={() => void continueWithGoogle()}>
          {busy ? <RefreshCcw className="spin" size={16} /> : <KeyRound size={16} />}
          Continuar con Google
        </button>
        <div className="auth-divider"><span>o usa email</span></div>
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Contrasena" value={password} onChange={setPassword} type="password" />
        {mode === "register" ? <Field label="Nombre" value={displayName} onChange={setDisplayName} /> : null}
        {error ? <p className="error-line"><CircleAlert size={15} />{error}</p> : null}
        <button className="primary wide" disabled={busy || !email || password.length < 8}>
          {busy ? <RefreshCcw className="spin" size={16} /> : mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}

function Sidebar({ view, setView, user }: { view: View; setView: (view: View) => void; user: AuthState["user"] }) {
  const items: Array<{ id: View; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <Gauge size={18} /> },
    { id: "assistant", label: "Assistant", icon: <MessageSquare size={18} /> },
    { id: "memory", label: "Memoria", icon: <Brain size={18} /> },
    { id: "contacts", label: "Contactos", icon: <Contact size={18} /> },
    { id: "voice", label: "Voz", icon: <Headphones size={18} /> },
    { id: "commands", label: "Comandos", icon: <ListChecks size={18} /> },
    { id: "connectors", label: "Conectores", icon: <Link2 size={18} /> },
    { id: "updates", label: "Updates", icon: <Download size={18} /> },
    { id: "settings", label: "Ajustes", icon: <Settings size={18} /> }
  ];
  return (
    <aside className="sidebar">
      <div className="user-tile">
        <div className="avatar">{initials(user.displayName)}</div>
        <div>
          <strong>{user.displayName}</strong>
          <span>{user.email}</span>
        </div>
      </div>
      <nav>
        {items.map((item) => (
          <button key={item.id} className={view === item.id ? "nav-button active" : "nav-button"} onClick={() => setView(item.id)}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Dashboard({ api, health, user, setView }: { api: ApiClient; health: Health | null; user: AuthState["user"]; setView: (view: View) => void }) {
  const [usage, setUsage] = useState<Usage["totals"]>({ uses: 0, aiFallbacks: 0, estimatedTokensSaved: 0 });
  const [memoryCount, setMemoryCount] = useState(0);
  const [contactsCount, setContactsCount] = useState(0);

  useEffect(() => {
    void Promise.all([
      api.get<Usage>("/api/commands/usage").then((data) => setUsage(data.totals)).catch(() => undefined),
      api.get<{ memories: Memory[] }>(`/api/memory?user_id=${encodeURIComponent(user.id)}`).then((data) => setMemoryCount(data.memories.length)).catch(() => undefined),
      api.get<{ contacts: ContactRecord[] }>(`/api/contacts?user_id=${encodeURIComponent(user.id)}`).then((data) => setContactsCount(data.contacts.length)).catch(() => undefined)
    ]);
  }, [api, user.id]);

  return (
    <PanelShell title="Dashboard" subtitle="Estado operativo del asistente" icon={<Gauge size={20} />}>
      <div className="metric-grid">
        <Metric icon={<Activity size={18} />} label="API" value={health?.ok ? "Online" : "Pendiente"} tone={health?.ok ? "good" : "warn"} />
        <Metric icon={<Brain size={18} />} label="Memorias" value={memoryCount} />
        <Metric icon={<Contact size={18} />} label="Contactos" value={contactsCount} />
        <Metric icon={<Sparkles size={18} />} label="Tokens ahorrados" value={usage.estimatedTokensSaved} />
      </div>
      <div className="quick-grid">
        <QuickAction icon={<MessageSquare size={18} />} label="Hablar con Xion" onClick={() => setView("assistant")} />
        <QuickAction icon={<Brain size={18} />} label="Guardar memoria" onClick={() => setView("memory")} />
        <QuickAction icon={<Volume2 size={18} />} label="Configurar voz" onClick={() => setView("voice")} />
        <QuickAction icon={<Link2 size={18} />} label="Conectar apps" onClick={() => setView("connectors")} />
      </div>
      <section className="info-band">
        <ShieldCheck size={18} />
        <p>IA configurada vive en Worker. Frontend llama solo API propia y no conoce `AI_API_KEY`.</p>
      </section>
    </PanelShell>
  );
}

function AssistantPanel({ api, auth, notify }: { api: ApiClient; auth: AuthState; notify: (message: string) => void }) {
  const [message, setMessage] = useState("Hola Xion, organiza mi dia y responde con voz");
  const [history, setHistory] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [spokenResponse] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    void api.get<{ messages: StoredMessage[] }>("/api/assistant/messages?limit=50")
      .then((data) => setHistory(data.messages.map((item) => ({
        id: item.id,
        role: item.role,
        text: item.content,
        createdAt: item.createdAt
      }))))
      .catch(() => undefined);
  }, [api, auth.user.id]);

  const saveHistory = (items: ChatItem[]) => {
    setHistory(items);
  };

  const send = async (overrideMessage?: string) => {
    const text = (overrideMessage ?? message).trim();
    if (!text) return;
    const userItem: ChatItem = { id: crypto.randomUUID(), role: "user", text, createdAt: new Date().toISOString() };
    saveHistory([...history, userItem]);
    setBusy(true);
    try {
      const response = await api.post<AssistantResponse>("/api/assistant/message", {
        message: text,
        spokenResponse: false,
        platform: "web",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      const assistantItem: ChatItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: response.response,
        response,
        createdAt: new Date().toISOString()
      };
      saveHistory([...history, userItem, assistantItem]);
      if (spokenResponse) void speakReply(api, auth.user.id, response.response, notify);
      setMessage("");
    } catch (error) {
      saveHistory([...history, userItem, { id: crypto.randomUUID(), role: "system", text: errorMessage(error), createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  const startMic = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify("Microfono no soportado en este navegador");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-CL";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      setMessage(transcript);
      void send(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      notify("No pude escuchar el microfono");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const confirmAction = async (response: AssistantResponse, decision: "confirm" | "cancel") => {
    if (!response.action) return;
    const path = decision === "confirm" ? "confirm" : "cancel";
    const result = await api.post<{ action: { status: ActionStatus } }>(`/api/actions/${response.action.id}/${path}`, { userId: auth.user.id });
    notify(result.action.status === "completed" ? "Accion completada" : `Accion ${result.action.status}`);
  };

  return (
    <PanelShell title="Assistant" subtitle="Chat rapido, microfono y confirmaciones" icon={<Bot size={20} />} actions={<Volume2 size={18} />}>
      <div className="chat-window">
        {history.length ? history.map((item) => (
          <article key={item.id} className={`message ${item.role}`}>
            <p>{item.text}</p>
            {item.response?.plan ? <PlanPreview plan={item.response.plan} /> : null}
            {item.response?.action?.status === "pending_confirmation" ? (
              <div className="confirm-bar">
                <button className="primary" onClick={() => void confirmAction(item.response!, "confirm")}><Check size={16} />Confirmar</button>
                <button className="secondary danger-text" onClick={() => void confirmAction(item.response!, "cancel")}><X size={16} />Cancelar</button>
              </div>
            ) : null}
          </article>
        )) : <EmptyState icon={<MessageSquare size={22} />} title="Sin mensajes" text="Escribe una orden o pregunta. Xion puede planificar, recordar y pedir confirmacion." />}
      </div>
      <div className="composer">
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void send(); }} />
        <button className={listening ? "secondary mic-button listening" : "secondary mic-button"} disabled={busy} title="Hablar" onClick={startMic}>{listening ? <RefreshCcw className="spin" size={18} /> : <Mic size={18} />}</button>
        <button className="primary send-button" disabled={busy || !message.trim()} onClick={() => void send()}>{busy ? <RefreshCcw className="spin" size={18} /> : <Send size={18} />}Enviar</button>
      </div>
    </PanelShell>
  );
}

function MemoryPanel({ api, userId, notify }: { api: ApiClient; userId: string; notify: (message: string) => void }) {
  const [items, setItems] = useState<Memory[]>([]);
  const [form, setForm] = useState({ memoryType: "user_preference", key: "idioma", value: "es-CL" });
  const load = () => api.get<{ memories: Memory[] }>(`/api/memory?user_id=${encodeURIComponent(userId)}`).then((data) => setItems(data.memories));
  useEffect(() => { void load(); }, [userId]);
  const create = async () => {
    await api.post("/api/memory", { userId, ...form, confirmed: true, confidence: 1 });
    setForm({ memoryType: "user_preference", key: "", value: "" });
    await load();
    notify("Memoria guardada");
  };
  const update = async (item: Memory, patch: Partial<Memory>) => { await api.put(`/api/memory/${item.id}`, { userId, ...patch }); await load(); };
  const remove = async (id: string) => { await api.delete(`/api/memory/${id}?user_id=${encodeURIComponent(userId)}`); await load(); notify("Memoria eliminada"); };
  return (
    <PanelShell title="Memoria" subtitle="Datos privados por usuario" icon={<Brain size={20} />}>
      <div className="form-grid four">
        <Field label="Tipo" value={form.memoryType} onChange={(value) => setForm({ ...form, memoryType: value })} />
        <Field label="Clave" value={form.key} onChange={(value) => setForm({ ...form, key: value })} />
        <Field label="Valor" value={form.value} onChange={(value) => setForm({ ...form, value })} />
        <button className="primary self-end" disabled={!form.key || !form.value} onClick={() => void create()}><Plus size={16} />Guardar</button>
      </div>
      <div className="data-list">
        {items.map((item) => <EditableRow key={item.id} title={item.key} subtitle={item.memoryType} value={item.value} badge={item.confirmed ? "confirmada" : "pendiente"} onSave={(value) => void update(item, { value })} onDelete={() => void remove(item.id)} />)}
      </div>
    </PanelShell>
  );
}

function ContactsPanel({ api, userId, notify }: { api: ApiClient; userId: string; notify: (message: string) => void }) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [alias, setAlias] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [address, setAddress] = useState("");
  const [selected, setSelected] = useState("");
  const load = () => api.get<{ contacts: ContactRecord[] }>(`/api/contacts?user_id=${encodeURIComponent(userId)}`).then((data) => { setContacts(data.contacts); if (!selected && data.contacts[0]) setSelected(data.contacts[0].id); });
  useEffect(() => { void load(); }, [userId]);
  const create = async () => { await api.post("/api/contacts", { userId, displayName: name, notes }); setName(""); setNotes(""); await load(); notify("Contacto creado"); };
  const addAlias = async () => { if (!selected) return; await api.post(`/api/contacts/${selected}/aliases`, { userId, alias, confirmed: true }); setAlias(""); notify("Alias guardado"); };
  const addChannel = async () => { if (!selected) return; await api.post(`/api/contacts/${selected}/channels`, { userId, channel, address, isPreferred: true }); setAddress(""); notify("Canal guardado"); };
  return (
    <PanelShell title="Contactos" subtitle="Alias y canales para acciones futuras" icon={<Contact size={20} />}>
      <div className="split">
        <section>
          <h3>Nuevo contacto</h3>
          <Field label="Nombre" value={name} onChange={setName} />
          <Field label="Notas" value={notes} onChange={setNotes} />
          <button className="primary" disabled={!name} onClick={() => void create()}><Plus size={16} />Crear</button>
          <div className="data-list compact">{contacts.map((contact) => <button key={contact.id} className={selected === contact.id ? "select-row active" : "select-row"} onClick={() => setSelected(contact.id)}><strong>{contact.displayName}</strong><span>{contact.notes || "sin notas"}</span></button>)}</div>
        </section>
        <section>
          <h3>Resolver destinatarios</h3>
          <Field label="Alias" value={alias} onChange={setAlias} placeholder="mi esposa" />
          <button className="secondary" disabled={!selected || !alias} onClick={() => void addAlias()}><Save size={16} />Guardar alias</button>
          <div className="form-grid two">
            <Field label="Canal" value={channel} onChange={setChannel} />
            <Field label="Direccion" value={address} onChange={setAddress} placeholder="+569..." />
          </div>
          <button className="secondary" disabled={!selected || !address} onClick={() => void addChannel()}><Link2 size={16} />Guardar canal</button>
        </section>
      </div>
    </PanelShell>
  );
}

function VoicePanel({ api, userId, notify }: { api: ApiClient; userId: string; notify: (message: string) => void }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(defaultVoiceSettings(userId));
  const [previewText, setPreviewText] = useState("Hola, soy Xion. Ya estoy listo para ayudarte.");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([
      api.get<{ voices: Voice[] }>("/api/voice/voices").then((data) => setVoices(data.voices)),
      api.get<{ settings: VoiceSettings | null }>(`/api/voice/settings?user_id=${encodeURIComponent(userId)}`).then((data) => { if (data.settings) setSettings(data.settings); })
    ]);
  }, [api, userId]);
  const save = async () => { await api.put<{ settings: VoiceSettings }>("/api/voice/settings", settings); notify("Voz guardada"); };
  const preview = async () => {
    setBusy(true);
    try {
      const audio = await api.post<{ audio_base64?: string; format: "mp3" | "wav" | "opus" }>("/api/voice/speak", {
        text: previewText,
        user_id: userId,
        voice_id: settings.selectedVoiceId,
        language: settings.language,
        speed: settings.speed
      });
      if (audio.audio_base64) playAudio(audio.audio_base64, audio.format);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PanelShell title="Voz" subtitle="TTS/STT y preferencias por usuario" icon={<Headphones size={20} />}>
      <div className="form-grid three">
        <label className="field"><span>Voz</span><select value={settings.selectedVoiceId} onChange={(event) => setSettings({ ...settings, selectedVoiceId: event.target.value })}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.displayName} · {voice.provider}</option>)}</select></label>
        <Field label="Idioma" value={settings.language} onChange={(value) => setSettings({ ...settings, language: value })} />
        <label className="field"><span>Velocidad {settings.speed}</span><input type="range" min="0.5" max="2" step="0.1" value={settings.speed} onChange={(event) => setSettings({ ...settings, speed: Number(event.target.value) })} /></label>
      </div>
      <div className="toggle-grid">
        <Toggle checked={settings.ttsEnabled} onChange={(ttsEnabled) => setSettings({ ...settings, ttsEnabled })} label="TTS" />
        <Toggle checked={settings.autoPlayResponses} onChange={(autoPlayResponses) => setSettings({ ...settings, autoPlayResponses })} label="Auto reproducir" />
        <Toggle checked={settings.sttEnabled} onChange={(sttEnabled) => setSettings({ ...settings, sttEnabled })} label="STT" />
        <Toggle checked={settings.wakeWordEnabled} onChange={(wakeWordEnabled) => setSettings({ ...settings, wakeWordEnabled })} label="Wake word" />
      </div>
      <div className="composer compact">
        <textarea value={previewText} onChange={(event) => setPreviewText(event.target.value)} />
        <button className="secondary" disabled={busy} onClick={() => void preview()}>{busy ? <RefreshCcw className="spin" size={16} /> : <Play size={16} />}Preview</button>
        <button className="primary" onClick={() => void save()}><Save size={16} />Guardar</button>
      </div>
    </PanelShell>
  );
}

function CommandsPanel({ api, notify }: { api: ApiClient; notify: (message: string) => void }) {
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [usage, setUsage] = useState<Usage["totals"]>({ uses: 0, aiFallbacks: 0, estimatedTokensSaved: 0 });
  const [form, setForm] = useState({ shortcut: "", intent: "alarm.create", params: "{\"time\":\"06:45\"}" });
  const load = async () => {
    const [catalog, personal, stats] = await Promise.all([api.get<{ commands: CommandDefinition[] }>("/api/commands"), api.get<{ shortcuts: Shortcut[] }>("/api/commands/shortcuts"), api.get<Usage>("/api/commands/usage")]);
    setCommands(catalog.commands);
    setShortcuts(personal.shortcuts);
    setUsage(stats.totals);
  };
  useEffect(() => { void load(); }, [api]);
  const create = async () => { await api.post("/api/commands/shortcuts", { shortcut: form.shortcut, intent: form.intent, params: JSON.parse(form.params) }); setForm({ ...form, shortcut: "" }); await load(); notify("Shortcut creado"); };
  const remove = async (id: string) => { await api.delete(`/api/commands/shortcuts/${id}`); await load(); };
  return (
    <PanelShell title="Comandos" subtitle="Registry deterministico antes de IA" icon={<ListChecks size={20} />}>
      <div className="metric-grid three">
        <Metric icon={<Check size={18} />} label="Usos optimizados" value={usage.uses} />
        <Metric icon={<Sparkles size={18} />} label="Tokens ahorrados" value={usage.estimatedTokensSaved} />
        <Metric icon={<Brain size={18} />} label="Fallbacks IA" value={usage.aiFallbacks} />
      </div>
      <div className="form-grid four">
        <Field label="Shortcut" value={form.shortcut} onChange={(shortcut) => setForm({ ...form, shortcut })} placeholder="tempranito" />
        <label className="field"><span>Intent</span><select value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })}>{commands.map((command) => <option key={command.name}>{command.name}</option>)}</select></label>
        <Field label="Params JSON" value={form.params} onChange={(params) => setForm({ ...form, params })} />
        <button className="primary self-end" disabled={!form.shortcut} onClick={() => void create()}><Plus size={16} />Crear</button>
      </div>
      <div className="data-list">{shortcuts.map((item) => <div className="data-row" key={item.id}><div><strong>{item.shortcut}</strong><span>{item.intent}</span></div><code>{JSON.stringify(item.params)}</code><button className="icon-button danger-text" onClick={() => void remove(item.id)}><Trash2 size={16} /></button></div>)}</div>
      <div className="command-grid">{commands.map((command) => <article key={command.name} className="command-card"><div><strong>{command.name}</strong><RiskBadge risk={command.riskLevel} /></div><p>{command.description}</p><span>{command.examples[0]}</span></article>)}</div>
    </PanelShell>
  );
}

function ConnectorsPanel({ api, userId, notify }: { api: ApiClient; userId: string; notify: (message: string) => void }) {
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const load = () => api.get<{ accounts: OAuthAccount[] }>(`/api/oauth/accounts?user_id=${encodeURIComponent(userId)}`).then((data) => setAccounts(data.accounts));
  useEffect(() => { void load(); }, [userId]);
  const connect = async (provider: "google" | "spotify") => {
    const data = await createApi().get<{ authorizationUrl: string; configured: boolean }>(`/api/oauth/${provider}/start?user_id=${encodeURIComponent(userId)}`);
    if (!data.configured) notify(`${provider} falta configurar client secret`);
    window.location.href = data.authorizationUrl;
  };
  const disconnect = async (provider: "google" | "spotify") => { await api.delete(`/api/oauth/${provider}?user_id=${encodeURIComponent(userId)}`); await load(); notify(`${provider} desconectado`); };
  return (
    <PanelShell title="Conectores" subtitle="OAuth por usuario, tokens cifrados en D1" icon={<Link2 size={20} />}>
      <div className="connector-grid">
        {(["google", "spotify"] as const).map((provider) => {
          const account = accounts.find((item) => item.provider === provider);
          return <article className="connector-card" key={provider}><div><Link2 size={18} /><strong>{provider}</strong></div><p>{account ? `Conectado: ${account.providerUserId}` : "No conectado"}</p>{account ? <button className="secondary danger-text" onClick={() => void disconnect(provider)}><X size={16} />Desconectar</button> : <button className="primary" onClick={() => void connect(provider)}><KeyRound size={16} />Conectar</button>}</article>;
        })}
      </div>
    </PanelShell>
  );
}

function UpdatesPanel({ api }: { api: ApiClient }) {
  const [platform, setPlatform] = useState<"windows" | "android">("windows");
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const load = () => api.get<{ manifest: UpdateManifest }>(`/api/updates/latest?platform=${platform}&channel=stable`).then((data) => setManifest(data.manifest));
  useEffect(() => { void load(); }, [platform]);
  return (
    <PanelShell title="Updates" subtitle="Manifest firmado/checksum antes de publicar" icon={<Download size={20} />} actions={<div className="segmented small"><button className={platform === "windows" ? "active" : ""} onClick={() => setPlatform("windows")}>Windows</button><button className={platform === "android" ? "active" : ""} onClick={() => setPlatform("android")}>Android</button></div>}>
      {manifest ? <div className="manifest"><h3>{manifest.platform} · {manifest.version}</h3><p>{manifest.changelog}</p><dl><dt>Canal</dt><dd>{manifest.channel}</dd><dt>SHA256</dt><dd>{manifest.sha256}</dd><dt>URL</dt><dd>{manifest.download_url}</dd></dl></div> : <EmptyState icon={<Download size={22} />} title="Sin manifest" text="No se pudo leer latest." />}
    </PanelShell>
  );
}

function SettingsPanel({ apiUrl, health }: { apiUrl: string; health: Health | null }) {
  return (
    <PanelShell title="Ajustes" subtitle="Entorno visible del frontend" icon={<Settings size={20} />}>
      <div className="settings-list">
        <InfoRow label="API publica" value={apiUrl} />
        <InfoRow label="Health" value={health?.ok ? "ok" : "pendiente"} />
        <InfoRow label="Web version" value={VERSION} />
        <InfoRow label="Secrets" value="Solo Worker, nunca frontend" />
      </div>
    </PanelShell>
  );
}

function PanelShell({ title, subtitle, icon, actions, children }: { title: string; subtitle: string; icon: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel-shell"><header className="panel-head"><div>{icon}<div><h1>{title}</h1><p>{subtitle}</p></div></div>{actions}</header><div className="panel-body">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button className={checked ? "toggle active" : "toggle"} type="button" onClick={() => onChange(!checked)}><span />{label}</button>;
}

function StatusPill({ state, label }: { state: ApiState; label: string }) {
  return <span className={`status-pill ${state}`}>{state === "loading" ? <RefreshCcw className="spin" size={14} /> : state === "ok" ? <Check size={14} /> : <CircleAlert size={14} />}{label}</span>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: "good" | "warn" }) {
  return <article className={`metric ${tone ?? ""}`}>{icon}<div><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong><span>{label}</span></div></article>;
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}>{icon}<span>{label}</span></button>;
}

function PlanPreview({ plan }: { plan: NonNullable<AssistantResponse["plan"]> }) {
  return <div className="plan-preview"><div><strong>{plan.title}</strong><RiskBadge risk={plan.riskLevel} /></div>{plan.ai ? <span>{plan.ai.provider} · {plan.ai.model}</span> : null}<ol>{plan.steps.map((step, index) => <li key={`${step.title}-${index}`}><span>{step.order ?? index + 1}</span><p>{step.title}</p><em>{step.status}</em></li>)}</ol></div>;
}

function RiskBadge({ risk }: { risk: Risk }) {
  return <span className={`risk-badge ${risk}`}>{risk}</span>;
}

function EditableRow({ title, subtitle, value, badge, onSave, onDelete }: { title: string; subtitle: string; value: string; badge: string; onSave: (value: string) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(value);
  return <div className="data-row"><div><strong>{title}</strong><span>{subtitle}</span></div><input value={draft} onChange={(event) => setDraft(event.target.value)} /><span className="soft-badge">{badge}</span><button className="icon-button" onClick={() => onSave(draft)}><Save size={16} /></button><button className="icon-button danger-text" onClick={onDelete}><Trash2 size={16} /></button></div>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{text}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>;
}

type ApiClient = ReturnType<typeof createApi>;

function createApi(token?: string) {
  const request = async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? data.message ?? `HTTP ${response.status}`);
    return data as T;
  };
  return {
    get: <T,>(path: string) => request<T>(path),
    post: <T,>(path: string, body?: unknown) => request<T>(path, body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) }),
    put: <T,>(path: string, body?: unknown) => request<T>(path, body === undefined ? { method: "PUT" } : { method: "PUT", body: JSON.stringify(body) }),
    delete: <T,>(path: string) => request<T>(path, { method: "DELETE" })
  };
}

function readStorage<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function decodeAuthFragment(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "XA";
}

function playAudio(base64: string, format: "mp3" | "wav" | "opus") {
  const audio = new Audio(`data:audio/${format};base64,${base64}`);
  void audio.play();
}

async function speakReply(api: ApiClient, userId: string, text: string, notify: (message: string) => void) {
  try {
    const audio = await api.post<{ audio_base64?: string; format: "mp3" | "wav" | "opus" }>("/api/voice/speak", {
      text,
      user_id: userId,
      voice_id: "Kore",
      language: "es-CL",
      speed: 1
    });
    if (audio.audio_base64) {
      playAudio(audio.audio_base64, audio.format);
      return;
    }
  } catch {
    // Browser TTS fallback keeps replies audible without another AI token path.
  }

  const synth = window.speechSynthesis;
  if (!synth) {
    notify("Audio no disponible");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-CL";
  utterance.rate = 1;
  synth.cancel();
  synth.speak(utterance);
}

createRoot(document.getElementById("root")!).render(<App />);
