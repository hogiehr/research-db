"use client";

import { useState, useEffect, useCallback } from "react";
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
      <div style={{ width: "100%", margin: 0, padding: "24px 18px 40px", display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
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

  const th: React.CSSProperties = { padding: "6px 12px", color: "#4a5060", fontWeight: 400, textAlign: "left", fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 12, whiteSpace: "nowrap" };

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
            style={{ width: 80, background: "#e2e4e8", border: "1px solid #1e2128", borderRadius: 5, padding: "4px 8px", color: "#0d0f14", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#3a3f4c" }}>OPT</span>
          <span style={{ fontSize: 11, color: "#2a2f3c" }}>$</span>
          <input
            type="number" defaultValue={optBase}
            onBlur={e => updateBaseline("optionsBaseline", parseFloat(e.target.value))}
            style={{ width: 80, background: "#e2e4e8", border: "1px solid #1e2128", borderRadius: 5, padding: "4px 8px", color: "#0d0f14", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" }}
          />
        </div>
        <span style={{ fontSize: 10, color: "#b0b3bc" }}>updates on blur · persisted</span>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 32, marginBottom: 24, padding: "14px 20px", background: "#e2e4e8", border: "1px solid #1e2128", borderRadius: 8, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 3 }}>TOTAL OPEN G/L</div>
          <div style={{ fontSize: 20, color: glColor(grandTotal), fontWeight: 600 }}>{fmt$(grandTotal)}</div>
        </div>
        <div style={{ width: 1, height: 36, background: "#c4c7ce" }} />
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
          <button onClick={() => setAddEq(true)} style={{ background: "#dcf0dc", border: "1px solid #2a4a2a", color: "#16a34a", borderRadius: 5, padding: "4px 14px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>+ ADD</button>
        </div>
        <div style={{ overflowX: "auto", background: "#f0f1f3", borderRadius: 8, border: "1px solid #1e2128" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["STATUS","TERM","TICKER","UNITS","L/S","FILL","LAST","MV","COST","G/L $","G/L %","SIZE","THESIS",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {eqRows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #0f1117" }}>
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
                  <td style={td}>
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
          <button onClick={() => setAddOpt(true)} style={{ background: "#dcf0dc", border: "1px solid #2a4a2a", color: "#16a34a", borderRadius: 5, padding: "4px 14px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>+ ADD</button>
        </div>
        <div style={{ overflowX: "auto", background: "#f0f1f3", borderRadius: 8, border: "1px solid #1e2128" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["TICKER","P/C","STRIKE","EXP","UNITS","FILL","BASIS","EQ ENTRY","EQ LAST","G/L $","G/L %","SIZE","THESIS",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {optRows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #0f1117" }}>
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
                  <td style={td}>
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
            <input style={iStyle} value={eqF.thesis} onChange={e => setEqF(p => ({ ...p, thesis: e.target.value }))} placeholder="URL auto-fills after upload" />
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
            <input style={iStyle} value={optF.thesis} onChange={e => setOptF(p => ({ ...p, thesis: e.target.value }))} placeholder="URL auto-fills after upload" />
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

function ResearchTab({ items, onSave, type }: { items: ResearchEntry[]; onSave: (items: ResearchEntry[]) => void; type: ResearchType }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const useComposer = type !== "sellSideResearch";

  const blank: Record<string, string> = type === "thesis"
    ? { ticker: "", title: "", date: new Date().toISOString().slice(0, 10), conviction: "High", summary: "", tags: "", links: "" }
    : type === "tradeIdeas"
    ? { ticker: "", title: "", date: new Date().toISOString().slice(0, 10), direction: "Long", term: "ST", thesis: "", entry: "", target: "", stop: "", links: "" }
    : type === "sellSideResearch"
    ? { ticker: "", firm: "", analyst: "", title: "", date: new Date().toISOString().slice(0, 10), rating: "", notes: "", links: "" }
    : { title: "", date: new Date().toISOString().slice(0, 10), tags: "", body: "", links: "" };

  const [form, setForm] = useState<Record<string, string>>(blank);

  function save() {
    const nextForm = { ...form, date: form.date || new Date().toISOString().slice(0, 10) };
    if (editing !== null) {
      onSave(items.map(x => x.id === editing ? { ...nextForm, id: x.id } : x));
      setEditing(null);
    } else {
      onSave([{ ...nextForm, id: Date.now() }, ...items]);
    }
    setForm(blank);
    setOpen(false);
  }

  function edit(id: number) {
    const item = items.find(x => x.id === id);
    if (!item) return;
    setForm({ ...blank, ...(item as Record<string, string>), date: String((item as Record<string, string>).date || new Date(item.id).toISOString().slice(0, 10)) });
    setEditing(id);
    setViewing(null);
    setOpen(true);
  }
  function remove(id: number) {
    if (viewing === id) setViewing(null);
    onSave(items.filter(x => x.id !== id));
  }
  function view(id: number) { setViewing(id); }

  const convColor: Record<string, string> = { High: "#16a34a", Medium: "#a07828", Low: "#dc2626" };
  const sortedItems = [...items].sort((a, b) => String((b as Record<string, string>).date || "").localeCompare(String((a as Record<string, string>).date || "")));
  const filteredItems = sortedItems.filter(item => {
    if (!query.trim()) return true;
    const e = item as Record<string, string>;
    const haystack = [e.ticker, e.title, e.summary, e.thesis, e.body, e.tags, e.links, e.entry, e.target, e.stop]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const viewingItem = viewing !== null ? items.find(x => x.id === viewing) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
        {useComposer ? (
          <input style={{ ...iStyle, maxWidth: 360 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search entries..." />
        ) : <div />}
        <button onClick={() => { setForm(blank); setEditing(null); setViewing(null); setOpen(true); }}
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
            <div key={item.id} style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div onClick={() => useComposer && view(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, cursor: useComposer ? "pointer" : "default" }}>
                  {(type === "thesis" || type === "tradeIdeas" || type === "sellSideResearch") && e.ticker && (
                    <span style={{ fontSize: 15, color: "#0d0f14", fontWeight: 600 }}>{e.ticker}</span>
                  )}
                  {e.title && <span style={{ fontSize: 13, color: "#2a2f3c" }}>{e.title}</span>}
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
                  <button onClick={() => edit(item.id)} style={{ background: "none", border: "1px solid #2a2d35", color: "#3a3f4c", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>EDIT</button>
                  <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>✕</button>
                </div>
              </div>

              {(type === "thesis" || type === "macro" || type === "marketUpdates") && e.tags && (
                <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                  {e.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} style={{ fontSize: 10, color: "#a07828", background: "#a0782810", border: "1px solid #c9a84c25", borderRadius: 3, padding: "2px 7px" }}>{t}</span>
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
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column" as const, gap: 2 }}>
                  {e.links.split("\n").filter(Boolean).map((l, j) => (
                    <a key={j} href={l} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#a07828", textDecoration: "none" }}>
                      ↗ {l.length > 70 ? l.slice(0, 70) + "…" : l}
                    </a>
                  ))}
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
          saveLabel={editing !== null ? "SAVE ENTRY" : "PUBLISH ENTRY"}
          title={editing !== null ? "EDIT ENTRY" : "NEW ENTRY"}
        >
          <div style={{ background: "#efebe2", border: "1px solid #ddd6c7", borderRadius: 14, padding: 18, position: "sticky", top: 86 }}>
            {type === "thesis" && <>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Conviction"><select style={selStyle} value={form.conviction || "High"} onChange={e => setForm(p => ({ ...p, conviction: e.target.value }))}><option>High</option><option>Medium</option><option>Low</option></select></Field>
              <Field label="Tags"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="ai, earnings, semis" /></Field>
              <Field label="Links"><textarea style={{ ...taStyle, height: 84 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
            </>}
            {type === "tradeIdeas" && <>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Direction"><select style={selStyle} value={form.direction || "Long"} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}><option>Long</option><option>Short</option></select></Field>
              <Field label="Term"><select style={selStyle} value={form.term || "ST"} onChange={e => setForm(p => ({ ...p, term: e.target.value }))}><option>ST</option><option>MT</option><option>LT</option></select></Field>
              <Field label="Entry"><input style={iStyle} value={form.entry || ""} onChange={e => setForm(p => ({ ...p, entry: e.target.value }))} /></Field>
              <Field label="Target"><input style={iStyle} value={form.target || ""} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} /></Field>
              <Field label="Stop"><input style={iStyle} value={form.stop || ""} onChange={e => setForm(p => ({ ...p, stop: e.target.value }))} /></Field>
              <Field label="Links"><textarea style={{ ...taStyle, height: 84 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
            </>}
            {(type === "macro" || type === "marketUpdates") && <>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Tags"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="rates, china, equities" /></Field>
              <Field label="Links"><textarea style={{ ...taStyle, height: 84 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
            </>}
          </div>
          <div style={{ width: "100%", margin: 0 }}>
            <input
              style={{ width: "100%", border: "none", background: "transparent", color: "#3a4b68", fontFamily: "'Lora', serif", fontSize: 42, lineHeight: 1.15, outline: "none", marginBottom: 10 }}
              value={form.title || ""}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Title"
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
                {type === "thesis" ? "Security Thesis" : type === "tradeIdeas" ? "Trade Idea" : type === "macro" ? "Macro" : "Market Update"}
              </div>

              <div style={{ color: "#2f4368", fontFamily: "'Lora', serif", fontSize: 50, lineHeight: 1.08, marginBottom: 14 }}>
                {String((viewingItem as Record<string, string>).title || "Untitled")}
              </div>

              <div style={{ color: "#6f7b88", fontFamily: "'Lora', serif", fontSize: 21, lineHeight: 1.45, marginBottom: 20 }}>
                {type === "tradeIdeas" && `${String((viewingItem as Record<string, string>).ticker || "Ticker")} · ${String((viewingItem as Record<string, string>).direction || "Long")} · ${String((viewingItem as Record<string, string>).term || "ST")}`}
                {type === "thesis" && `${String((viewingItem as Record<string, string>).ticker || "Ticker")} · ${String((viewingItem as Record<string, string>).conviction || "High")} conviction`}
                {(type === "macro" || type === "marketUpdates") && `${String((viewingItem as Record<string, string>).tags || "Internal note")}`}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", color: "#7f8896", fontSize: 12, marginBottom: 26, paddingBottom: 18, borderBottom: "1px solid #e3dbce" }}>
                <span>{String((viewingItem as Record<string, string>).date || new Date(viewingItem.id).toISOString().slice(0, 10))}</span>
                {(viewingItem as Record<string, string>).tags && (
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#efe6d7", color: "#8d6721" }}>
                    {String((viewingItem as Record<string, string>).tags)}
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
                  {String((viewingItem as Record<string, string>).links || "").split("\n").filter(Boolean).map((l, j) => (
                    <a key={j} href={l} target="_blank" rel="noreferrer" style={{ color: "#9a6d18", fontSize: 13, textDecoration: "none" }}>
                      {l}
                    </a>
                  ))}
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
            <Field label="PDF Links (one per line)">
              <textarea style={{ ...taStyle, height: 60 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} placeholder="PDF URL auto-fills after upload" />
              <BlobUploadControl accept=".pdf,application/pdf" buttonLabel="UPLOAD PDF" folder="research/sell-side-pdfs" multiple onChange={value => setForm(p => ({ ...p, links: value }))} value={form.links || ""} />
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
      <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 12 }}>FOLDERS</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input style={iStyle} value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="2026-04-17 or Semis Week" />
          <button onClick={createFolder} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "0 12px", fontSize: 10, letterSpacing: 1, cursor: "pointer" }}>NEW</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 && <div style={{ color: "#5a6070", fontSize: 11 }}>Create a folder to start organizing PDFs.</div>}
          {items.map(folder => (
            <div key={folder.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setSelectedId(folder.id)} style={{ flex: 1, textAlign: "left", background: selectedId === folder.id ? "#e2e4e8" : "transparent", border: "1px solid #1e2128", color: selectedId === folder.id ? "#0d0f14" : "#3a3f4c", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontSize: 11 }}>{folder.name}</button>
              <button onClick={() => deleteFolder(folder.id)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: 20 }}>
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
                  <div key={file.url} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #1e2128", borderRadius: 8, background: "#e2e4e8" }}>
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

const TABS = [
  { label: "Positions", eyebrow: "Portfolio" },
  { label: "Blotter", eyebrow: "Trading" },
  { label: "Analytics", eyebrow: "Stats" },
  { label: "Journal", eyebrow: "Review" },
  { label: "Trade Ideas", eyebrow: "Pipeline" },
  { label: "Security Thesis", eyebrow: "Deep Work" },
  { label: "Sell-Side PDFs", eyebrow: "Library" },
  { label: "Macro", eyebrow: "Top Down" },
  { label: "Market Updates", eyebrow: "Pulse" },
];

export default function ResearchDB() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<DBData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
        <div style={{ marginBottom: 18, padding: "26px 28px 22px", borderRadius: 30, border: "1px solid #d9c8b0", background: "linear-gradient(135deg, rgba(255,251,245,0.92) 0%, rgba(242,233,219,0.88) 100%)", boxShadow: "0 22px 70px rgba(76,57,31,0.11)" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 999, background: "rgba(239,226,201,0.72)", color: "#94631a", fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" as const, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#335c57", display: "inline-block" }} />
                Hogan&apos;s Playground
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 52, lineHeight: 0.96, color: "#223130", marginBottom: 12 }}>
                Private market workspace,
                <br />
                cleaner and way less miserable.
              </div>
              <div style={{ maxWidth: 700, color: "#6a7169", fontSize: 15, lineHeight: 1.7 }}>
                Trade blotter, thesis writing, macro notes, journal work, analytics, and sell-side files all in one place with a softer reading-first layout.
              </div>
            </div>
            <div style={{ minWidth: 220, padding: "16px 18px", borderRadius: 22, background: "rgba(255,250,244,0.78)", border: "1px solid #ddcfbc" }}>
              <div style={{ fontSize: 10, color: "#887a64", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 8 }}>Workspace Status</div>
              {saving && <div style={{ fontSize: 13, color: "#335c57", fontWeight: 700 }}>Saving changes...</div>}
              {!saving && lastSaved && <div style={{ fontSize: 13, color: "#335c57", fontWeight: 700 }}>Saved {lastSaved.toLocaleTimeString()}</div>}
              {!saving && !lastSaved && <div style={{ fontSize: 13, color: "#335c57", fontWeight: 700 }}>Ready to work</div>}
              <div style={{ fontSize: 12, color: "#7f776d", marginTop: 6, lineHeight: 1.5 }}>Everything here stays internal and updates automatically while you work.</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 22, padding: 12, borderRadius: 24, border: "1px solid #dacbb8", background: "rgba(255,250,244,0.76)", boxShadow: "0 16px 50px rgba(73,54,29,0.08)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
            {TABS.map((t, i) => (
              <button key={t.label} onClick={() => setTab(i)} style={{
                background: tab === i ? "linear-gradient(135deg, #335c57 0%, #274844 100%)" : "rgba(255,250,244,0.88)",
                border: tab === i ? "1px solid #335c57" : "1px solid #ddcfbc",
                color: tab === i ? "#f8f4ec" : "#3d4643",
                borderRadius: 18,
                padding: "12px 14px",
                cursor: "pointer",
                minWidth: 138,
                textAlign: "left",
                boxShadow: tab === i ? "0 12px 26px rgba(39,72,68,0.22)" : "none",
              }}>
                <div style={{ fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" as const, opacity: tab === i ? 0.72 : 0.55, marginBottom: 4 }}>{t.eyebrow}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "8px 8px 36px", maxWidth: 1480, margin: "0 auto" }}>
        {tab === 0 && <PositionsTab data={data} onChange={update} />}
        {tab === 1 && <BlotterTab data={data as any} onChange={update as any} />}
        {tab === 2 && <AnalyticsTab data={data as any} />}
        {tab === 3 && <JournalTab data={data as any} onChange={update as any} />}
        {tab === 4 && <ResearchTab items={data.tradeIdeas} onSave={items => update({ ...data, tradeIdeas: items })} type="tradeIdeas" />}
        {tab === 5 && <ResearchTab items={data.thesis} onSave={items => update({ ...data, thesis: items })} type="thesis" />}
        {tab === 6 && <SellSideFilesTab folders={data.sellSideResearch ?? []} onSave={items => update({ ...data, sellSideResearch: items })} />}
        {tab === 7 && <ResearchTab items={data.macro} onSave={items => update({ ...data, macro: items })} type="macro" />}
        {tab === 8 && <ResearchTab items={data.marketUpdates} onSave={items => update({ ...data, marketUpdates: items })} type="marketUpdates" />}
        </div>
      </div>
    </div>
  );
}
