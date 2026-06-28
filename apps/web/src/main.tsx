import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, Brain, LogIn, Plus, Power, Save, Send, Settings, ShieldCheck, Trash2, UserPlus, Volume2 } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8787";
type AuthState = { token: string; user: { id: string; email: string; displayName: string } };
type AssistantResponse = { status: string; response: string; usedAiFallback?: boolean; command?: string; plan?: { title: string; riskLevel: string; steps: Array<{ title: string; status: string }> }; audio?: { provider: string; voice_id: string } | null };
type CommandDefinition = { name: string; description: string; examples: string[]; riskLevel: string; requiresConfirmation: boolean };
type Shortcut = { id: string; shortcut: string; intent: string; params: Record<string, unknown>; isActive: boolean; confirmed: boolean };
type Usage = { totals: { uses: number; aiFallbacks: number; estimatedTokensSaved: number } };

function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => { try { return JSON.parse(localStorage.getItem("xion_auth") ?? "null"); } catch { return null; } });
  const [view, setView] = useState<"assistant" | "commands">("assistant");
  const [message, setMessage] = useState("Pon una alarma a las 6:45");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const apiLabel = useMemo(() => API_URL.replace(/^https?:\/\//, ""), []);

  const authorize = (headers: Record<string, string> = {}) => ({ ...headers, authorization: `Bearer ${auth?.token ?? ""}` });
  const setSession = (next: AuthState) => { localStorage.setItem("xion_auth", JSON.stringify(next)); setAuth(next); };

  const sendMessage = async () => {
    if (!auth) return;
    setBusy(true);
    setResponse(null);
    const res = await fetch(`${API_URL}/api/assistant/message`, {
      method: "POST",
      headers: authorize({ "content-type": "application/json" }),
      body: JSON.stringify({ message, spokenResponse: voiceEnabled, platform: "web", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    });
    setResponse(await res.json());
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-cloud text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div><p className="text-sm font-medium text-mint">v0.10.0</p><h1 className="text-2xl font-semibold tracking-normal">Xion Assistant</h1></div>
          <div className="flex items-center gap-2 text-sm text-steel"><ShieldCheck size={18} /><span>{apiLabel}</span></div>
        </header>

        {!auth ? <AuthPanel onAuthenticated={setSession} /> : (
          <section className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-3">
              <Panel icon={<Bot size={18} />} title={auth.user.displayName}>
                <p className="hint break-all">{auth.user.email}</p>
                <button className="secondary mt-3" type="button" onClick={() => { localStorage.removeItem("xion_auth"); setAuth(null); }}>Cerrar sesion</button>
              </Panel>
              <nav className="nav-panel" aria-label="Secciones">
                <button className={view === "assistant" ? "nav-item active" : "nav-item"} onClick={() => setView("assistant")}><Brain size={17} />Assistant</button>
                <button className={view === "commands" ? "nav-item active" : "nav-item"} onClick={() => setView("commands")}><Settings size={17} />Comandos optimizados</button>
              </nav>
              <Panel icon={<Volume2 size={18} />} title="Voz">
                <label className="row"><input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} /><span>Respuesta hablada</span></label>
              </Panel>
            </aside>

            {view === "assistant" ? (
              <section className="workspace">
                <div className="workspace-title"><Brain size={18} /><h2>Assistant Console</h2></div>
                <div className="flex-1 space-y-4 p-4">
                  <textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
                  <button className="primary" type="button" onClick={sendMessage} disabled={busy}><Send size={16} />{busy ? "Procesando" : "Enviar"}</button>
                  {response ? <AssistantResult response={response} /> : <div className="empty">Escribe una orden o pregunta.</div>}
                </div>
              </section>
            ) : <CommandsPanel token={auth.token} />}
          </section>
        )}
      </div>
    </main>
  );
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: (auth: AuthState) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const submit = async (mode: "login" | "register") => {
    const res = await fetch(`${API_URL}/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, ...(mode === "register" ? { displayName: email.split("@")[0] } : {}) }) });
    const data = await res.json() as AuthState & { error?: string };
    if (!res.ok) return setError(data.error ?? "No se pudo iniciar sesion");
    onAuthenticated(data);
  };
  return <section className="auth-shell"><div><ShieldCheck size={28} /><h2>Acceso privado</h2><p>Tu memoria y shortcuts quedan aislados por cuenta.</p></div><div className="auth-form"><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><label className="label mt-3">Contrasena</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />{error ? <p className="error">{error}</p> : null}<div className="mt-4 flex gap-2"><button className="primary" onClick={() => submit("login")}><LogIn size={16} />Entrar</button><button className="secondary" onClick={() => submit("register")}><UserPlus size={16} />Crear cuenta</button></div></div></section>;
}

function CommandsPanel({ token }: { token: string }) {
  const [commands, setCommands] = useState<CommandDefinition[]>([]); const [shortcuts, setShortcuts] = useState<Shortcut[]>([]); const [usage, setUsage] = useState<Usage["totals"]>({ uses: 0, aiFallbacks: 0, estimatedTokensSaved: 0 });
  const [phrase, setPhrase] = useState(""); const [intent, setIntent] = useState("alarm.create"); const [params, setParams] = useState('{"time":"06:45"}');
  const headers = { authorization: `Bearer ${token}` };
  const load = async () => {
    const [catalogRes, shortcutsRes, usageRes] = await Promise.all([fetch(`${API_URL}/api/commands`, { headers }), fetch(`${API_URL}/api/commands/shortcuts`, { headers }), fetch(`${API_URL}/api/commands/usage`, { headers })]);
    const catalog = await catalogRes.json() as { commands: CommandDefinition[] }; const personal = await shortcutsRes.json() as { shortcuts: Shortcut[] }; const stats = await usageRes.json() as Usage;
    setCommands(catalog.commands ?? []); setShortcuts(personal.shortcuts ?? []); setUsage(stats.totals ?? usage);
  };
  useEffect(() => { void load(); }, [token]);
  const create = async () => { await fetch(`${API_URL}/api/commands/shortcuts`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ shortcut: phrase, intent, params: JSON.parse(params) }) }); setPhrase(""); await load(); };
  const update = async (item: Shortcut, patch: Partial<Shortcut>) => { await fetch(`${API_URL}/api/commands/shortcuts/${item.id}`, { method: "PUT", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(patch) }); await load(); };
  const remove = async (id: string) => { await fetch(`${API_URL}/api/commands/shortcuts/${id}`, { method: "DELETE", headers }); await load(); };
  return <section className="workspace"><div className="workspace-title"><Settings size={18} /><h2>Configuracion / Comandos optimizados</h2></div><div className="space-y-6 p-4">
    <p className="privacy-note"><ShieldCheck size={17} />Estos comandos son privados para tu usuario y no se comparten con otros usuarios.</p>
    <div className="stats"><Stat label="Usos optimizados" value={usage.uses} /><Stat label="Tokens ahorrados" value={usage.estimatedTokensSaved} /><Stat label="Fallbacks IA" value={usage.aiFallbacks} /></div>
    <section><h3 className="section-title">Nuevo shortcut</h3><div className="shortcut-form"><input className="input" placeholder="tempranito" value={phrase} onChange={(e) => setPhrase(e.target.value)} /><select className="input" value={intent} onChange={(e) => setIntent(e.target.value)}>{commands.map((command) => <option key={command.name}>{command.name}</option>)}</select><input className="input" value={params} onChange={(e) => setParams(e.target.value)} /><button className="primary" disabled={!phrase} onClick={create}><Plus size={16} />Crear</button></div></section>
    <section><h3 className="section-title">Shortcuts personales</h3><div className="command-list">{shortcuts.length ? shortcuts.map((item) => <ShortcutRow key={item.id} item={item} onUpdate={update} onDelete={remove} />) : <p className="empty">Aun no tienes shortcuts.</p>}</div></section>
    <section><h3 className="section-title">Comandos del sistema</h3><div className="command-grid">{commands.map((command) => <article className="command-card" key={command.name}><div><strong>{command.name}</strong><span className={`risk ${command.riskLevel}`}>{command.riskLevel}</span></div><p>{command.description}</p><small>{command.examples[0]}</small></article>)}</div></section>
  </div></section>;
}

function ShortcutRow({ item, onUpdate, onDelete }: { item: Shortcut; onUpdate: (item: Shortcut, patch: Partial<Shortcut>) => void; onDelete: (id: string) => void }) {
  const [phrase, setPhrase] = useState(item.shortcut); const [params, setParams] = useState(JSON.stringify(item.params));
  return <div className="shortcut-row"><input className="input" value={phrase} onChange={(e) => setPhrase(e.target.value)} /><code>{item.intent}</code><input className="input" value={params} onChange={(e) => setParams(e.target.value)} /><div className="icon-actions"><button title="Guardar" onClick={() => onUpdate(item, { shortcut: phrase, params: JSON.parse(params) })}><Save size={17} /></button><button title={item.isActive ? "Desactivar" : "Activar"} className={item.isActive ? "enabled" : ""} onClick={() => onUpdate(item, { isActive: !item.isActive })}><Power size={17} /></button><button title="Eliminar" className="danger" onClick={() => onDelete(item.id)}><Trash2 size={17} /></button></div></div>;
}

function AssistantResult({ response }: { response: AssistantResponse }) { return <div className="result"><div className="flex items-center gap-2"><p className="status">{response.status}</p>{response.command ? <code>{response.command}</code> : null}</div><p>{response.response}</p>{response.plan ? <ol className="mt-4 space-y-2">{response.plan.steps.map((step, index) => <li className="step" key={`${step.title}-${index}`}><span>{index + 1}</span><strong>{step.title}</strong><em>{step.status}</em></li>)}</ol> : null}</div>; }
function Stat({ label, value }: { label: string; value: number }) { return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>; }
function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center gap-2">{icon}<h2 className="text-sm font-semibold">{title}</h2></div>{children}</section>; }

createRoot(document.getElementById("root")!).render(<App />);
