"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import BlotterTab from "./BlotterTab";
import AnalyticsTab from "./AnalyticsTab";
import JournalTab from "./JournalTab";
import BlobUploadControl from "./BlobUploadControl";
import MarkdownArticle from "./MarkdownArticle";
import RichArticleEditor from "./RichArticleEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

type EquityPosition = {
  id: number; status: string; term: string; ticker: string;
  units: number; ls: string; fill: number; size: number; thesis: string;
};
type OptionsPosition = {
  id: number; status: string; term: string; ticker: string; units: number;
  ls: string; pc: string; eqPrice: number; strike: number; expiration: string;
  fill: number; basis: number; sizing: number; contract: string; thesis: string;
};
type ResearchEntry = { id: number; [key: string]: unknown };
type DBData = {
  equityPositions: EquityPosition[];
  optionsPositions: OptionsPosition[];
  tradeIdeas: ResearchEntry[];
  thesis: ResearchEntry[];
  macro: ResearchEntry[];
  marketUpdates: ResearchEntry[];
  sellSideResearch: ResearchEntry[];
  blotter: ResearchEntry[];
  settings: { equityBaseline: number; optionsBaseline: number };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-$" : "$") + s;
}
function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}
function glColor(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "#2a2f3c";
  return n >= 0 ? "#16a34a" : "#dc2626";
}
function sizeColor(x: number): string {
  if (x > 1.4) return "#dc2626";   // oversized
  if (x > 1.15) return "#ea580c";  // slightly over
  if (x >= 0.85) return "#16a34a"; // on target
  if (x >= 0.5) return "#3a3f4c";     // undersized
  return "#5a6070";
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(32,26,19,0.42)", backdropFilter: "blur(10px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "rgba(255,250,242,0.96)", border: "1px solid #d8cab5", borderRadius: 24, width: "100%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", padding: 30, boxShadow: "0 24px 80px rgba(58,41,17,0.16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "#9f6b1b", letterSpacing: 2, textTransform: "uppercase" as const }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = { width: "100%", background: "rgba(255,250,244,0.98)", border: "1px solid #cdbca4", borderRadius: 12, padding: "10px 12px", color: "#1f2a2a", fontSize: 13, outline: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)" };
const taStyle: React.CSSProperties = { ...iStyle, height: 90, resize: "vertical" as const };
const selStyle: React.CSSProperties = { ...iStyle };
const softPanel: React.CSSProperties = { background: "rgba(255,250,244,0.78)", border: "1px solid #ddd1bf", borderRadius: 16, boxShadow: "0 14px 34px rgba(73,54,29,0.05)" };
const tableShell: React.CSSProperties = { overflowX: "auto", background: "rgba(255,250,244,0.78)", borderRadius: 18, border: "1px solid #ddd1bf", boxShadow: "0 14px 34px rgba(73,54,29,0.05)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, color: "#6a7169", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, label = "SAVE" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{ background: "linear-gradient(135deg, #ba7a1c 0%, #8d5d17 100%)", color: "#fff9f0", border: "none", borderRadius: 12, padding: "11px 0", width: "100%", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8, boxShadow: "0 10px 24px rgba(159,107,27,0.18)" }}>
      {label}
    </button>
  );
}

function parseStoredUrls(value: string) {
  return value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

function filenameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

function StoredFileList({
  value,
  accent = "#32536f",
  onRemove,
}: {
  value: string;
  accent?: string;
  onRemove?: (url: string) => void;
}) {
  const files = parseStoredUrls(value);
  if (files.length === 0) return <div style={{ fontSize: 11, color: "#7f776d" }}>No files stored yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {files.map(url => (
        <div key={url} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #d8cab5", background: "rgba(255,250,244,0.82)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: "none", fontSize: 12, fontWeight: 700, wordBreak: "break-word" }}>
              {filenameFromUrl(url)}
            </a>
          </div>
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#9a6d18", textDecoration: "none", fontSize: 10, letterSpacing: 1 }}>
            OPEN
          </a>
          {onRemove && (
            <button onClick={() => onRemove(url)} type="button" style={{ background: "none", border: "none", color: "#7f776d", cursor: "pointer", fontSize: 10, letterSpacing: 1 }}>
              REMOVE
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function appendMarkdownImages(current: string, urls: string[]) {
  const imageBlock = urls.map(url => `![](${url})`).join("\n\n");
  if (!imageBlock) return current;
  return current.trim() ? `${current.trim()}\n\n${imageBlock}` : imageBlock;
}

function looksLikeHtml(value: string) {
  return /<\s*(p|div|h1|h2|h3|blockquote|ul|ol|li|figure|img|a|strong|em)\b/i.test(value);
}

function ArticleContent({ content }: { content: string }) {
  if (looksLikeHtml(content)) {
    return (
      <div
        style={{ color: "#2a2f3c", fontFamily: "'Lora', serif", fontSize: 14, lineHeight: 1.9 }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <MarkdownArticle content={content} />;
}

function MarkdownEditor({
  label,
  value,
  onChange,
  folder,
  placeholder,
  height = 220,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  folder: string;
  placeholder?: string;
  height?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        style={{ ...taStyle, height, lineHeight: 1.75, fontFamily: "'Lora', serif", fontSize: 14 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <BlobUploadControl
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        buttonLabel="UPLOAD IMAGE"
        folder={folder}
        multiple
        onChange={() => {}}
        onUploaded={urls => onChange(appendMarkdownImages(value, urls))}
        value=""
      />
      <div style={{ fontSize: 10, color: "#5a6070", marginTop: 8, letterSpacing: 0.4 }}>
        Supports headings with `#`, bullets with `-`, quotes with `&gt;`, links, and inline images.
      </div>
      {value.trim() && (
        <div style={{ marginTop: 14, background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 10 }}>PREVIEW</div>
          <MarkdownArticle content={value} />
        </div>
      )}
    </Field>
  );
}

function ComposerShell({
  children,
  onBack,
  onSave,
  saveLabel,
  title,
}: {
  children: React.ReactNode;
  onBack: () => void;
  onSave: () => void;
  saveLabel: string;
  title: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "linear-gradient(180deg, #fbf7f0 0%, #f3ebdf 100%)", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid #ddd6c7", background: "rgba(251,247,240,0.94)", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "1px solid #c9c0b0", borderRadius: 999, color: "#3a3f4c", cursor: "pointer", fontSize: 13, padding: "6px 12px" }}>← Back</button>
          <span style={{ fontSize: 11, color: "#9f6b1b", letterSpacing: 2 }}>{title}</span>
        </div>
        <button onClick={onSave} style={{ background: "linear-gradient(135deg, #ff9c31 0%, #d9780d 100%)", color: "#fff", border: "none", borderRadius: 999, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, boxShadow: "0 10px 24px rgba(217,120,13,0.22)" }}>{saveLabel}</button>
      </div>
      <div style={{ width: "100%", margin: 0, padding: "24px 18px 40px", display: "grid", gridTemplateColumns: "220px minmax(0, 980px)", gap: 28, alignItems: "start", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Positions Tab ───────────────────────────────────────────────────────────

function PositionsTab({ data, onChange }: { data: DBData; onChange: (d: DBData) => void }) {
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [addEq, setAddEq] = useState(false);
  const [addOpt, setAddOpt] = useState(false);
  const blankEq = { ticker: "", units: "", fill: "", term: "ST", ls: "L", thesis: "" };
  const blankOpt = { ticker: "", units: "1", ls: "L", pc: "C", strike: "", expiration: "", fill: "", thesis: "" };
  const [eqF, setEqF] = useState<Record<string, string>>(blankEq);
  const [optF, setOptF] = useState<Record<string, string>>(blankOpt);
  const settings = data.settings ?? { equityBaseline: 900, optionsBaseline: 600 };
  const eqBase = settings.equityBaseline;
  const optBase = settings.optionsBaseline;
  function updateBaseline(key: "equityBaseline" | "optionsBaseline", val: number) {
    if (isNaN(val) || val <= 0) return;
    onChange({ ...data, settings: { ...settings, [key]: val } });
  }

  async function refreshPrices() {
    setLoading(true);
    const tickerSet = new Set([...data.equityPositions.map(p => p.ticker), ...data.optionsPositions.map(p => p.ticker)]);
    const tickers = Array.from(tickerSet);
    const r = await fetch(`/api/prices?tickers=${tickers.join(",")}`);
    const result = await r.json();
    setPrices(result);
    setLoading(false);
  }

  function saveEq() {
    const pos: EquityPosition = {
      id: Date.now(), status: "Open", term: eqF.term, ticker: eqF.ticker.toUpperCase(),
      units: +eqF.units, ls: eqF.ls, fill: +eqF.fill,
      size: (+eqF.units * +eqF.fill) / eqBase, thesis: eqF.thesis,
    };
    onChange({ ...data, equityPositions: [...data.equityPositions, pos] });
    setAddEq(false); setEqF(blankEq);
  }

  function saveOpt() {
    const basis = +optF.fill * 100 * +optF.units;
    const pos: OptionsPosition = {
      id: Date.now(), status: "Open", term: "ST", ticker: optF.ticker.toUpperCase(),
      units: +optF.units, ls: optF.ls, pc: optF.pc,
      eqPrice: prices[optF.ticker.toUpperCase()] ?? 0,
      strike: +optF.strike, expiration: optF.expiration,
      fill: +optF.fill, basis, sizing: basis / optBase, contract: "", thesis: optF.thesis,
    };
    onChange({ ...data, optionsPositions: [...data.optionsPositions, pos] });
    setAddOpt(false); setOptF(blankOpt);
  }

  const eqRows = data.equityPositions.map(p => {
    const last = prices[p.ticker];
    const mv = last != null ? last * p.units : null;
    const cost = p.fill * p.units;
    const gl = mv != null ? mv - cost : null;
    const glPct = gl != null ? gl / cost : null;
    return { ...p, last, mv, gl, glPct };
  });

  const optRows = data.optionsPositions.map(p => {
    const eqLast = prices[p.ticker];
    const eqMove = eqLast != null ? eqLast - p.eqPrice : null;
    const gl = eqMove != null ? (p.pc === "C" ? eqMove : -eqMove) * p.units * 100 : null;
    const glPct = gl != null ? gl / p.basis : null;
    return { ...p, eqLast, gl, glPct };
  });

  const totalEqGL = eqRows.reduce((s, r) => s + (r.gl ?? 0), 0);
  const totalOptGL = optRows.reduce((s, r) => s + (r.gl ?? 0), 0);
  const grandTotal = totalEqGL + totalOptGL;

  const th: React.CSSProperties = { padding: "12px 14px", color: "#7b7466", fontWeight: 500, textAlign: "left", fontSize: 10, letterSpacing: 1.3, whiteSpace: "nowrap", textTransform: "uppercase" as const };
  const td: React.CSSProperties = { padding: "14px 14px", fontSize: 12, whiteSpace: "nowrap" };

  return (
    <div>
      {/* Baseline configurator */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5 }}>BASELINE</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#3a3f4c" }}>EQ</span>
          <span style={{ fontSize: 11, color: "#2a2f3c" }}>$</span>
          <input
            type="number" defaultValue={eqBase}
            onBlur={e => updateBaseline("equityBaseline", parseFloat(e.target.value))}
            style={{ width: 84, background: "#fffaf2", border: "1px solid #d8cab5", borderRadius: 10, padding: "6px 9px", color: "#20302f", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#3a3f4c" }}>OPT</span>
          <span style={{ fontSize: 11, color: "#2a2f3c" }}>$</span>
          <input
            type="number" defaultValue={optBase}
            onBlur={e => updateBaseline("optionsBaseline", parseFloat(e.target.value))}
            style={{ width: 84, background: "#fffaf2", border: "1px solid #d8cab5", borderRadius: 10, padding: "6px 9px", color: "#20302f", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" }}
          />
        </div>
        <span style={{ fontSize: 10, color: "#b0b3bc" }}>updates on blur · persisted</span>
      </div>

      {/* Summary bar */}
      <div style={{ ...softPanel, display: "flex", gap: 32, marginBottom: 24, padding: "18px 22px", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 3 }}>TOTAL OPEN G/L</div>
          <div style={{ fontSize: 20, color: glColor(grandTotal), fontWeight: 600 }}>{fmt$(grandTotal)}</div>
        </div>
        <div style={{ width: 1, height: 36, background: "#ddd1bf" }} />
        <div>
          <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 3 }}>EQUITY</div>
          <div style={{ fontSize: 14, color: glColor(totalEqGL) }}>{fmt$(totalEqGL)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 3 }}>OPTIONS</div>
          <div style={{ fontSize: 14, color: glColor(totalOptGL) }}>{fmt$(totalOptGL)}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={refreshPrices} disabled={loading} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1, opacity: loading ? 0.6 : 1 }}>
            {loading ? "LOADING..." : "↻ REFRESH PRICES"}
          </button>
        </div>
      </div>

      {/* EQUITY TABLE */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: "#a07828", letterSpacing: 2 }}>EQUITY POSITIONS</span>
          <button onClick={() => setAddEq(true)} style={{ background: "#eef6ef", border: "1px solid #cfe1d2", color: "#2f6a49", borderRadius: 999, padding: "7px 14px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>+ ADD</button>
        </div>
        <div style={tableShell}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e6dccd", background: "rgba(255,251,245,0.88)" }}>
                {["STATUS","TERM","TICKER","UNITS","L/S","FILL","LAST","MV","COST","G/L $","G/L %","SIZE","THESIS"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {eqRows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #eee5d8" }}>
                  <td style={{ ...td, color: "#16a34a" }}>{r.status}</td>
                  <td style={{ ...td, color: "#3a3f4c" }}>{r.term}</td>
                  <td style={{ ...td, color: "#0d0f14", fontWeight: 600 }}>{r.ticker}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{r.units}</td>
                  <td style={{ ...td, color: r.ls === "L" ? "#16a34a" : "#dc2626" }}>{r.ls}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>${r.fill.toFixed(2)}</td>
                  <td style={{ ...td, color: "#0d0f14" }}>{r.last != null ? `$${r.last.toFixed(2)}` : "—"}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{fmt$(r.mv)}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{fmt$(r.fill * r.units)}</td>
                  <td style={{ ...td, color: glColor(r.gl), fontWeight: 600 }}>{fmt$(r.gl)}</td>
                  <td style={{ ...td, color: glColor(r.glPct) }}>{fmtPct(r.glPct)}</td>
                  <td style={{ ...td }}>
                    {(() => { const x = (r.fill * r.units) / eqBase; return <span style={{ fontSize: 11, color: sizeColor(x), fontWeight: 600 }}>{x.toFixed(2)}x</span>; })()}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: "#a07828", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.thesis ? <a href={r.thesis} target="_blank" rel="noreferrer" style={{ color: "#a07828", textDecoration: "none" }}>↗ link</a> : "—"}
                  </td>
                  <td style={{ ...td, display: "none" }}>
                    <button onClick={() => onChange({ ...data, equityPositions: data.equityPositions.filter(p => p.id !== r.id) })} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15, padding: 0 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPTIONS TABLE */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: "#a07828", letterSpacing: 2 }}>OPTIONS POSITIONS</span>
          <button onClick={() => setAddOpt(true)} style={{ background: "#eef6ef", border: "1px solid #cfe1d2", color: "#2f6a49", borderRadius: 999, padding: "7px 14px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>+ ADD</button>
        </div>
        <div style={tableShell}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e6dccd", background: "rgba(255,251,245,0.88)" }}>
                {["TICKER","P/C","STRIKE","EXP","UNITS","FILL","BASIS","EQ ENTRY","EQ LAST","G/L $","G/L %","SIZE","THESIS"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {optRows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #eee5d8" }}>
                  <td style={{ ...td, color: "#0d0f14", fontWeight: 600 }}>{r.ticker}</td>
                  <td style={{ ...td, color: r.pc === "C" ? "#16a34a" : "#dc2626" }}>{r.pc}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>${r.strike}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{r.expiration}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{r.units}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>${r.fill.toFixed(2)}</td>
                  <td style={{ ...td, color: "#2a2f3c" }}>{fmt$(r.basis)}</td>
                  <td style={{ ...td, color: "#3a3f4c" }}>${r.eqPrice.toFixed(2)}</td>
                  <td style={{ ...td, color: "#0d0f14" }}>{r.eqLast != null ? `$${r.eqLast.toFixed(2)}` : "—"}</td>
                  <td style={{ ...td, color: glColor(r.gl), fontWeight: 600 }}>{fmt$(r.gl)}</td>
                  <td style={{ ...td, color: glColor(r.glPct) }}>{fmtPct(r.glPct)}</td>
                  <td style={{ ...td }}>
                    {(() => { const x = r.basis / optBase; return <span style={{ fontSize: 11, color: sizeColor(x), fontWeight: 600 }}>{x.toFixed(2)}x</span>; })()}
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {r.thesis ? <a href={r.thesis} target="_blank" rel="noreferrer" style={{ color: "#a07828", textDecoration: "none" }}>↗ link</a> : "—"}
                  </td>
                  <td style={{ ...td, display: "none" }}>
                    <button onClick={() => onChange({ ...data, optionsPositions: data.optionsPositions.filter(p => p.id !== r.id) })} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15, padding: 0 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 10, color: "#5a6070", marginTop: 6, letterSpacing: 0.5 }}>
          G/L = (eq last − eq entry) × contracts × 100. Reversed for puts.
        </p>
      </div>

      {addEq && (
        <Modal title="Add Equity Position" onClose={() => setAddEq(false)}>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Ticker"><input style={iStyle} value={eqF.ticker} onChange={e => setEqF(p => ({ ...p, ticker: e.target.value }))} /></Field>
            <Field label="Units"><input style={iStyle} type="number" value={eqF.units} onChange={e => setEqF(p => ({ ...p, units: e.target.value }))} /></Field>
            <Field label="Fill Price"><input style={iStyle} type="number" value={eqF.fill} onChange={e => setEqF(p => ({ ...p, fill: e.target.value }))} /></Field>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Term"><select style={selStyle} value={eqF.term} onChange={e => setEqF(p => ({ ...p, term: e.target.value }))}><option>ST</option><option>MT</option><option>LT</option></select></Field>
            <Field label="L/S"><select style={selStyle} value={eqF.ls} onChange={e => setEqF(p => ({ ...p, ls: e.target.value }))}><option>L</option><option>S</option></select></Field>
          </div>
          <Field label="Thesis Attachment">
            <input style={iStyle} value={eqF.thesis} onChange={e => setEqF(p => ({ ...p, thesis: e.target.value }))} placeholder="Upload file below or paste stored file URL" />
            <BlobUploadControl folder="positions/equity-thesis" onChange={value => setEqF(p => ({ ...p, thesis: value }))} value={eqF.thesis} />
          </Field>
          <SaveBtn onClick={saveEq} label="ADD POSITION" />
        </Modal>
      )}

      {addOpt && (
        <Modal title="Add Options Position" onClose={() => setAddOpt(false)}>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Ticker"><input style={iStyle} value={optF.ticker} onChange={e => setOptF(p => ({ ...p, ticker: e.target.value }))} /></Field>
            <Field label="P/C"><select style={selStyle} value={optF.pc} onChange={e => setOptF(p => ({ ...p, pc: e.target.value }))}><option>C</option><option>P</option></select></Field>
            <Field label="L/S"><select style={selStyle} value={optF.ls} onChange={e => setOptF(p => ({ ...p, ls: e.target.value }))}><option>L</option><option>S</option></select></Field>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Strike"><input style={iStyle} type="number" value={optF.strike} onChange={e => setOptF(p => ({ ...p, strike: e.target.value }))} /></Field>
            <Field label="Expiration"><input style={iStyle} type="date" value={optF.expiration} onChange={e => setOptF(p => ({ ...p, expiration: e.target.value }))} /></Field>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Fill (per share)"><input style={iStyle} type="number" value={optF.fill} onChange={e => setOptF(p => ({ ...p, fill: e.target.value }))} /></Field>
            <Field label="Contracts"><input style={iStyle} type="number" value={optF.units} onChange={e => setOptF(p => ({ ...p, units: e.target.value }))} /></Field>
          </div>
          <Field label="Thesis Attachment">
            <input style={iStyle} value={optF.thesis} onChange={e => setOptF(p => ({ ...p, thesis: e.target.value }))} placeholder="Upload file below or paste stored file URL" />
            <BlobUploadControl folder="positions/options-thesis" onChange={value => setOptF(p => ({ ...p, thesis: value }))} value={optF.thesis} />
          </Field>
          <SaveBtn onClick={saveOpt} label="ADD POSITION" />
        </Modal>
      )}
    </div>
  );
}

// ─── Research Tab (Macro / Market Updates / Trade Ideas / Thesis) ─────────────

type ResearchType = "tradeIdeas" | "thesis" | "macro" | "marketUpdates" | "sellSideResearch";

const RESEARCH_TYPE_LABEL: Record<ResearchType, string> = {
  tradeIdeas: "Trade Idea",
  thesis: "Investment Idea",
  macro: "Macro",
  marketUpdates: "Market Update",
  sellSideResearch: "Sell-Side",
};

function displayEntryDate(entry: ResearchEntry) {
  const record = entry as Record<string, string>;
  return String(record.date || new Date(entry.id).toISOString().slice(0, 10));
}

function displayEntryStatus(entry: ResearchEntry) {
  const record = entry as Record<string, string>;
  return String(record.status || "Draft");
}

function normalizedSearchText(parts: unknown[]) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function ResearchTab({ items, onSave, type, contextData }: { items: ResearchEntry[]; onSave: (items: ResearchEntry[]) => void; type: ResearchType; contextData: DBData }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Draft" | "Published">("All");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const useComposer = type !== "sellSideResearch";

  const blank: Record<string, string> = type === "thesis"
    ? { ticker: "", title: "", subtitle: "", date: new Date().toISOString().slice(0, 10), conviction: "High", summary: "", tags: "", materials: "", models: "", status: "Draft" }
    : type === "tradeIdeas"
    ? { ticker: "", title: "", subtitle: "", date: new Date().toISOString().slice(0, 10), direction: "Long", term: "ST", thesis: "", entry: "", target: "", stop: "", links: "", tags: "", status: "Draft" }
    : type === "sellSideResearch"
    ? { ticker: "", firm: "", analyst: "", title: "", date: new Date().toISOString().slice(0, 10), rating: "", notes: "", links: "" }
    : { title: "", subtitle: "", date: new Date().toISOString().slice(0, 10), tags: "", body: "", links: "", status: "Draft" };

  const [form, setForm] = useState<Record<string, string>>(blank);

  const draftStorageKey = useMemo(
    () => `hp:draft:${type}:${editing ?? "new"}`,
    [type, editing]
  );

  useEffect(() => {
    if (!open || !useComposer) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(form));
      setDraftSavedAt(new Date());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey, form, open, useComposer]);

  function save() {
    const nextForm = {
      ...form,
      date: form.date || new Date().toISOString().slice(0, 10),
      status: form.status || "Draft",
      updatedAt: new Date().toISOString(),
    };
    if (editing !== null) {
      onSave(items.map(x => x.id === editing ? { ...nextForm, id: x.id } : x));
      setEditing(null);
    } else {
      onSave([{ ...nextForm, id: Date.now() }, ...items]);
    }
    window.localStorage.removeItem(draftStorageKey);
    setForm(blank);
    setDraftSavedAt(null);
    setOpen(false);
  }

  function edit(id: number) {
    const item = items.find(x => x.id === id);
    if (!item) return;
    const storedDraft = useComposer ? window.localStorage.getItem(`hp:draft:${type}:${id}`) : null;
    const parsedDraft = storedDraft ? JSON.parse(storedDraft) as Record<string, string> : null;
    setForm({ ...blank, ...(item as Record<string, string>), ...parsedDraft, date: String((item as Record<string, string>).date || new Date(item.id).toISOString().slice(0, 10)) });
    setEditing(id);
    setViewing(null);
    setDraftSavedAt(null);
    setOpen(true);
  }
  function createNewEntry() {
    const storedDraft = useComposer ? window.localStorage.getItem(`hp:draft:${type}:new`) : null;
    const parsedDraft = storedDraft ? JSON.parse(storedDraft) as Record<string, string> : null;
    setForm(parsedDraft ? { ...blank, ...parsedDraft } : blank);
    setEditing(null);
    setViewing(null);
    setDraftSavedAt(null);
    setOpen(true);
  }
  function duplicate(id: number) {
    const item = items.find(x => x.id === id);
    if (!item) return;
    const copy = { ...(item as Record<string, string>), id: Date.now(), title: `${String((item as Record<string, string>).title || "Untitled")} Copy`, status: "Draft", updatedAt: new Date().toISOString() };
    onSave([copy, ...items]);
  }
  function remove(id: number) {
    if (viewing === id) setViewing(null);
    onSave(items.filter(x => x.id !== id));
  }
  function view(id: number) { setViewing(id); }

  const convColor: Record<string, string> = { High: "#16a34a", Medium: "#a07828", Low: "#dc2626" };
  const sortedItems = [...items].sort((a, b) => String((b as Record<string, string>).updatedAt || (b as Record<string, string>).date || "").localeCompare(String((a as Record<string, string>).updatedAt || (a as Record<string, string>).date || "")));
  const filteredItems = sortedItems.filter(item => {
    if (statusFilter !== "All" && displayEntryStatus(item) !== statusFilter) return false;
    if (!query.trim()) return true;
    const e = item as Record<string, string>;
    const haystack = normalizedSearchText([e.ticker, e.title, e.subtitle, e.summary, e.thesis, e.body, e.tags, e.links, e.materials, e.models, e.entry, e.target, e.stop, e.firm, e.analyst, e.rating]);
    return haystack.includes(query.trim().toLowerCase());
  });
  const viewingItem = viewing !== null ? items.find(x => x.id === viewing) : null;
  const viewingTicker = String((viewingItem as Record<string, unknown> | null)?.ticker || "").trim().toUpperCase();
  const relatedTrades = viewingTicker
    ? (contextData.blotter ?? []).filter(trade => String(trade.ticker || "").toUpperCase() === viewingTicker)
    : [];
  const relatedResearch = viewingTicker
    ? [
        ...contextData.tradeIdeas.map(entry => ({ source: "tradeIdeas", section: "Trade Ideas", entry })),
        ...contextData.thesis.map(entry => ({ source: "thesis", section: "Investment Ideas", entry })),
        ...contextData.macro.map(entry => ({ source: "macro", section: "Macro", entry })),
        ...contextData.marketUpdates.map(entry => ({ source: "marketUpdates", section: "Market Updates", entry })),
      ].filter(({ source, entry }) => source !== type && String((entry as Record<string, unknown>).ticker || "").toUpperCase() === viewingTicker)
    : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
        {useComposer ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
            <input style={{ ...iStyle, maxWidth: 360 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search entries..." />
            <div style={{ display: "flex", gap: 6 }}>
              {(["All", "Draft", "Published"] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  style={{
                    background: statusFilter === option ? "rgba(51,92,87,0.12)" : "transparent",
                    border: "1px solid #d7c8b3",
                    color: statusFilter === option ? "#274844" : "#74684f",
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : <div />}
        <button onClick={createNewEntry}
          style={{ background: "#dcf0dc", border: "1px solid #2a4a2a", color: "#16a34a", borderRadius: 5, padding: "6px 18px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>
          + NEW ENTRY
        </button>
      </div>

      {filteredItems.length === 0 && (
        <div style={{ textAlign: "center", padding: 80, color: "#b0b3bc", fontSize: 12, letterSpacing: 2 }}>NO ENTRIES</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredItems.map(item => {
          const e = item as Record<string, string>;
          const displayDate = String(e.date || new Date(item.id).toISOString().slice(0, 10));
          return (
            <div key={item.id} style={{ background: "rgba(255,250,244,0.82)", border: "1px solid #ddd1bf", borderRadius: 18, padding: "18px 22px", boxShadow: "0 12px 28px rgba(73,54,29,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div onClick={() => useComposer && view(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, cursor: useComposer ? "pointer" : "default" }}>
                  {(type === "thesis" || type === "tradeIdeas" || type === "sellSideResearch") && e.ticker && (
                    <span style={{ fontSize: 15, color: "#0d0f14", fontWeight: 600 }}>{e.ticker}</span>
                  )}
                  {e.title && <span style={{ fontSize: 13, color: "#2a2f3c" }}>{e.title}</span>}
                  {useComposer && displayEntryStatus(item) && (
                    <span style={{ fontSize: 10, color: displayEntryStatus(item) === "Published" ? "#1f7a37" : "#8d6721", border: `1px solid ${displayEntryStatus(item) === "Published" ? "#9ed8ae" : "#d8cab5"}`, borderRadius: 999, padding: "2px 8px" }}>
                      {displayEntryStatus(item)}
                    </span>
                  )}
                  {type === "thesis" && e.conviction && (
                    <span style={{ fontSize: 10, color: convColor[e.conviction], border: `1px solid ${convColor[e.conviction]}40`, borderRadius: 3, padding: "2px 7px" }}>{e.conviction}</span>
                  )}
                  {type === "tradeIdeas" && e.direction && (
                    <span style={{ fontSize: 10, color: e.direction === "Long" ? "#16a34a" : "#dc2626", border: `1px solid ${e.direction === "Long" ? "#4ade8040" : "#f8717140"}`, borderRadius: 3, padding: "2px 7px" }}>{e.direction} · {e.term}</span>
                  )}
                  {type === "sellSideResearch" && e.firm && (
                    <span style={{ fontSize: 10, color: "#2563eb", border: "1px solid #93c5fd80", borderRadius: 3, padding: "2px 7px" }}>{e.firm}</span>
                  )}
                  {type === "sellSideResearch" && (
                    <span style={{ fontSize: 11, color: "#4a5060" }}>{displayDate}</span>
                  )}
                  {(type === "thesis" || type === "tradeIdeas") && (
                    <span style={{ fontSize: 11, color: "#4a5060" }}>{displayDate}</span>
                  )}
                  {(type === "macro" || type === "marketUpdates") && (
                    <span style={{ fontSize: 11, color: "#4a5060" }}>{displayDate}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  {useComposer && <button onClick={() => view(item.id)} style={{ background: "none", border: "1px solid #c9c0b0", color: "#6b7280", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>VIEW</button>}
                  {useComposer && <button onClick={() => duplicate(item.id)} style={{ background: "none", border: "1px solid #d7c8b3", color: "#7f776d", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>DUPLICATE</button>}
                  <button onClick={() => edit(item.id)} style={{ background: "none", border: "1px solid #2a2d35", color: "#3a3f4c", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>EDIT</button>
                  <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>✕</button>
                </div>
              </div>

              {(type === "thesis" || type === "tradeIdeas" || type === "macro" || type === "marketUpdates") && e.tags && (
                <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                  {e.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                    <button key={t} type="button" onClick={() => setQuery(t)} style={{ fontSize: 10, color: "#a07828", background: "#a0782810", border: "1px solid #c9a84c25", borderRadius: 999, padding: "2px 8px", cursor: "pointer" }}>{t}</button>
                  ))}
                </div>
              )}

              {(e.summary || e.thesis || e.body) && (
                <div style={{ marginBottom: 8 }}>
                  <ArticleContent content={String(e.summary || e.thesis || e.body)} />
                </div>
              )}

              {type === "sellSideResearch" && e.notes && (
                <p style={{ fontSize: 13, color: "#2a2f3c", lineHeight: 1.65, fontFamily: "'Lora', serif", marginBottom: 8 }}>{e.notes}</p>
              )}

              {false && (
                <div style={{ display: "flex", gap: 24, marginTop: 6 }}>
                  {e.catalysts && <div style={{ fontSize: 11, color: "#16a34a" }}>▲ {e.catalysts}</div>}
                  {e.risks && <div style={{ fontSize: 11, color: "#dc2626" }}>▼ {e.risks}</div>}
                </div>
              )}

              {type === "tradeIdeas" && (e.entry || e.target || e.stop) && (
                <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
                  {e.entry && <span style={{ fontSize: 11, color: "#3a3f4c" }}>ENTRY <span style={{ color: "#0d0f14" }}>{e.entry}</span></span>}
                  {e.target && <span style={{ fontSize: 11, color: "#3a3f4c" }}>TARGET <span style={{ color: "#16a34a" }}>{e.target}</span></span>}
                  {e.stop && <span style={{ fontSize: 11, color: "#3a3f4c" }}>STOP <span style={{ color: "#dc2626" }}>{e.stop}</span></span>}
                </div>
              )}

              {type === "sellSideResearch" && (e.analyst || e.rating) && (
                <div style={{ display: "flex", gap: 20, marginTop: 6, flexWrap: "wrap" as const }}>
                  {e.analyst && <span style={{ fontSize: 11, color: "#3a3f4c" }}>ANALYST <span style={{ color: "#0d0f14" }}>{e.analyst}</span></span>}
                  {e.rating && <span style={{ fontSize: 11, color: "#a07828" }}>RATING <span style={{ color: "#0d0f14" }}>{e.rating}</span></span>}
                </div>
              )}

              {e.links && (
                <div style={{ marginTop: 10 }}>
                  <StoredFileList value={String(e.links)} accent="#9a6d18" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {open && useComposer && (
        <ComposerShell
          onBack={() => { setOpen(false); setEditing(null); }}
          onSave={save}
          saveLabel={form.status === "Published" ? (editing !== null ? "SAVE PUBLISHED ENTRY" : "PUBLISH ENTRY") : "SAVE DRAFT"}
          title={editing !== null ? "EDIT ENTRY" : "NEW ENTRY"}
        >
          <div style={{ background: "#efebe2", border: "1px solid #ddd6c7", borderRadius: 14, padding: 18, position: "sticky", top: 86 }}>
            <div style={{ fontSize: 11, color: "#7f776d", marginBottom: 14 }}>
              {draftSavedAt ? `Draft autosaved ${draftSavedAt.toLocaleTimeString()}` : "Autosave enabled for this draft"}
            </div>
            {type === "thesis" && <>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Status"><select style={selStyle} value={form.status || "Draft"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}><option>Draft</option><option>Published</option></select></Field>
              <Field label="Conviction"><select style={selStyle} value={form.conviction || "High"} onChange={e => setForm(p => ({ ...p, conviction: e.target.value }))}><option>High</option><option>Medium</option><option>Low</option></select></Field>
              <Field label="Tags"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="ai, earnings, semis" /></Field>
              <Field label="Financial Models">
                <BlobUploadControl accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,.ppt,.pptx,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/pdf" buttonLabel="UPLOAD MODELS" folder="research/investment-ideas-models" multiple onChange={value => setForm(p => ({ ...p, models: value }))} value={form.models || ""} />
                <StoredFileList value={form.models || ""} onRemove={url => setForm(p => ({ ...p, models: parseStoredUrls(p.models || "").filter(x => x !== url).join("\n") }))} />
              </Field>
              <Field label="Supplementary Materials">
                <BlobUploadControl accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip,.csv,application/pdf,text/plain,text/csv" buttonLabel="UPLOAD MATERIALS" folder="research/investment-ideas-materials" multiple onChange={value => setForm(p => ({ ...p, materials: value }))} value={form.materials || ""} />
                <StoredFileList value={form.materials || ""} accent="#9a6d18" onRemove={url => setForm(p => ({ ...p, materials: parseStoredUrls(p.materials || "").filter(x => x !== url).join("\n") }))} />
              </Field>
            </>}
            {type === "tradeIdeas" && <>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Status"><select style={selStyle} value={form.status || "Draft"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}><option>Draft</option><option>Published</option></select></Field>
              <Field label="Direction"><select style={selStyle} value={form.direction || "Long"} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}><option>Long</option><option>Short</option></select></Field>
              <Field label="Term"><select style={selStyle} value={form.term || "ST"} onChange={e => setForm(p => ({ ...p, term: e.target.value }))}><option>ST</option><option>MT</option><option>LT</option></select></Field>
              <Field label="Tags"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="earnings, technicals, flow" /></Field>
              <Field label="Entry"><input style={iStyle} value={form.entry || ""} onChange={e => setForm(p => ({ ...p, entry: e.target.value }))} /></Field>
              <Field label="Target"><input style={iStyle} value={form.target || ""} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} /></Field>
              <Field label="Stop"><input style={iStyle} value={form.stop || ""} onChange={e => setForm(p => ({ ...p, stop: e.target.value }))} /></Field>
              <Field label="Supporting Files">
                <BlobUploadControl accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip,.csv,application/pdf,text/plain,text/csv" buttonLabel="UPLOAD FILES" folder="research/trade-ideas-files" multiple onChange={value => setForm(p => ({ ...p, links: value }))} value={form.links || ""} />
                <StoredFileList value={form.links || ""} accent="#9a6d18" onRemove={url => setForm(p => ({ ...p, links: parseStoredUrls(p.links || "").filter(x => x !== url).join("\n") }))} />
              </Field>
            </>}
            {(type === "macro" || type === "marketUpdates") && <>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Status"><select style={selStyle} value={form.status || "Draft"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}><option>Draft</option><option>Published</option></select></Field>
              <Field label="Tags"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="rates, china, equities" /></Field>
              <Field label="Supporting Files">
                <BlobUploadControl accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.zip,.csv,application/pdf,text/plain,text/csv" buttonLabel="UPLOAD FILES" folder={`research/${type}-files`} multiple onChange={value => setForm(p => ({ ...p, links: value }))} value={form.links || ""} />
                <StoredFileList value={form.links || ""} accent="#9a6d18" onRemove={url => setForm(p => ({ ...p, links: parseStoredUrls(p.links || "").filter(x => x !== url).join("\n") }))} />
              </Field>
            </>}
          </div>
          <div style={{ width: "100%", margin: 0 }}>
            <input
              style={{ width: "100%", border: "none", background: "transparent", color: "#3a4b68", fontFamily: "'Lora', serif", fontSize: 42, lineHeight: 1.15, outline: "none", marginBottom: 10 }}
              value={form.title || ""}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Title"
            />
            <input
              style={{ width: "100%", border: "none", background: "transparent", color: "#7b8794", fontFamily: "'Lora', serif", fontSize: 24, lineHeight: 1.35, outline: "none", marginBottom: 18 }}
              value={form.subtitle || ""}
              onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
              placeholder="Add a subtitle..."
            />
            <div style={{ color: "#7b8794", fontFamily: "'Lora', serif", fontSize: 22, lineHeight: 1.3, marginBottom: 24 }}>
              {type === "tradeIdeas" && `${form.ticker || "Ticker"} · ${form.direction || "Long"} · ${form.term || "ST"}`}
              {type === "thesis" && `${form.ticker || "Ticker"} · ${form.conviction || "High"} conviction`}
              {(type === "macro" || type === "marketUpdates") && `${form.date || "Date"}${form.tags ? ` · ${form.tags}` : ""}`}
            </div>
            <RichArticleEditor
              folder={`research/${type}-inline`}
              value={String(type === "thesis" ? form.summary || "" : type === "tradeIdeas" ? form.thesis || "" : form.body || "")}
              onChange={value => setForm(p => ({ ...p, [type === "thesis" ? "summary" : type === "tradeIdeas" ? "thesis" : "body"]: value }))}
              placeholder="Start writing..."
            />
          </div>
        </ComposerShell>
      )}

      {viewingItem && useComposer && (
        <ComposerShell
          onBack={() => setViewing(null)}
          onSave={() => edit(viewingItem.id)}
          saveLabel="EDIT ENTRY"
          title="VIEW ENTRY"
        >
          <div />
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "18px 0 64px" }}>
              <div style={{ fontSize: 12, color: "#a07828", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 18 }}>
                {RESEARCH_TYPE_LABEL[type]}
              </div>

              <div style={{ color: "#2f4368", fontFamily: "'Lora', serif", fontSize: 50, lineHeight: 1.08, marginBottom: 14 }}>
                {String((viewingItem as Record<string, string>).title || "Untitled")}
              </div>
              {!!(viewingItem as Record<string, string>).subtitle && (
                <div style={{ color: "#6f7b88", fontFamily: "'Lora', serif", fontSize: 24, lineHeight: 1.45, marginBottom: 18 }}>
                  {String((viewingItem as Record<string, string>).subtitle || "")}
                </div>
              )}

              <div style={{ color: "#6f7b88", fontFamily: "'Lora', serif", fontSize: 21, lineHeight: 1.45, marginBottom: 20 }}>
                {type === "tradeIdeas" && `${String((viewingItem as Record<string, string>).ticker || "Ticker")} · ${String((viewingItem as Record<string, string>).direction || "Long")} · ${String((viewingItem as Record<string, string>).term || "ST")}`}
                {type === "thesis" && `${String((viewingItem as Record<string, string>).ticker || "Ticker")} · ${String((viewingItem as Record<string, string>).conviction || "High")} conviction`}
                {(type === "macro" || type === "marketUpdates") && `${String((viewingItem as Record<string, string>).tags || "Internal note")}`}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", color: "#7f8896", fontSize: 12, marginBottom: 26, paddingBottom: 18, borderBottom: "1px solid #e3dbce" }}>
                <span>{String((viewingItem as Record<string, string>).date || new Date(viewingItem.id).toISOString().slice(0, 10))}</span>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: displayEntryStatus(viewingItem) === "Published" ? "#e7f5ea" : "#efe6d7", color: displayEntryStatus(viewingItem) === "Published" ? "#1f7a37" : "#8d6721" }}>
                  {displayEntryStatus(viewingItem)}
                </span>
                {(viewingItem as Record<string, string>).tags && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#efe6d7", color: "#8d6721" }}>
                    {String((viewingItem as Record<string, string>).tags)}
                  </span>
                )}
                {type === "thesis" && (viewingItem as Record<string, string>).models && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#e7eef6", color: "#32536f" }}>
                    Financial models attached
                  </span>
                )}
                {type === "thesis" && (viewingItem as Record<string, string>).materials && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#efe6d7", color: "#8d6721" }}>
                    Supplementary materials attached
                  </span>
                )}
                {type === "tradeIdeas" && (viewingItem as Record<string, string>).entry && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#edf1f6", color: "#506070" }}>
                    Entry: {String((viewingItem as Record<string, string>).entry)}
                  </span>
                )}
                {type === "tradeIdeas" && (viewingItem as Record<string, string>).target && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#e7f5ea", color: "#1f7a37" }}>
                    Target: {String((viewingItem as Record<string, string>).target)}
                  </span>
                )}
                {type === "tradeIdeas" && (viewingItem as Record<string, string>).stop && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#f9e7e7", color: "#b23a3a" }}>
                    Stop: {String((viewingItem as Record<string, string>).stop)}
                  </span>
                )}
              </div>

              <div style={{ background: "transparent", border: "none", padding: 0, minHeight: 520 }}>
                <ArticleContent content={String(type === "thesis" ? (viewingItem as Record<string, string>).summary || "" : type === "tradeIdeas" ? (viewingItem as Record<string, string>).thesis || "" : (viewingItem as Record<string, string>).body || "")} />
              </div>

              {!!(viewingItem as Record<string, string>).links && (
                <div style={{ marginTop: 34, paddingTop: 18, borderTop: "1px solid #e3dbce", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#7f776d" }}>Supporting Files</div>
                  <StoredFileList value={String((viewingItem as Record<string, string>).links || "")} accent="#9a6d18" />
                </div>
              )}
              {!!(viewingItem as Record<string, string>).models && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #e3dbce", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#7f776d" }}>Financial Models</div>
                  <StoredFileList value={String((viewingItem as Record<string, string>).models || "")} />
                </div>
              )}
              {!!(viewingItem as Record<string, string>).materials && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #e3dbce", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#7f776d" }}>Supplementary Materials</div>
                  <StoredFileList value={String((viewingItem as Record<string, string>).materials || "")} accent="#9a6d18" />
                </div>
              )}
              {(relatedTrades.length > 0 || relatedResearch.length > 0) && (
                <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid #e3dbce" }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#7f776d", marginBottom: 12 }}>Related Activity</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {relatedTrades.map(trade => (
                      <div key={`trade-${trade.id}`} style={{ padding: "12px 14px", borderRadius: 12, background: "#f6f0e5", border: "1px solid #e3dbce" }}>
                        <div style={{ fontSize: 11, color: "#8d6721", letterSpacing: 1.2, marginBottom: 4 }}>BLOTTER</div>
                        <div style={{ fontSize: 14, color: "#223130", fontWeight: 700 }}>{String(trade.ticker || "")} · {String(trade.description || trade.assetClass || "")}</div>
                        <div style={{ fontSize: 12, color: "#6f756f", marginTop: 3 }}>{String(trade.status || "")} · {String(trade.entryDate || "No date")}</div>
                      </div>
                    ))}
                    {relatedResearch.map(({ section, entry }) => (
                      <div key={`${section}-${entry.id}`} style={{ padding: "12px 14px", borderRadius: 12, background: "#f8f5ee", border: "1px solid #e3dbce" }}>
                        <div style={{ fontSize: 11, color: "#32536f", letterSpacing: 1.2, marginBottom: 4 }}>{section.toUpperCase()}</div>
                        <div style={{ fontSize: 14, color: "#223130", fontWeight: 700 }}>{String((entry as Record<string, string>).title || "Untitled")}</div>
                        <div style={{ fontSize: 12, color: "#6f756f", marginTop: 3 }}>{displayEntryDate(entry)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ComposerShell>
      )}

      {open && !useComposer && (
        <Modal title={editing !== null ? "Edit Entry" : "New Entry"} onClose={() => { setOpen(false); setEditing(null); }}>
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} /></Field>
              <Field label="Firm"><input style={iStyle} value={form.firm || ""} onChange={e => setForm(p => ({ ...p, firm: e.target.value }))} placeholder="Goldman, JPM, MS..." /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Analyst"><input style={iStyle} value={form.analyst || ""} onChange={e => setForm(p => ({ ...p, analyst: e.target.value }))} /></Field>
              <Field label="Rating"><input style={iStyle} value={form.rating || ""} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))} placeholder="Buy, Hold, Overweight..." /></Field>
            </div>
            <Field label="Title"><input style={iStyle} value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Initiation / update title" /></Field>
            <Field label="Notes"><textarea style={taStyle} value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Quick summary, key takeaways, PT changes..." /></Field>
            <Field label="Stored PDFs">
              <BlobUploadControl accept=".pdf,application/pdf" buttonLabel="UPLOAD PDF" folder="research/sell-side-pdfs" multiple onChange={value => setForm(p => ({ ...p, links: value }))} value={form.links || ""} />
              <StoredFileList value={form.links || ""} accent="#9a6d18" onRemove={url => setForm(p => ({ ...p, links: parseStoredUrls(p.links || "").filter(x => x !== url).join("\n") }))} />
            </Field>
          </>

          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

type SellSideFolder = ResearchEntry & { name?: string; createdAt?: string };
type BlobListItem = { url: string; pathname: string; size: number; uploadedAt?: string };

function fmtFileSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function folderSlug(name: string) {
  return name.trim().replace(/\s+/g, "-");
}

function SellSideFilesTab({ folders, onSave }: { folders: ResearchEntry[]; onSave: (items: ResearchEntry[]) => void }) {
  const items = (folders as SellSideFolder[]).filter(folder => folder.name);
  const [selectedId, setSelectedId] = useState<number | null>(items[0]?.id ?? null);
  const [newFolder, setNewFolder] = useState("");
  const [files, setFiles] = useState<BlobListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && !items.some(folder => folder.id === selectedId)) setSelectedId(items[0]?.id ?? null);
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const selectedFolder = items.find(folder => folder.id === selectedId) ?? null;
  const selectedPrefix = selectedFolder ? `research/sell-side-pdfs/${folderSlug(selectedFolder.name || "")}` : "";

  async function loadFiles(prefix: string) {
    if (!prefix) { setFiles([]); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/uploads?prefix=${encodeURIComponent(prefix)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to load files");
      setFiles(payload.blobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles(selectedPrefix);
  }, [selectedPrefix]);

  function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    const entry = { id: Date.now(), name, createdAt: new Date().toISOString() };
    onSave([entry, ...items]);
    setNewFolder("");
    setSelectedId(entry.id);
  }

  function deleteFolder(id: number) {
    const remaining = items.filter(folder => folder.id !== id);
    onSave(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
  }

  async function deleteFile(url: string) {
    setDeletingUrl(url);
    setError(null);
    try {
      const response = await fetch(`/api/uploads?url=${encodeURIComponent(url)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Delete failed");
      await loadFiles(selectedPrefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingUrl(null);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...softPanel, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 12 }}>FOLDERS</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={iStyle} value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="2026-04-17 or Semis Week" />
          <button onClick={createFolder} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "0 12px", fontSize: 10, letterSpacing: 1, cursor: "pointer" }}>NEW</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 && <div style={{ color: "#5a6070", fontSize: 11 }}>Create a folder to start organizing PDFs.</div>}
          {items.map(folder => (
            <div key={folder.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setSelectedId(folder.id)} style={{ flex: 1, textAlign: "left", background: selectedId === folder.id ? "#f4ebdd" : "transparent", border: "1px solid #ddd1bf", color: selectedId === folder.id ? "#20302f" : "#6f756f", borderRadius: 12, padding: "11px 13px", cursor: "pointer", fontSize: 11 }}>{folder.name}</button>
              <button onClick={() => deleteFolder(folder.id)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...softPanel, padding: 22 }}>
        {!selectedFolder && <div style={{ color: "#5a6070", fontSize: 12 }}>Pick or create a folder, then upload PDFs into it.</div>}
        {selectedFolder && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 4 }}>SELL-SIDE PDFS</div>
                <div style={{ fontSize: 18, color: "#0d0f14" }}>{selectedFolder.name}</div>
              </div>
              <BlobUploadControl accept=".pdf,application/pdf" buttonLabel="UPLOAD PDFS" folder={selectedPrefix} multiple onChange={() => {}} onUploaded={() => void loadFiles(selectedPrefix)} value="" />
            </div>
            {error && <div style={{ color: "#dc2626", fontSize: 11, marginBottom: 12 }}>{error}</div>}
            {loading && <div style={{ color: "#5a6070", fontSize: 11, marginBottom: 12 }}>Loading files...</div>}
            {!loading && files.length === 0 && <div style={{ color: "#5a6070", fontSize: 12 }}>No PDFs in this folder yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {files.map(file => {
                const name = file.pathname.split("/").pop() || file.pathname;
                return (
                  <div key={file.url} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid #ddd1bf", borderRadius: 14, background: "rgba(255,250,244,0.94)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={file.url} target="_blank" rel="noreferrer" style={{ color: "#0d0f14", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>{name}</a>
                      <div style={{ color: "#5a6070", fontSize: 10, marginTop: 4 }}>{fmtFileSize(file.size)}{file.uploadedAt ? ` · ${new Date(file.uploadedAt).toLocaleString()}` : ""}</div>
                    </div>
                    <a href={file.url} target="_blank" rel="noreferrer" style={{ color: "#a07828", textDecoration: "none", fontSize: 10, letterSpacing: 1 }}>OPEN</a>
                    <button onClick={() => void deleteFile(file.url)} disabled={deletingUrl === file.url} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 10, letterSpacing: 1, opacity: deletingUrl === file.url ? 0.5 : 1 }}>{deletingUrl === file.url ? "DELETING" : "DELETE"}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TRADING_TABS = [
  { key: "positions", label: "Positions" },
  { key: "blotter", label: "Blotter" },
  { key: "analytics", label: "Analytics" },
  { key: "journal", label: "Journal" },
  { key: "tradeIdeas", label: "Trade Ideas" },
] as const;

const RESEARCH_TABS = [
  { key: "thesis", label: "Investment Ideas" },
  { key: "sellSide", label: "Sell-Side" },
  { key: "macro", label: "Macro" },
  { key: "marketUpdates", label: "Market Updates" },
] as const;

type PrimaryTab = "trading" | "research";
type TradingTabKey = typeof TRADING_TABS[number]["key"];
type ResearchTabKey = typeof RESEARCH_TABS[number]["key"];

export default function ResearchDB() {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("trading");
  const [tradingTab, setTradingTab] = useState<TradingTabKey>("positions");
  const [researchTab, setResearchTab] = useState<ResearchTabKey>("sellSide");
  const [data, setData] = useState<DBData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [globalQuery, setGlobalQuery] = useState("");

  // Load on mount
  useEffect(() => {
    fetch("/api/data").then(r => r.json()).then(setData);
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(async () => {
      setSaving(true);
      await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
    return () => clearTimeout(t);
  }, [data]);

  const update = useCallback((d: DBData) => setData(d), []);

  const globalResults = useMemo(() => {
    if (!data || !globalQuery.trim()) return [];
    const q = globalQuery.trim().toLowerCase();
    const researchSections: Array<{ key: ResearchTabKey; label: string; items: ResearchEntry[] }> = [
      { key: "thesis", label: "Investment Ideas", items: data.thesis },
      { key: "sellSide", label: "Sell-Side", items: data.sellSideResearch },
      { key: "macro", label: "Macro", items: data.macro },
      { key: "marketUpdates", label: "Market Updates", items: data.marketUpdates },
    ];
    const researchHits = researchSections.flatMap(section =>
      section.items
        .filter(item => normalizedSearchText(Object.values(item as Record<string, unknown>)).includes(q))
        .slice(0, 5)
        .map(item => ({
          kind: "research" as const,
          label: section.label,
          title: String((item as Record<string, string>).title || (item as Record<string, string>).ticker || "Untitled"),
          meta: String((item as Record<string, string>).subtitle || (item as Record<string, string>).date || ""),
          action: () => {
            setPrimaryTab("research");
            setResearchTab(section.key);
            setGlobalQuery("");
          },
        }))
    );
    const tradingHits = [
      ...(data.equityPositions ?? [])
        .filter(item => normalizedSearchText(Object.values(item as Record<string, unknown>)).includes(q))
        .slice(0, 4)
        .map(item => ({
          kind: "trading" as const,
          label: "Positions",
          title: `${item.ticker} · Equity Position`,
          meta: `${item.status} · ${item.term}`,
          action: () => {
            setPrimaryTab("trading");
            setTradingTab("positions");
            setGlobalQuery("");
          },
        })),
      ...(data.optionsPositions ?? [])
        .filter(item => normalizedSearchText(Object.values(item as Record<string, unknown>)).includes(q))
        .slice(0, 4)
        .map(item => ({
          kind: "trading" as const,
          label: "Positions",
          title: `${item.ticker} · Option Position`,
          meta: `${item.status} · ${item.term}`,
          action: () => {
            setPrimaryTab("trading");
            setTradingTab("positions");
            setGlobalQuery("");
          },
        })),
      ...data.tradeIdeas
        .filter(item => normalizedSearchText(Object.values(item as Record<string, unknown>)).includes(q))
        .slice(0, 5)
        .map(item => ({
          kind: "trading" as const,
          label: "Trade Ideas",
          title: String((item as Record<string, string>).title || (item as Record<string, string>).ticker || "Untitled"),
          meta: String((item as Record<string, string>).subtitle || (item as Record<string, string>).date || ""),
          action: () => {
            setPrimaryTab("trading");
            setTradingTab("tradeIdeas");
            setGlobalQuery("");
          },
        })),
      ...data.blotter
        .filter(item => normalizedSearchText(Object.values(item as Record<string, unknown>)).includes(q))
        .slice(0, 5)
        .map(item => ({
          kind: "trading" as const,
          label: "Blotter",
          title: `${item.ticker} ${item.description ? `· ${item.description}` : ""}`.trim(),
          meta: `${item.status} · ${item.entryDate || ""}`,
          action: () => {
            setPrimaryTab("trading");
            setTradingTab("blotter");
            setGlobalQuery("");
          },
        })),
    ];
    return [...tradingHits, ...researchHits].slice(0, 10);
  }, [data, globalQuery]);

  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "transparent" }}>
        <div style={{ padding: "22px 28px", borderRadius: 20, border: "1px solid #d8cab5", background: "rgba(255,250,242,0.86)", boxShadow: "0 20px 60px rgba(73,54,29,0.10)", fontSize: 11, color: "#74684f", letterSpacing: 3 }}>LOADING PLAYGROUND...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent", padding: 20 }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ marginBottom: 18, padding: "18px 8px 14px", display: "flex", gap: 18, alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d7c8b3" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.8, textTransform: "uppercase" as const, color: "#9f6b1b", marginBottom: 6 }}>Hogan&apos;s Playground</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 34, lineHeight: 1, color: "#223130" }}>
              {primaryTab === "trading" ? "Trading" : "Research"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {saving && <div style={{ fontSize: 12, color: "#335c57", fontWeight: 700 }}>Saving...</div>}
            {!saving && lastSaved && <div style={{ fontSize: 12, color: "#335c57", fontWeight: 700 }}>Saved {lastSaved.toLocaleTimeString()}</div>}
            {!saving && !lastSaved && <div style={{ fontSize: 12, color: "#335c57", fontWeight: 700 }}>Ready</div>}
            <div style={{ fontSize: 11, color: "#7f776d", marginTop: 4 }}>
              {primaryTab === "trading" ? "Portfolio, blotter, analytics, and review." : "Investment ideas, files, macro, and market notes."}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ background: "rgba(255,250,242,0.82)", border: "1px solid #d8cab5", borderRadius: 18, padding: 16, maxWidth: 860 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.7, textTransform: "uppercase", color: "#9f6b1b", marginBottom: 8 }}>Universal Search</div>
            <input
              style={{ ...iStyle, maxWidth: "100%" }}
              value={globalQuery}
              onChange={e => setGlobalQuery(e.target.value)}
              placeholder="Search tickers, notes, tags, files, firms, and trades..."
            />
            {globalQuery.trim() && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {globalResults.length === 0 && (
                  <div style={{ fontSize: 12, color: "#7f776d", padding: "8px 2px" }}>No matches yet.</div>
                )}
                {globalResults.map((result, index) => (
                  <button
                    key={`${result.label}-${index}`}
                    type="button"
                    onClick={result.action}
                    style={{ textAlign: "left", background: "#fffaf2", border: "1px solid #e3dbce", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 10, letterSpacing: 1.4, color: result.kind === "trading" ? "#32536f" : "#8d6721", marginBottom: 4 }}>{result.label.toUpperCase()}</div>
                    <div style={{ fontSize: 14, color: "#223130", fontWeight: 700 }}>{result.title}</div>
                    {!!result.meta && <div style={{ fontSize: 12, color: "#6f756f", marginTop: 3 }}>{result.meta}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 12, display: "flex", gap: 24, borderBottom: "1px solid #d7c8b3" }}>
          {[
            { key: "trading", label: "Trading" },
            { key: "research", label: "Research" },
          ].map(group => (
            <button
              key={group.key}
              onClick={() => setPrimaryTab(group.key as PrimaryTab)}
              style={{
                background: "none",
                border: "none",
                borderBottom: primaryTab === group.key ? "2px solid #335c57" : "2px solid transparent",
                color: primaryTab === group.key ? "#223130" : "#7b766d",
                padding: "0 2px 12px",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: "pointer",
              }}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 22, display: "flex", gap: 10, flexWrap: "wrap" as const }}>
          {(primaryTab === "trading" ? TRADING_TABS : RESEARCH_TABS).map(section => {
            const active = primaryTab === "trading" ? tradingTab === section.key : researchTab === section.key;
            return (
              <button
                key={section.key}
                onClick={() => primaryTab === "trading" ? setTradingTab(section.key as TradingTabKey) : setResearchTab(section.key as ResearchTabKey)}
                style={{
                  background: active ? "rgba(51,92,87,0.12)" : "transparent",
                  border: "1px solid transparent",
                  color: active ? "#274844" : "#6f756f",
                  borderRadius: 999,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "8px 8px 36px", maxWidth: 1480, margin: "0 auto" }}>
        {primaryTab === "trading" && tradingTab === "positions" && <PositionsTab data={data} onChange={update} />}
        {primaryTab === "trading" && tradingTab === "blotter" && <BlotterTab data={data as any} onChange={update as any} />}
        {primaryTab === "trading" && tradingTab === "analytics" && <AnalyticsTab data={data as any} />}
        {primaryTab === "trading" && tradingTab === "journal" && <JournalTab data={data as any} onChange={update as any} />}
        {primaryTab === "trading" && tradingTab === "tradeIdeas" && <ResearchTab items={data.tradeIdeas} onSave={items => update({ ...data, tradeIdeas: items })} type="tradeIdeas" contextData={data} />}
        {primaryTab === "research" && researchTab === "thesis" && <ResearchTab items={data.thesis} onSave={items => update({ ...data, thesis: items })} type="thesis" contextData={data} />}
        {primaryTab === "research" && researchTab === "sellSide" && <SellSideFilesTab folders={data.sellSideResearch ?? []} onSave={items => update({ ...data, sellSideResearch: items })} />}
        {primaryTab === "research" && researchTab === "macro" && <ResearchTab items={data.macro} onSave={items => update({ ...data, macro: items })} type="macro" contextData={data} />}
        {primaryTab === "research" && researchTab === "marketUpdates" && <ResearchTab items={data.marketUpdates} onSave={items => update({ ...data, marketUpdates: items })} type="marketUpdates" contextData={data} />}
          </div>
        </div>
    </div>
  );
}
