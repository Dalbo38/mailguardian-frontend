import React, { useState } from "react";

const BACKEND_URL = "https://mailguardian-backend.onrender.com";

const analyzeEmailWithAI = async (email) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Tu es un expert en cybersécurité. Analyse cet email et retourne UNIQUEMENT un JSON valide sans markdown ni backticks.

De : ${email.from} (${email.name})
Sujet : ${email.subject}
Corps : ${email.body}

JSON attendu :
{"category":"PHISHING"|"ARNAQUE"|"SPAM"|"SUSPECT"|"LEGITIME","score":0-100,"reasons":["...","...","..."],"action":"..."}`
      }],
    }),
  });
  const data = await response.json();
  const text = data.content.map(i => i.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

const THREAT = {
  PHISHING: { label: "Phishing",  color: "#ff2d55", bg: "rgba(255,45,85,0.08)",   icon: "🎣" },
  ARNAQUE:  { label: "Arnaque",   color: "#ff9500", bg: "rgba(255,149,0,0.08)",   icon: "⚠️" },
  SPAM:     { label: "Spam",      color: "#ffd60a", bg: "rgba(255,214,10,0.08)",  icon: "📢" },
  SUSPECT:  { label: "Suspect",   color: "#bf5af2", bg: "rgba(191,90,242,0.08)", icon: "🔍" },
  LEGITIME: { label: "Légitime",  color: "#30d158", bg: "rgba(48,209,88,0.08)",  icon: "✅" },
};

export default function MailGuardian() {
  const [screen, setScreen] = useState("login");
  const [emailAddr, setEmailAddr] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [scanAll, setScanAll] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [filter, setFilter] = useState("TOUS");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleConnect = async () => {
    if (!emailAddr || !password) { setConnError("Veuillez remplir tous les champs."); return; }
    setConnecting(true); setConnError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr, password, limit: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setEmails(data.emails);
      setScreen("app");
      showToast(`✅ Connecté — ${data.emails.length} emails chargés`, "success");
    } catch (err) {
      setConnError(err.message);
    }
    setConnecting(false);
  };

  const analyzeOne = async (em) => {
    if (results[em.id]) return;
    setAnalyzingId(em.id);
    try {
      const r = await analyzeEmailWithAI(em);
      setResults(p => ({ ...p, [em.id]: r }));
      showToast(`${em.name} → ${THREAT[r.category]?.label}`, r.category === "LEGITIME" ? "success" : "warning");
    } catch (e) { showToast("Erreur analyse", "error"); }
    setAnalyzingId(null);
  };

  const analyzeAll = async () => {
    setScanAll(true); setScanProgress(0);
    const todo = emails.filter(e => !results[e.id]);
    for (let i = 0; i < todo.length; i++) {
      setAnalyzingId(todo[i].id);
      try {
        const r = await analyzeEmailWithAI(todo[i]);
        setResults(p => ({ ...p, [todo[i].id]: r }));
      } catch (e) {}
      setScanProgress(Math.round((i + 1) / todo.length * 100));
    }
    setAnalyzingId(null); setScanAll(false);
    showToast("Analyse complète terminée !", "success");
  };

  const filtered = emails.filter(e => {
    if (filter === "TOUS") return true;
    if (filter === "NON_ANALYSÉS") return !results[e.id];
    return results[e.id]?.category === filter;
  });

  const stats = {
    total: emails.length,
    analyzed: Object.keys(results).length,
    threats: Object.values(results).filter(r => r.category !== "LEGITIME").length,
    safe: Object.values(results).filter(r => r.category === "LEGITIME").length,
  };

  if (screen === "login") return (
    <LoginScreen
      email={emailAddr} setEmail={setEmailAddr}
      password={password} setPassword={setPassword}
      onConnect={handleConnect} connecting={connecting} error={connError}
    />
  );

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#0f0f14", minHeight: "100vh", color: "#e2ddf0", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#13131f,#1a1030)", borderBottom: "1px solid #2a2040", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#ff2d55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f0eaff" }}>Mail Guardian</div>
            <div style={{ fontSize: 10, color: "#6a5a8a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{emailAddr}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[["Emails", stats.total, "#8a7aaa"], ["Analysés", stats.analyzed, "#7c3aed"], ["Menaces", stats.threats, "#ff2d55"], ["Sûrs", stats.safe, "#30d158"]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
              <div style={{ fontSize: 9, color: "#3a2a5a", textTransform: "uppercase", letterSpacing: "0.1em" }}>{l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ background: "#0d0d1a", borderBottom: "1px solid #1e1a2e", padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={analyzeAll} disabled={scanAll || !!analyzingId}
          style={{ background: scanAll ? "#1a1530" : "linear-gradient(135deg,#7c3aed,#bf5af2)", border: "none", borderRadius: 7, color: "#fff", padding: "7px 16px", cursor: scanAll ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
          {scanAll ? `⟳ Scan… ${scanProgress}%` : "🔍 Tout analyser"}
        </button>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["TOUS", "NON_ANALYSÉS", "PHISHING", "ARNAQUE", "SPAM", "SUSPECT", "LEGITIME"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background: filter === f ? (THREAT[f]?.color || "#7c3aed") + "20" : "transparent", border: `1px solid ${filter === f ? (THREAT[f]?.color || "#7c3aed") : "#2a2040"}`, borderRadius: 5, color: filter === f ? (THREAT[f]?.color || "#bf5af2") : "#4a3a6a", padding: "3px 9px", cursor: "pointer", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
              {f === "TOUS" ? "Tous" : f === "NON_ANALYSÉS" ? "Non analysés" : `${THREAT[f]?.icon} ${THREAT[f]?.label}`}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Email list */}
        <div style={{ width: "35%", minWidth: 250, borderRight: "1px solid #1e1a2e", overflowY: "auto", flexShrink: 0 }}>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#2a1a4a", fontSize: 12 }}>Aucun email</div>}
          {filtered.map(em => {
            const r = results[em.id];
            const t = r ? THREAT[r.category] : null;
            const isAn = analyzingId === em.id;
            return (
              <div key={em.id} onClick={() => setSelected(em)}
                style={{ padding: "12px 14px", borderBottom: "1px solid #16122a", cursor: "pointer", background: selected?.id === em.id ? "#1a1530" : "transparent", borderLeft: `3px solid ${t ? t.color : isAn ? "#7c3aed" : "transparent"}`, transition: "background 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e2ddf0", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {isAn && <span style={{ fontSize: 10, color: "#7c3aed" }}>…</span>}
                    {t && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: t.bg, color: t.color, fontWeight: 700, border: `1px solid ${t.color}33`, whiteSpace: "nowrap" }}>{t.icon} {t.label}</span>}
                    {r && <span style={{ fontSize: 10, fontFamily: "monospace", color: r.score > 60 ? "#ff2d55" : r.score > 30 ? "#ff9500" : "#30d158", fontWeight: 700 }}>{r.score}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#8a7aaa", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em.subject}</div>
                <div style={{ fontSize: 10, color: "#3a2a5a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em.date}</div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {selected ? (
            <EmailDetail email={selected} result={results[selected.id]} isAnalyzing={analyzingId === selected.id} onAnalyze={() => analyzeOne(selected)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, opacity: 0.3 }}>
              <div style={{ fontSize: 48 }}>🛡️</div>
              <div style={{ fontSize: 13, color: "#8a7aaa" }}>Sélectionnez un email</div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, padding: "10px 18px", borderRadius: 9, background: toast.type === "success" ? "#30d15818" : toast.type === "warning" ? "#ff950018" : "#ff2d5518", border: `1px solid ${toast.type === "success" ? "#30d158" : toast.type === "warning" ? "#ff9500" : "#ff2d55"}`, color: "#e2ddf0", fontSize: 12, zIndex: 1000, maxWidth: 300 }}>
          {toast.msg}
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #2a2040; border-radius: 2px; }
      `}</style>
    </div>
  );
}

function LoginScreen({ email, setEmail, password, setPassword, onConnect, connecting, error }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#7c3aed,#ff2d55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>🛡️</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f0eaff", letterSpacing: "-0.02em" }}>Mail Guardian</div>
          <div style={{ fontSize: 13, color: "#5a4a7a", marginTop: 6 }}>Protection IA pour votre boîte Outlook</div>
        </div>

        <div style={{ background: "#13131f", border: "1px solid #2a2040", borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: "#5a4a7a", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7, fontWeight: 600 }}>Adresse email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="albo38@hotmail.fr"
              onKeyDown={e => e.key === "Enter" && onConnect()}
              style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2040", borderRadius: 8, padding: "11px 14px", color: "#e2ddf0", fontSize: 14, outline: "none" }} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 11, color: "#5a4a7a", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 7, fontWeight: 600 }}>Mot de passe d'application</label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" placeholder="xxxx xxxx xxxx xxxx"
              onKeyDown={e => e.key === "Enter" && onConnect()}
              style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2040", borderRadius: 8, padding: "11px 14px", color: "#e2ddf0", fontSize: 14, outline: "none" }} />
            <div style={{ fontSize: 10, color: "#3a2a5a", marginTop: 6, lineHeight: 1.5 }}>⚠️ Utilisez le mot de passe d'application de 16 caractères, pas votre mot de passe habituel</div>
          </div>

          {error && (
            <div style={{ background: "#ff2d5512", border: "1px solid #ff2d5540", borderRadius: 8, padding: "10px 14px", color: "#ff6b85", fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
              ❌ {error}
            </div>
          )}

          <button onClick={onConnect} disabled={connecting}
            style={{ width: "100%", background: connecting ? "#1a1530" : "linear-gradient(135deg,#7c3aed,#bf5af2)", border: "none", borderRadius: 10, color: "#fff", padding: "13px", cursor: connecting ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}>
            {connecting
              ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Connexion en cours…</>
              : "🔗 Se connecter à Outlook"}
          </button>

          <div style={{ marginTop: 16, fontSize: 11, color: "#3a2a5a", textAlign: "center" }}>
            ⏱️ La première connexion peut prendre 30-60 secondes (réveil du serveur)
          </div>
        </div>

        <div style={{ marginTop: 14, background: "#0d1a10", border: "1px solid #1a3020", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#30d158", fontWeight: 700, marginBottom: 5 }}>🔒 Vos données restent privées</div>
          <div style={{ fontSize: 10, color: "#2a5a3a", lineHeight: 1.6 }}>
            Le mot de passe d'application peut être révoqué à tout moment depuis votre compte Microsoft. Aucune donnée n'est stockée.
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } body { margin: 0; }`}</style>
    </div>
  );
}

function EmailDetail({ email, result, isAnalyzing, onAnalyze }) {
  const t = result ? THREAT[result.category] : null;
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#f0eaff", marginBottom: 10, lineHeight: 1.4 }}>{email.subject}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#8a7aaa" }}>
              <span style={{ color: "#3a2a5a" }}>De : </span>
              <span style={{ color: "#e2ddf0", fontWeight: 600 }}>{email.name}</span>
              <span style={{ color: "#3a2a5a" }}> &lt;{email.from}&gt;</span>
            </div>
            <div style={{ fontSize: 11, color: "#2a1a4a", marginTop: 3 }}>{email.date}</div>
          </div>
          {!result && !isAnalyzing && (
            <button onClick={onAnalyze}
              style={{ background: "linear-gradient(135deg,#7c3aed,#bf5af2)", border: "none", borderRadius: 8, color: "#fff", padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              🔍 Analyser cet email
            </button>
          )}
          {isAnalyzing && (
            <div style={{ color: "#7c3aed", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Analyse en cours…
            </div>
          )}
        </div>
      </div>

      {result && (
        <div style={{ background: t.bg, border: `1px solid ${t.color}33`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28 }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.color }}>{t.label}</div>
                <div style={{ fontSize: 10, color: "#5a4a7a", textTransform: "uppercase", letterSpacing: "0.1em" }}>Catégorie détectée</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: result.score > 60 ? "#ff2d55" : result.score > 30 ? "#ff9500" : "#30d158" }}>
                {result.score}<span style={{ fontSize: 13, color: "#3a2a5a" }}>/100</span>
              </div>
              <div style={{ width: 70, height: 3, background: "#1a1530", borderRadius: 2, margin: "4px auto 0", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${result.score}%`, background: result.score > 60 ? "#ff2d55" : result.score > 30 ? "#ff9500" : "#30d158", borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: "#3a2a5a", marginTop: 3, textTransform: "uppercase" }}>Indice de danger</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#3a2a5a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>Signaux détectés</div>
            {result.reasons.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#a090c0", marginBottom: 6 }}>
                <span style={{ color: t.color, flexShrink: 0 }}>▸</span>{r}
              </div>
            ))}
          </div>
          <div style={{ background: "#0a0a14", borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${t.color}` }}>
            <div style={{ fontSize: 10, color: "#3a2a5a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 700 }}>Action recommandée</div>
            <div style={{ fontSize: 12, color: "#e2ddf0", lineHeight: 1.6 }}>{result.action}</div>
          </div>
        </div>
      )}

      <div style={{ background: "#0d0d1a", border: "1px solid #1e1a2e", borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#2a1a4a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>Contenu de l'email</div>
        <pre style={{ fontSize: 12, color: "#8a7aaa", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7, margin: 0 }}>{email.body}</pre>
      </div>
    </div>
  );
}
