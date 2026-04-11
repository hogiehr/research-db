"use client";

import { useState, useEffect, useCallback } from "react";
import BlotterTab from "./BlotterTab";
import AnalyticsTab from "./AnalyticsTab";
import JournalTab from "./JournalTab";

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#e2e4e8", border: "1px solid #2a2d35", borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "#a07828", letterSpacing: 2, textTransform: "uppercase" as const }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = { width: "100%", background: "#d4d6db", border: "1px solid #2a2d35", borderRadius: 6, padding: "8px 10px", color: "#0d0f14", fontSize: 13, outline: "none" };
const taStyle: React.CSSProperties = { ...iStyle, height: 90, resize: "vertical" as const };
const selStyle: React.CSSProperties = { ...iStyle };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, color: "#3a3f4c", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, label = "SAVE" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "9px 0", width: "100%", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8 }}>
      {label}
    </button>
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
          <Field label="Thesis Link (OneDrive URL)"><input style={iStyle} value={eqF.thesis} onChange={e => setEqF(p => ({ ...p, thesis: e.target.value }))} placeholder="https://..." /></Field>
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
          <Field label="Thesis Link (OneDrive URL)"><input style={iStyle} value={optF.thesis} onChange={e => setOptF(p => ({ ...p, thesis: e.target.value }))} placeholder="https://..." /></Field>
          <SaveBtn onClick={saveOpt} label="ADD POSITION" />
        </Modal>
      )}
    </div>
  );
}

// ─── Research Tab (Macro / Market Updates / Trade Ideas / Thesis) ─────────────

type ResearchType = "tradeIdeas" | "thesis" | "macro" | "marketUpdates";

function ResearchTab({ items, onSave, type }: { items: ResearchEntry[]; onSave: (items: ResearchEntry[]) => void; type: ResearchType }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const blank: Record<string, string> = type === "thesis"
    ? { ticker: "", title: "", conviction: "High", summary: "", catalysts: "", risks: "", links: "" }
    : type === "tradeIdeas"
    ? { ticker: "", direction: "Long", term: "ST", thesis: "", entry: "", target: "", stop: "", links: "" }
    : { title: "", date: new Date().toISOString().slice(0, 10), tags: "", body: "", links: "" };

  const [form, setForm] = useState<Record<string, string>>(blank);

  function save() {
    if (editing !== null) {
      onSave(items.map((x, i) => i === editing ? { ...form, id: x.id } : x));
      setEditing(null);
    } else {
      onSave([{ ...form, id: Date.now() }, ...items]);
    }
    setForm(blank);
    setOpen(false);
  }

  function edit(i: number) { setForm(items[i] as Record<string, string>); setEditing(i); setOpen(true); }
  function remove(i: number) { onSave(items.filter((_, j) => j !== i)); }

  const convColor: Record<string, string> = { High: "#16a34a", Medium: "#a07828", Low: "#dc2626" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => { setForm(blank); setEditing(null); setOpen(true); }}
          style={{ background: "#dcf0dc", border: "1px solid #2a4a2a", color: "#16a34a", borderRadius: 5, padding: "6px 18px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>
          + NEW ENTRY
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: 80, color: "#b0b3bc", fontSize: 12, letterSpacing: 2 }}>NO ENTRIES</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => {
          const e = item as Record<string, string>;
          return (
            <div key={item.id} style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                  {(type === "thesis" || type === "tradeIdeas") && e.ticker && (
                    <span style={{ fontSize: 15, color: "#0d0f14", fontWeight: 600 }}>{e.ticker}</span>
                  )}
                  {e.title && <span style={{ fontSize: 13, color: "#2a2f3c" }}>{e.title}</span>}
                  {type === "thesis" && e.conviction && (
                    <span style={{ fontSize: 10, color: convColor[e.conviction], border: `1px solid ${convColor[e.conviction]}40`, borderRadius: 3, padding: "2px 7px" }}>{e.conviction}</span>
                  )}
                  {type === "tradeIdeas" && e.direction && (
                    <span style={{ fontSize: 10, color: e.direction === "Long" ? "#16a34a" : "#dc2626", border: `1px solid ${e.direction === "Long" ? "#4ade8040" : "#f8717140"}`, borderRadius: 3, padding: "2px 7px" }}>{e.direction} · {e.term}</span>
                  )}
                  {(type === "macro" || type === "marketUpdates") && e.date && (
                    <span style={{ fontSize: 11, color: "#4a5060" }}>{e.date}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <button onClick={() => edit(i)} style={{ background: "none", border: "1px solid #2a2d35", color: "#3a3f4c", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>EDIT</button>
                  <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>✕</button>
                </div>
              </div>

              {(type === "macro" || type === "marketUpdates") && e.tags && (
                <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                  {e.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} style={{ fontSize: 10, color: "#a07828", background: "#a0782810", border: "1px solid #c9a84c25", borderRadius: 3, padding: "2px 7px" }}>{t}</span>
                  ))}
                </div>
              )}

              {(e.summary || e.thesis || e.body) && (
                <p style={{ fontSize: 13, color: "#2a2f3c", lineHeight: 1.65, fontFamily: "'Lora', serif", marginBottom: 8 }}>{e.summary || e.thesis || e.body}</p>
              )}

              {type === "thesis" && (e.catalysts || e.risks) && (
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

      {open && (
        <Modal title={editing !== null ? "Edit Entry" : "New Entry"} onClose={() => { setOpen(false); setEditing(null); }}>
          {type === "thesis" && <>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Conviction"><select style={selStyle} value={form.conviction || "High"} onChange={e => setForm(p => ({ ...p, conviction: e.target.value }))}><option>High</option><option>Medium</option><option>Low</option></select></Field>
            </div>
            <Field label="Title"><input style={iStyle} value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
            <Field label="Summary"><textarea style={taStyle} value={form.summary || ""} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} /></Field>
            <Field label="Catalysts"><textarea style={{ ...taStyle, height: 60 }} value={form.catalysts || ""} onChange={e => setForm(p => ({ ...p, catalysts: e.target.value }))} /></Field>
            <Field label="Risks"><textarea style={{ ...taStyle, height: 60 }} value={form.risks || ""} onChange={e => setForm(p => ({ ...p, risks: e.target.value }))} /></Field>
            <Field label="Links (one per line)"><textarea style={{ ...taStyle, height: 60 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
          </>}

          {type === "tradeIdeas" && <>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Ticker"><input style={iStyle} value={form.ticker || ""} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} /></Field>
              <Field label="Direction"><select style={selStyle} value={form.direction || "Long"} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}><option>Long</option><option>Short</option></select></Field>
              <Field label="Term"><select style={selStyle} value={form.term || "ST"} onChange={e => setForm(p => ({ ...p, term: e.target.value }))}><option>ST</option><option>MT</option><option>LT</option></select></Field>
            </div>
            <Field label="Thesis"><textarea style={taStyle} value={form.thesis || ""} onChange={e => setForm(p => ({ ...p, thesis: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Entry"><input style={iStyle} value={form.entry || ""} onChange={e => setForm(p => ({ ...p, entry: e.target.value }))} /></Field>
              <Field label="Target"><input style={iStyle} value={form.target || ""} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} /></Field>
              <Field label="Stop"><input style={iStyle} value={form.stop || ""} onChange={e => setForm(p => ({ ...p, stop: e.target.value }))} /></Field>
            </div>
            <Field label="Links (one per line)"><textarea style={{ ...taStyle, height: 60 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
          </>}

          {(type === "macro" || type === "marketUpdates") && <>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Title"><input style={iStyle} value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
              <Field label="Date"><input style={iStyle} type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
            </div>
            <Field label="Tags (comma separated)"><input style={iStyle} value={form.tags || ""} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="rates, china, equities" /></Field>
            <Field label="Body"><textarea style={{ ...taStyle, height: 140 }} value={form.body || ""} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} /></Field>
            <Field label="Links (one per line)"><textarea style={{ ...taStyle, height: 60 }} value={form.links || ""} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} /></Field>
          </>}

          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

const TABS = ["POSITIONS", "BLOTTER", "ANALYTICS", "JOURNAL", "TRADE IDEAS", "SECURITY THESIS", "MACRO", "MARKET UPDATES"];

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#e8e9ec" }}>
        <div style={{ fontSize: 11, color: "#5a6070", letterSpacing: 3 }}>LOADING...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#e8e9ec" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #141720", padding: "0 28px", display: "flex", alignItems: "center", height: 52 }}>
        <div style={{ width: 3, height: 18, background: "#a07828", borderRadius: 2, marginRight: 14 }} />
        <span style={{ fontSize: 11, color: "#a07828", letterSpacing: 3 }}>RESEARCH DB</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {saving && <span style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1 }}>SAVING...</span>}
          {!saving && lastSaved && <span style={{ fontSize: 10, color: "#b0b3bc", letterSpacing: 1 }}>SAVED {lastSaved.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: "1px solid #141720", padding: "0 28px", display: "flex" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid #c9a84c" : "2px solid transparent",
            color: tab === i ? "#a07828" : "#4a5060",
            padding: "13px 18px", fontSize: 10, letterSpacing: 2, cursor: "pointer",
            transition: "color 0.15s", marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "28px 28px", maxWidth: 1280, margin: "0 auto" }}>
        {tab === 0 && <PositionsTab data={data} onChange={update} />}
        {tab === 1 && <BlotterTab data={data as any} onChange={update as any} />}
        {tab === 2 && <AnalyticsTab data={data as any} />}
        {tab === 3 && <JournalTab data={data as any} onChange={update as any} />}
        {tab === 4 && <ResearchTab items={data.tradeIdeas} onSave={items => update({ ...data, tradeIdeas: items })} type="tradeIdeas" />}
        {tab === 5 && <ResearchTab items={data.thesis} onSave={items => update({ ...data, thesis: items })} type="thesis" />}
        {tab === 6 && <ResearchTab items={data.macro} onSave={items => update({ ...data, macro: items })} type="macro" />}
        {tab === 7 && <ResearchTab items={data.marketUpdates} onSave={items => update({ ...data, marketUpdates: items })} type="marketUpdates" />}
      </div>
    </div>
  );
}
