import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "medium", label: "Medium", icon: "M", color: "#000" },
  { id: "dev", label: "DEV Community", icon: "DEV", color: "#3b49df" },
  { id: "tutorials_dojo", label: "Tutorials Dojo", icon: "TD", color: "#ff6b35" },
  { id: "personal_blog", label: "Personal Blog", icon: "✦", color: "#7c3aed" },
  { id: "docs", label: "Documentation", icon: "📄", color: "#0284c7" },
];
const AUDIENCES = ["Beginner", "Intermediate", "Advanced", "Expert"];
const REWRITE_STYLES = [
  { id: "professional", label: "Professional", icon: "ti-briefcase" },
  { id: "beginner_friendly", label: "Beginner-Friendly", icon: "ti-school" },
  { id: "concise", label: "Concise", icon: "ti-scissors" },
  { id: "technical", label: "Technical", icon: "ti-code" },
  { id: "seo_optimized", label: "SEO Optimized", icon: "ti-trending-up" },
];
const PLATFORM_IMAGE_SPECS = {
  medium: { minW: 900, minH: 500, maxMB: 5, ratio: "16:9", label: "Medium" },
  dev: { minW: 1000, minH: 420, maxMB: 3, ratio: "2.4:1", label: "DEV Community" },
  tutorials_dojo: { minW: 800, minH: 450, maxMB: 4, ratio: "16:9", label: "Tutorials Dojo" },
  personal_blog: { minW: 600, minH: 300, maxMB: 8, ratio: "any", label: "Personal Blog" },
  docs: { minW: 700, minH: 400, maxMB: 5, ratio: "any", label: "Docs" },
};

// ─── Utilities ─────────────────────────────────────────────────────────────────
function analyzeImageLocally(file, imgEl) {
  const w = imgEl.naturalWidth, h = imgEl.naturalHeight;
  const sizeMB = file.size / 1024 / 1024;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const g = gcd(w, h);
  const ratio = `${w / g}:${h / g}`;
  const results = {};
  for (const [pid, spec] of Object.entries(PLATFORM_IMAGE_SPECS)) {
    const issues = [];
    if (w < spec.minW) issues.push(`Width too small (need ≥${spec.minW}px)`);
    if (h < spec.minH) issues.push(`Height too small (need ≥${spec.minH}px)`);
    if (sizeMB > spec.maxMB) issues.push(`File too large (max ${spec.maxMB}MB)`);
    results[pid] = { ok: issues.length === 0, issues };
  }
  const blurScore = w * h < 200000 ? "Possibly low resolution" : w * h > 4000000 ? "High resolution" : "Good resolution";
  return { w, h, sizeMB: sizeMB.toFixed(2), ratio, blurScore, platforms: results };
}

function countWords(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chars = text.length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const readingTime = Math.ceil(words.length / 200);
  return { words: words.length, chars, paragraphs, readingTime };
}

function grammarCheck(text) {
  const issues = [];
  const passivePatterns = [/\b(was|were|is|are|been|being|be)\s+\w+ed\b/gi];
  passivePatterns[0].lastIndex = 0;
  let m;
  while ((m = passivePatterns[0].exec(text)) !== null) {
    issues.push({ type: "passive", msg: `Passive voice: "${m[0]}"`, index: m.index, len: m[0].length });
  }
  const wordFreq = {};
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
  const repeated = Object.entries(wordFreq).filter(([w, c]) => c > 5 && !["that","this","with","from","have","they","will","your","when","then","than","been","into","some","also","more","about","which","their","there","would","could","should","these"].includes(w));
  for (const [w, c] of repeated) {
    issues.push({ type: "repeated", msg: `"${w}" used ${c} times` });
  }
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  const avgLen = sentenceCount ? (text.length / sentenceCount) : 0;
  if (avgLen > 200) issues.push({ type: "long_sentence", msg: "Some sentences may be too long" });
  const score = Math.max(0, 100 - issues.length * 8);
  return { issues, score };
}

async function callClaude(messages, system, onChunk) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      stream: true,
      messages,
    }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "content_block_delta" && ev.delta?.text) {
          full += ev.delta.text;
          onChunk?.(full);
        }
      } catch {}
    }
  }
  return full;
}

// ─── Markdown Renderer ─────────────────────────────────────────────────────────
function MarkdownPreview({ content }) {
  const html = useMemo(() => {
    let s = content
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/```[\w]*\n([\s\S]*?)```/gm, "<pre><code>$1</code></pre>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
    return `<p>${s}</p>`;
  }, [content]);
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Version History ───────────────────────────────────────────────────────────
function useVersionHistory(initial = "") {
  const [versions, setVersions] = useState([{ content: initial, ts: Date.now() }]);
  const [idx, setIdx] = useState(0);
  const push = useCallback((content) => {
    setVersions(v => {
      const trimmed = v.slice(0, idx + 1);
      return [...trimmed, { content, ts: Date.now() }];
    });
    setIdx(i => i + 1);
  }, [idx]);
  const undo = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const redo = useCallback(() => setVersions(v => { setIdx(i => Math.min(v.length - 1, i + 1)); return v; }), []);
  return { content: versions[idx]?.content ?? "", push, undo, redo, canUndo: idx > 0, canRedo: idx < versions.length - 1, versions, idx };
}

// ─── Export Helpers ───────────────────────────────────────────────────────────
function exportMarkdown(content, title) {
  const blob = new Blob([content], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
  a.click();
}

function exportHTML(content, title) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}pre{background:#f4f4f4;padding:16px;border-radius:6px;overflow-x:auto}blockquote{border-left:4px solid #ddd;padding-left:16px;color:#666}h1,h2,h3{font-family:system-ui,sans-serif}</style></head><body>${content}</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.html`;
  a.click();
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = { blue: "#dbeafe:#1e40af", green: "#dcfce7:#166534", amber: "#fef3c7:#92400e", red: "#fee2e2:#991b1b", purple: "#ede9fe:#5b21b6", gray: "#f3f4f6:#374151" };
  const [bg, fg] = (colors[color] || colors.gray).split(":");
  return <span style={{ background: bg, color: fg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}>{children}</span>;
}

function IconBtn({ icon, onClick, title, disabled, active }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{ background: active ? "var(--color-background-secondary)" : "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, padding: "5px 8px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, fontSize: 13, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
      <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
    </button>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--color-border-tertiary)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

// ─── Section: Generate Form ────────────────────────────────────────────────────
function GeneratePanel({ onGenerate, generating }) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("medium");
  const [stack, setStack] = useState("");
  const [audience, setAudience] = useState("Intermediate");
  const [keywords, setKeywords] = useState("");

  const handleSubmit = () => {
    if (!topic.trim()) return;
    onGenerate({ topic, platform, stack, audience, keywords });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>TOPIC / TITLE</label>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Building a REST API with Node.js and Express" style={{ width: "100%", fontSize: 14 }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 8 }}>TARGET PLATFORM</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)} style={{ border: platform === p.id ? `2px solid ${p.color}` : "0.5px solid var(--color-border-tertiary)", background: platform === p.id ? `${p.color}15` : "transparent", color: platform === p.id ? p.color : "var(--color-text-secondary)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>TECH STACK</label>
          <input value={stack} onChange={e => setStack(e.target.value)} placeholder="e.g. React, TypeScript, AWS" style={{ fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>AUDIENCE LEVEL</label>
          <select value={audience} onChange={e => setAudience(e.target.value)} style={{ fontSize: 14, width: "100%" }}>
            {AUDIENCES.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>SEO KEYWORDS <span style={{ fontWeight: 400, opacity: 0.6 }}>(comma-separated)</span></label>
        <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. REST API, Node.js tutorial, Express middleware" style={{ fontSize: 14 }} />
      </div>

      <button onClick={handleSubmit} disabled={generating || !topic.trim()} style={{ background: generating ? "var(--color-background-secondary)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: generating ? "var(--color-text-secondary)" : "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
        {generating ? <><Spinner /> Generating article…</> : <><i className="ti ti-sparkles" /> Generate Article</>}
      </button>
    </div>
  );
}

// ─── Section: Editor ──────────────────────────────────────────────────────────
function EditorPanel({ content, onChange, onUndo, onRedo, canUndo, canRedo, grammarIssues, grammarScore, wordStats }) {
  const [mode, setMode] = useState("edit");
  const textRef = useRef(null);
  const saveTimerRef = useRef(null);

  const handleChange = (val) => {
    onChange(val);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem("tw_autosave", val);
    }, 1500);
  };

  const insertFormat = (prefix, suffix = "") => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = content.slice(start, end) || "text";
    const newContent = content.slice(0, start) + prefix + sel + suffix + content.slice(end);
    handleChange(newContent);
  };

  const scoreColor = grammarScore >= 80 ? "#16a34a" : grammarScore >= 60 ? "#d97706" : "#dc2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderBottom: "0.5px solid var(--color-border-tertiary)", flexWrap: "wrap" }}>
        <IconBtn icon="ti-arrow-back-up" onClick={onUndo} disabled={!canUndo} title="Undo" />
        <IconBtn icon="ti-arrow-forward-up" onClick={onRedo} disabled={!canRedo} title="Redo" />
        <div style={{ width: 1, height: 20, background: "var(--color-border-tertiary)", margin: "0 4px" }} />
        <IconBtn icon="ti-bold" onClick={() => insertFormat("**", "**")} title="Bold" />
        <IconBtn icon="ti-italic" onClick={() => insertFormat("*", "*")} title="Italic" />
        <IconBtn icon="ti-code" onClick={() => insertFormat("`", "`")} title="Inline Code" />
        <IconBtn icon="ti-quote" onClick={() => insertFormat("> ")} title="Blockquote" />
        <div style={{ flex: 1 }} />
        {/* Mode toggle */}
        <div style={{ display: "flex", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, overflow: "hidden" }}>
          {["edit", "preview", "split"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? "var(--color-background-secondary)" : "transparent", border: "none", padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", color: mode === m ? "var(--color-text-primary)" : "var(--color-text-secondary)", textTransform: "capitalize" }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Word stats */}
      <div style={{ display: "flex", gap: 16, padding: "6px 12px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
        {[["ti-file-text", `${wordStats.words} words`], ["ti-letter-case", `${wordStats.chars} chars`], ["ti-clock", `${wordStats.readingTime} min read`], ["ti-layout-list", `${wordStats.paragraphs} paragraphs`]].map(([icon, val]) => (
          <span key={icon} style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
            <i className={`ti ${icon}`} style={{ fontSize: 13 }} />{val}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor, display: "flex", alignItems: "center", gap: 4 }}>
          <i className="ti ti-award" style={{ fontSize: 13 }} />Quality: {grammarScore}
        </span>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 400 }}>
        {(mode === "edit" || mode === "split") && (
          <textarea ref={textRef} value={content} onChange={e => handleChange(e.target.value)} style={{ flex: 1, resize: "none", border: "none", outline: "none", padding: 16, fontSize: 13, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: 1.7, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        )}
        {mode === "split" && <div style={{ width: 1, background: "var(--color-border-tertiary)" }} />}
        {(mode === "preview" || mode === "split") && (
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>

      {/* Grammar issues */}
      {grammarIssues.length > 0 && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "8px 12px", maxHeight: 120, overflow: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>GRAMMAR & STYLE SUGGESTIONS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {grammarIssues.slice(0, 8).map((iss, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: iss.type === "passive" ? "#fef3c7" : iss.type === "repeated" ? "#fee2e2" : "#f0fdf4", color: iss.type === "passive" ? "#92400e" : iss.type === "repeated" ? "#991b1b" : "#166534" }}>
                {iss.msg}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Image Analyzer ──────────────────────────────────────────────────
function ImageAnalyzer({ activePlatform }) {
  const [images, setImages] = useState([]);
  const dropRef = useRef(null);

  const processFile = useCallback((file) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const analysis = analyzeImageLocally(file, img);
      setImages(prev => [{
        id: Date.now(),
        name: file.name,
        url,
        ...analysis,
      }, ...prev]);
    };
    img.src = url;
  }, []);

  const onDrop = e => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(processFile);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div ref={dropRef} onDrop={onDrop} onDragOver={e => e.preventDefault()} style={{ border: "1.5px dashed var(--color-border-tertiary)", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer" }} onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.onchange = e => Array.from(e.target.files).forEach(processFile); inp.click(); }}>
        <i className="ti ti-photo-up" style={{ fontSize: 28, color: "var(--color-text-secondary)", display: "block", marginBottom: 8 }} />
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Drop images or click to upload</div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>Analyzed locally — no API calls</div>
      </div>

      {images.map(img => (
        <div key={img.id} style={{ background: "var(--color-background-secondary)", borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ display: "flex", gap: 12, padding: 12 }}>
            <img src={img.url} alt={img.name} style={{ width: 80, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Badge color="blue">{img.w}×{img.h}</Badge>
                <Badge color="purple">{img.ratio}</Badge>
                <Badge color="gray">{img.sizeMB}MB</Badge>
                <Badge color={img.w * img.h > 200000 ? "green" : "amber"}>{img.blurScore}</Badge>
              </div>
            </div>
            <button onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", fontSize: 16, alignSelf: "flex-start" }}>×</button>
          </div>
          <div style={{ padding: "0 12px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>PLATFORM COMPATIBILITY</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PLATFORMS.map(p => {
                const r = img.platforms[p.id];
                return (
                  <div key={p.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: r.ok ? "#dcfce7" : "#fee2e2", color: r.ok ? "#166534" : "#991b1b" }} title={r.issues.join(", ") || "OK"}>
                    {r.ok ? "✓" : "✗"} {p.label}
                  </div>
                );
              })}
            </div>
            {PLATFORMS.map(p => {
              const issues = img.platforms[p.id].issues;
              if (!issues.length) return null;
              return <div key={p.id} style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{p.label}: {issues.join("; ")}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section: Rewrite Tools ────────────────────────────────────────────────────
function RewritePanel({ content, onApply }) {
  const [selectedText, setSelectedText] = useState("");
  const [rewriting, setRewriting] = useState(null);
  const [result, setResult] = useState("");

  const rewrite = async (style) => {
    const target = selectedText.trim() || content.slice(0, 500);
    if (!target) return;
    setRewriting(style.id);
    setResult("");
    try {
      const system = `You are a technical writing expert. Rewrite the given text in a ${style.label} style. Keep the meaning intact. Output only the rewritten text, no preamble.`;
      await callClaude([{ role: "user", content: `Rewrite this in ${style.label} style:\n\n${target}` }], system, setResult);
    } catch (e) {
      setResult("Error: " + e.message);
    }
    setRewriting(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
        Select text in the editor to rewrite a specific section, or rewrite from the beginning of the article.
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 8 }}>TARGET TEXT (optional)</label>
        <textarea value={selectedText} onChange={e => setSelectedText(e.target.value)} placeholder="Paste or type specific text to rewrite…" rows={3} style={{ fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {REWRITE_STYLES.map(style => (
          <button key={style.id} onClick={() => rewrite(style)} disabled={!!rewriting} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, cursor: rewriting ? "wait" : "pointer", fontSize: 13, color: "var(--color-text-primary)", transition: "all 0.15s" }}>
            {rewriting === style.id ? <Spinner /> : <i className={`ti ${style.icon}`} style={{ fontSize: 15 }} />}
            {style.label}
          </button>
        ))}
      </div>

      {result && (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>REWRITE RESULT</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => onApply(result)} style={{ fontSize: 12, padding: "6px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Apply to Editor</button>
            <button onClick={() => setResult("")} style={{ fontSize: 12, padding: "6px 14px", background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, cursor: "pointer", color: "var(--color-text-secondary)" }}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Export ──────────────────────────────────────────────────────────
function ExportPanel({ content, title }) {
  const doExport = (fmt) => {
    if (fmt === "md") exportMarkdown(content, title);
    else if (fmt === "html") exportHTML(content, title);
    else if (fmt === "txt") {
      const blob = new Blob([content.replace(/[#*`>_]/g, "")], { type: "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title}.txt`; a.click();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Export your article in the format of your choice.</div>
      {[
        { fmt: "md", icon: "ti-markdown", label: "Markdown (.md)", desc: "For DEV, GitHub, Hugo, Jekyll" },
        { fmt: "html", icon: "ti-brand-html5", label: "HTML (.html)", desc: "For web, self-hosted blogs" },
        { fmt: "txt", icon: "ti-file-text", label: "Plain Text (.txt)", desc: "Universal, no formatting" },
      ].map(({ fmt, icon, label, desc }) => (
        <button key={fmt} onClick={() => doExport(fmt)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 22, color: "#6366f1" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{desc}</div>
          </div>
          <i className="ti ti-download" style={{ marginLeft: "auto", fontSize: 15, color: "var(--color-text-tertiary)" }} />
        </button>
      ))}
    </div>
  );
}

// ─── Version History Panel ─────────────────────────────────────────────────────
function VersionPanel({ versions, currentIdx, onRestore }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{versions.length} version(s) saved in this session.</div>
      {[...versions].reverse().map((v, i) => {
        const realIdx = versions.length - 1 - i;
        const isCurrent = realIdx === currentIdx;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: isCurrent ? "var(--color-background-info)" : "var(--color-background-secondary)", border: `0.5px solid ${isCurrent ? "var(--color-border-info)" : "var(--color-border-tertiary)"}`, borderRadius: 8 }}>
            <i className="ti ti-history" style={{ fontSize: 15, color: isCurrent ? "var(--color-text-info)" : "var(--color-text-secondary)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{isCurrent ? "Current" : `Version ${realIdx + 1}`}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{new Date(v.ts).toLocaleTimeString()} · {v.content.split(/\s+/).length} words</div>
            </div>
            {!isCurrent && (
              <button onClick={() => onRestore(realIdx)} style={{ fontSize: 11, padding: "4px 10px", background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 5, cursor: "pointer", color: "var(--color-text-secondary)" }}>Restore</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TechWriterAI() {
  const [tab, setTab] = useState("generate");
  const [sideTab, setSideTab] = useState("rewrite");
  const [generating, setGenerating] = useState(false);
  const [articleTitle, setArticleTitle] = useState("Untitled Article");
  const [activePlatform, setActivePlatform] = useState("medium");
  const vh = useVersionHistory(localStorage.getItem("tw_autosave") || "");
  const [lastSaved, setLastSaved] = useState(null);

  const wordStats = useMemo(() => countWords(vh.content), [vh.content]);
  const grammar = useMemo(() => grammarCheck(vh.content), [vh.content]);

  const handleGenerate = async ({ topic, platform, stack, audience, keywords }) => {
    setActivePlatform(platform);
    setGenerating(true);
    const platformLabel = PLATFORMS.find(p => p.id === platform)?.label || platform;
    const system = `You are an expert technical writer. Generate a complete, high-quality technical article formatted in Markdown. Follow these guidelines:
- Platform: ${platformLabel}
- Audience: ${audience}
- Include: SEO title, introduction, prerequisites, step-by-step tutorial, code examples (with \`\`\`language fences), best practices, common mistakes, conclusion, references
- Be concise, accurate, practical
- Use ${platformLabel}-appropriate tone and structure`;
    const prompt = `Write a complete technical article about: ${topic}
Tech stack: ${stack || "general"}
Target audience: ${audience}
SEO keywords to include: ${keywords || "none specified"}
Platform: ${platformLabel}

Start with the full Markdown article.`;
    try {
      let out = "";
      await callClaude([{ role: "user", content: prompt }], system, (text) => {
        out = text;
        vh.push(text);
      });
      const titleMatch = out.match(/^#\s+(.+)$/m);
      if (titleMatch) setArticleTitle(titleMatch[1]);
      setLastSaved(new Date());
      setTab("editor");
    } catch (e) {
      vh.push(`# Error\n\nFailed to generate: ${e.message}`);
    }
    setGenerating(false);
  };

  const handleEditorChange = useCallback((val) => {
    vh.push(val);
  }, [vh]);

  const handleRewriteApply = (text) => {
    vh.push(vh.content + "\n\n---\n\n*Rewritten section:*\n\n" + text);
    setSideTab("rewrite");
  };

  const TABS = [
    { id: "generate", icon: "ti-sparkles", label: "Generate" },
    { id: "editor", icon: "ti-edit", label: "Editor" },
    { id: "images", icon: "ti-photo", label: "Images" },
  ];

  const SIDE_TABS = [
    { id: "rewrite", icon: "ti-wand", label: "AI Rewrite" },
    { id: "export", icon: "ti-download", label: "Export" },
    { id: "history", icon: "ti-history", label: "History" },
  ];

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", minHeight: "100vh", background: "var(--color-background-tertiary)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input, select, textarea { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: 8px; padding: 8px 10px; color: var(--color-text-primary); font-family: inherit; outline: none; width: 100%; transition: border 0.15s; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #6366f120; }
        .md-preview { font-family: Georgia, serif; line-height: 1.8; font-size: 14px; color: var(--color-text-primary); }
        .md-preview h1 { font-size: 22px; font-weight: 600; margin: 24px 0 12px; }
        .md-preview h2 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; }
        .md-preview h3 { font-size: 15px; font-weight: 600; margin: 16px 0 8px; }
        .md-preview code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; }
        .md-preview pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
        .md-preview pre code { background: none; color: inherit; }
        .md-preview blockquote { border-left: 3px solid #6366f1; padding-left: 16px; color: var(--color-text-secondary); margin: 12px 0; }
        .md-preview li { margin: 4px 0; }
        .md-preview a { color: #6366f1; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--color-border-tertiary); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 20px", display: "flex", alignItems: "center", height: 52, gap: 16, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-feather" style={{ fontSize: 16, color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>TechWriter <span style={{ color: "#6366f1" }}>AI</span></span>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--color-border-tertiary)" }} />

        {/* Main tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: tab === t.id ? "var(--color-background-secondary)" : "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)", transition: "all 0.15s" }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} />{t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {lastSaved && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Autosaved {lastSaved.toLocaleTimeString()}</span>}

        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
          <i className="ti ti-article" style={{ fontSize: 14 }} />
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{articleTitle}</span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>

        {/* Left panel */}
        <div style={{ width: tab === "editor" ? 380 : "100%", maxWidth: tab === "editor" ? 380 : "none", background: "var(--color-background-primary)", borderRight: tab === "editor" ? "0.5px solid var(--color-border-tertiary)" : "none", overflow: "auto", padding: 20, flexShrink: 0 }}>
          {tab === "generate" && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Generate Article</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Fill in the details and let AI write a complete technical article for your platform.</p>
              </div>
              <GeneratePanel onGenerate={handleGenerate} generating={generating} />
            </>
          )}

          {tab === "editor" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 0, marginBottom: 0 }}>
              {/* Side tabs */}
              <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 9, overflow: "hidden" }}>
                {SIDE_TABS.map(t => (
                  <button key={t.id} onClick={() => setSideTab(t.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 0", background: sideTab === t.id ? "var(--color-background-secondary)" : "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: sideTab === t.id ? 500 : 400, color: sideTab === t.id ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                    <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />{t.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {sideTab === "rewrite" && <RewritePanel content={vh.content} onApply={handleRewriteApply} />}
                {sideTab === "export" && <ExportPanel content={vh.content} title={articleTitle} />}
                {sideTab === "history" && <VersionPanel versions={vh.versions} currentIdx={vh.idx} onRestore={(i) => { /* set idx */}} />}
              </div>
            </div>
          )}

          {tab === "images" && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Image Analyzer</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Upload images to check compatibility and get recommendations for your target platform.</p>
              </div>
              <ImageAnalyzer activePlatform={activePlatform} />
            </>
          )}
        </div>

        {/* Editor panel */}
        {tab === "editor" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--color-background-primary)" }}>
            <EditorPanel
              content={vh.content}
              onChange={handleEditorChange}
              onUndo={vh.undo}
              onRedo={vh.redo}
              canUndo={vh.canUndo}
              canRedo={vh.canRedo}
              grammarIssues={grammar.issues}
              grammarScore={grammar.score}
              wordStats={wordStats}
            />
          </div>
        )}
      </div>
    </div>
  );
}
