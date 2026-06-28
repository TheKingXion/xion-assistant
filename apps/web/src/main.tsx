import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bot, Brain, Download, Mic, ShieldCheck, Volume2 } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8787";

type AssistantResponse = {
  status: string;
  response: string;
  plan?: {
    title: string;
    riskLevel: string;
    steps: Array<{ title: string; status: string }>;
  };
  audio?: { provider: string; voice_id: string } | null;
};

function App() {
  const [userId, setUserId] = useState("user-a");
  const [message, setMessage] = useState("Mandale a mi esposa que voy en camino");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const apiLabel = useMemo(() => API_URL.replace(/^https?:\/\//, ""), []);

  const rememberAlias = async () => {
    await fetch(`${API_URL}/api/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        memoryType: "contact_alias",
        key: "mi esposa",
        value: "Camila",
        confirmed: true,
        confidence: 1
      })
    });
  };

  const sendMessage = async () => {
    setBusy(true);
    await rememberAlias();
    const res = await fetch(`${API_URL}/api/assistant/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, message, spokenResponse: voiceEnabled })
    });
    setResponse(await res.json());
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-cloud text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-medium text-mint">v0.0.1 foundation</p>
            <h1 className="text-2xl font-semibold tracking-normal">Xion Assistant</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-steel">
            <ShieldCheck size={18} />
            <span>{apiLabel}</span>
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-3">
            <Panel icon={<Bot size={18} />} title="Usuario">
              <label className="label">user_id</label>
              <input className="input" value={userId} onChange={(event) => setUserId(event.target.value)} />
              <p className="hint">Toda memoria, voz e historial se filtra por usuario.</p>
            </Panel>

            <Panel icon={<Volume2 size={18} />} title="Voz">
              <label className="row">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(event) => setVoiceEnabled(event.target.checked)}
                />
                <span>Respuesta hablada mock</span>
              </label>
              <button className="secondary" type="button">
                <Mic size={16} />
                Preview voz
              </button>
            </Panel>

            <Panel icon={<Download size={18} />} title="Updates">
              <a className="link" href={`${API_URL}/api/updates/latest?platform=android&channel=stable`}>
                Android latest.json
              </a>
              <a className="link" href={`${API_URL}/api/updates/latest?platform=windows&arch=x64&channel=stable`}>
                Windows latest.json
              </a>
            </Panel>
          </aside>

          <section className="flex min-h-[640px] flex-col rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Brain size={18} />
              <h2 className="text-base font-semibold">Assistant Console</h2>
            </div>

            <div className="flex-1 space-y-4 p-4">
              <textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button className="primary" type="button" onClick={sendMessage} disabled={busy}>
                  <Bot size={16} />
                  {busy ? "Procesando" : "Crear plan"}
                </button>
                <button className="secondary" type="button" onClick={rememberAlias}>
                  <Brain size={16} />
                  Guardar alias
                </button>
              </div>

              {response ? (
                <div className="result">
                  <p className="status">{response.status}</p>
                  <p>{response.response}</p>
                  {response.plan ? (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">{response.plan.title}</h3>
                      <ol className="mt-2 space-y-2">
                        {response.plan.steps.map((step, index) => (
                          <li className="step" key={`${step.title}-${index}`}>
                            <span>{index + 1}</span>
                            <strong>{step.title}</strong>
                            <em>{step.status}</em>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {response.audio ? (
                    <p className="hint mt-4">
                      Audio mock generado por {response.audio.provider} con voz {response.audio.voice_id}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="empty">Ejecuta un mensaje para ver plan, confirmacion y voz.</div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
