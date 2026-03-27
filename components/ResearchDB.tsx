"use client";

import { useState, useEffect, useCallback } from "react";
import BlotterTab, { computeGL, glColor, fmt$, ASSET_COLOR } from "./BlotterTab";
import AnalyticsTab from "./AnalyticsTab";
import { DBData, TradeEntry } from "@/lib/db";

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0f1117", border: "1px solid #2a2d35", borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "#c9a84c", letterSpacing: 2, textTransform: "uppercase" as const }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = { width: "100%", background: "#1a1d24", border: "1px solid #2a2d35", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" };
const taStyle: React.CSSProperties = { ...iStyle, height: 90, resize: "vertical" as const };
const selStyle: React.CSSProperties = { ...iStyle };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, color: "#555", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      {children}
    </div>
  );
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}

function sizeColor(x: number): string {
  if (x > 1.4) return "#f87171";
  if (x > 1.15) return "#fb923c";
  if (x >= 0.85) return "#4ade80";
  if (x >= 0.5) return "#555";
  return "#333";
}

// ─── Positions Tab (live view from blotter) ───────────────────────────────────

function PositionsTab({ data, onChange }: { data: DBData; onChange: (d: DBData) => void }) {
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);

  const settings = data.settings ?? { equityBaseline: 900, optionsBaseline: 600, futuresBaseline: 1000, forexBaseline: 1000 };

  // Open trades only
  const openTrades = (data.blotter ?? []).filter(t => t.status === "Open");
  const equityTrades = openTrades.filter(t => t.assetClass === "Equity" || t.assetClass === "Crypto");
  const optionsTrades = openTrades.filter(t => t.assetClass === "Options" && !t.isStrategy);
  const strategyTrades = openTrades.filter(t => t.isStrategy);
  const otherTrades = openTrades.filter(t => !["Equity", "Crypto", "Options"].includes(t.assetClass));

  async function refreshPrices() {
    setLoading(true);
    const tickers = Array.from(new Set(openTrades.map(t => t.ticker)));
    if (tickers.length === 0) { setLoading(false); return; }
    const r = await fetch(`/api/prices?tickers=${tickers.join(",")}`);
    const result = await r.json();
    setPrices(result);
    setLoading(false);
  }

  function updateBaseline(key: keyof typeof settings, val: number) {
    if (isNaN(val) || val <= 0) return;
    onChange({ ...data, settings: { ...settings, [key]: val } });
  }

  // Computed rows
  const eqRows = equityTrades.map(t => {
    const last = prices[t.ticker];
    const cost = t.entryPrice * t.units;
    const mv = last != null ? last * t.units : null;
    const gl = computeGL(t, last);
    const glPct = gl != null && cost > 0 ? gl / cost : null;
    const sizeX = cost / settings.equityBaseline;
    return { ...t, last, mv, gl, glPct, sizeX };
  });

  const optRows = optionsTrades.map(t => {
    const eqLast = prices[t.ticker];
    const gl = computeGL(t, eqLast);
    const glPct = gl != null ? gl / (t.entryPrice * t.units * 100) : null;
    const sizeX = (t.entryPrice * t.units * 100) / settings.optionsBaseline;
    return { ...t, eqLast, gl, glPct, sizeX };
  });

  const totalEqGL = eqRows.reduce((s, r) => s + (r.gl ?? 0), 0);
  const totalOptGL = optRows.reduce((s, r) => s + (r.gl ?? 0), 0);
  const totalOtherGL = otherTrades.reduce((s, t) => s + (t.glDollar ?? 0), 0);
  const grandTotal = totalEqGL + totalOptGL + totalOtherGL;

  const th: React.CSSProperties = { padding: "6px 12px", color: "#444", fontWeight: 400, textAlign: "left" as const, fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" as const };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 12, whiteSpace: "nowrap" as const, fontFamily: "'DM Mono', monospace" };

  return (
    <div>
      {/* Baseline configurator */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center", flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 10, color: "#444", letterSpacing: 1.5 }}>BASELINE</span>
        {([["EQ", "equityBaseline"], ["OPT", "optionsBaseline"], ["FUT", "futuresBaseline"], ["FX", "forexBaseline"]] as const).map(([label, key]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#555" }}>{label}</span>
            <span style={{ fontSize: 11, color: "#555" }}>$</span>
            <input
              type="number"
              defaultValue={settings[key]}
              key={settings[key]}
              onBlur={e => updateBaseline(key, parseFloat(e.target.value))}
              style={{ width: 76, background: "#0f1117", border: "1px solid #1e2128", borderRadius: 5, padding: "4px 8px", color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" }}
            />
          </div>
        ))}
        <span style={{ fontSize: 10, color: "#2a2d35" }}>saves on blur</span>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 32, marginBottom: 24, padding: "14px 20px", background: "#0f1117", border: "1px solid #1e2128", borderRadius: 8, alignItems: "center", flexWrap: "wrap" as const }}>
        <div>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 3 }}>TOTAL OPEN G/L</div>
          <div style={{ fontSize: 20, color: glColor(grandTotal), fontWeight: 600 }}>{fmt$(grandTotal)}</div>
        </div>
        <div style={{ width: 1, height: 36, background: "#1e2128" }} />
        <div><div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 3 }}>EQUITY / CRYPTO</div><div style={{ fontSize: 14, color: glColor(totalEqGL) }}>{fmt$(totalEqGL)}</div></div>
        <div><div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 3 }}>OPTIONS</div><div style={{ fontSize: 14, color: glColor(totalOptGL) }}>{fmt$(totalOptGL)}</div></div>
        {otherTrades.length > 0 && <div><div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 3 }}>OTHER</div><div style={{ fontSize: 14, color: glColor(totalOtherGL) }}>{fmt$(totalOtherGL)}</div></div>}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={refreshPrices} disabled={loading} style={{ background: "#c9a84c", color: "#0a0c10", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1, opacity: loading ? 0.6 : 1 }}>
            {loading ? "LOADING..." : "↻ REFRESH PRICES"}
          </button>
        </div>
      </div>

      {/* EQUITY / CRYPTO */}
      {eqRows.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 10 }}>EQUITY / CRYPTO</div>
          <div style={{ overflowX: "auto", background: "#0a0c10", borderRadius: 8, border: "1px solid #1e2128" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["CLASS","TICKER","DIR","UNITS","ENTRY","LAST","MV","COST","G/L $","G/L %","SIZE","NOTES",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {eqRows.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #0f1117" }}>
                    <td style={td}><span style={{ fontSize: 10, color: ASSET_COLOR[r.assetClass] }}>{r.assetClass.toUpperCase()}</span></td>
                    <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{r.ticker}</td>
                    <td style={{ ...td, color: r.direction === "Long" ? "#4ade80" : "#f87171" }}>{r.direction === "Long" ? "L" : "S"}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{r.units}</td>
                    <td style={{ ...td, color: "#8b9299" }}>${r.entryPrice.toFixed(2)}</td>
                    <td style={{ ...td, color: "#e2e8f0" }}>{r.last != null ? `$${r.last.toFixed(2)}` : "—"}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{fmt$(r.mv)}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{fmt$(r.entryPrice * r.units)}</td>
                    <td style={{ ...td, color: glColor(r.gl), fontWeight: 600 }}>{fmt$(r.gl)}</td>
                    <td style={{ ...td, color: glColor(r.glPct) }}>{fmtPct(r.glPct)}</td>
                    <td style={td}><span style={{ fontSize: 11, color: sizeColor(r.sizeX), fontWeight: 600 }}>{r.sizeX.toFixed(2)}x</span></td>
                    <td style={{ ...td, color: "#555", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{r.thesis ? <a href={r.thesis} target="_blank" rel="noreferrer" style={{ color: "#c9a84c", textDecoration: "none" }}>↗ link</a> : (r.notes || "—")}</td>
                    <td style={td}><span style={{ fontSize: 10, color: "#333" }}>→ blotter</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPTIONS */}
      {optRows.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 10 }}>OPTIONS</div>
          <div style={{ overflowX: "auto", background: "#0a0c10", borderRadius: 8, border: "1px solid #1e2128" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["TICKER","P/C","STRIKE","EXP","UNITS","FILL","BASIS","EQ ENTRY","EQ LAST","G/L $","G/L %","SIZE","NOTES",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {optRows.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #0f1117" }}>
                    <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{r.ticker}</td>
                    <td style={{ ...td, color: r.pc === "C" ? "#4ade80" : "#f87171" }}>{r.pc ?? "—"}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{r.strike ? `$${r.strike}` : "—"}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{r.expiration ?? "—"}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{r.units}</td>
                    <td style={{ ...td, color: "#8b9299" }}>${r.entryPrice.toFixed(2)}</td>
                    <td style={{ ...td, color: "#8b9299" }}>{fmt$(r.entryPrice * r.units * 100)}</td>
                    <td style={{ ...td, color: "#555" }}>{r.eqEntryPrice ? `$${r.eqEntryPrice.toFixed(2)}` : "—"}</td>
                    <td style={{ ...td, color: "#e2e8f0" }}>{r.eqLast != null ? `$${r.eqLast.toFixed(2)}` : "—"}</td>
                    <td style={{ ...td, color: glColor(r.gl), fontWeight: 600 }}>{fmt$(r.gl)}</td>
                    <td style={{ ...td, color: glColor(r.glPct) }}>{fmtPct(r.glPct)}</td>
                    <td style={td}><span style={{ fontSize: 11, color: sizeColor(r.sizeX), fontWeight: 600 }}>{r.sizeX.toFixed(2)}x</span></td>
                    <td style={{ ...td, color: "#555" }}>{r.thesis ? <a href={r.thesis} target="_blank" rel="noreferrer" style={{ color: "#c9a84c", textDecoration: "none" }}>↗ link</a> : (r.notes || "—")}</td>
                    <td style={td}><span style={{ fontSize: 10, color: "#333" }}>→ blotter</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 10, color: "#333", marginTop: 6 }}>G/L = (eq last − eq entry) × contracts × 100. Reversed for puts.</p>
        </div>
      )}

      {/* STRATEGIES */}
      {strategyTrades.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "#e879f9", letterSpacing: 2, marginBottom: 10 }}>STRATEGIES</div>
          <div style={{ overflowX: "auto", background: "#0a0c10", borderRadius: 8, border: "1px solid #1e2128" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["STRATEGY","TICKER","DESCRIPTION","CONTRACTS","NET PREM","MAX PROFIT","MAX LOSS","ENTRY DATE","SIZE",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {strategyTrades.map(t => {
                  const sizeX = Math.abs(t.netPremium ?? 0) / settings.optionsBaseline;
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #0f1117" }}>
                      <td style={{ ...td }}><span style={{ fontSize: 10, color: "#e879f9" }}>{t.strategyType?.toUpperCase()}</span></td>
                      <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{t.ticker}</td>
                      <td style={{ ...td, color: "#555" }}>{t.description || "—"}</td>
                      <td style={{ ...td, color: "#8b9299" }}>{t.contracts}x</td>
                      <td style={{ ...td, color: t.netPremium != null && t.netPremium <= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                        {t.netPremium != null ? `${t.netPremium <= 0 ? "+" : ""}${fmt$(Math.abs(t.netPremium))} ${t.netPremium <= 0 ? "cr" : "db"}` : "—"}
                      </td>
                      <td style={{ ...td, color: "#4ade80" }}>{fmt$(t.maxProfit)}</td>
                      <td style={{ ...td, color: "#f87171" }}>{fmt$(t.maxLoss)}</td>
                      <td style={{ ...td, color: "#555" }}>{t.entryDate || "—"}</td>
                      <td style={td}><span style={{ fontSize: 11, color: sizeColor(sizeX), fontWeight: 600 }}>{sizeX.toFixed(2)}x</span></td>
                      <td style={td}><span style={{ fontSize: 10, color: "#333" }}>→ blotter</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OTHER open trades */}
      {otherTrades.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 10 }}>FUTURES / FOREX / OTHER</div>
          <div style={{ overflowX: "auto", background: "#0a0c10", borderRadius: 8, border: "1px solid #1e2128" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>
                {["CLASS","TICKER","DESCRIPTION","DIR","UNITS","ENTRY","ENTRY DATE","G/L $","SIZE","NOTES",""].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {otherTrades.map(t => {
                  const baseline = t.assetClass === "Futures" ? settings.futuresBaseline : settings.forexBaseline;
                  const cost = t.entryPrice * t.units;
                  const sizeX = cost / baseline;
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #0f1117" }}>
                      <td style={td}><span style={{ fontSize: 10, color: ASSET_COLOR[t.assetClass] }}>{t.assetClass.toUpperCase()}</span></td>
                      <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{t.ticker}</td>
                      <td style={{ ...td, color: "#555" }}>{t.description || "—"}</td>
                      <td style={{ ...td, color: t.direction === "Long" ? "#4ade80" : "#f87171" }}>{t.direction === "Long" ? "L" : "S"}</td>
                      <td style={{ ...td, color: "#8b9299" }}>{t.units}</td>
                      <td style={{ ...td, color: "#8b9299" }}>${t.entryPrice.toFixed(2)}</td>
                      <td style={{ ...td, color: "#555" }}>{t.entryDate || "—"}</td>
                      <td style={{ ...td, color: "#555" }}>manual on close</td>
                      <td style={td}><span style={{ fontSize: 11, color: sizeColor(sizeX), fontWeight: 600 }}>{sizeX.toFixed(2)}x</span></td>
                      <td style={{ ...td, color: "#555" }}>{t.notes || "—"}</td>
                      <td style={td}><span style={{ fontSize: 10, color: "#333" }}>→ blotter</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openTrades.length === 0 && strategyTrades.length === 0 && (
        <div style={{ textAlign: "center", padding: 80, color: "#2a2d35", fontSize: 12, letterSpacing: 2 }}>
          NO OPEN POSITIONS — ADD TRADES IN BLOTTER
        </div>
      )}
    </div>
  );
}

// ─── Research Tab ─────────────────────────────────────────────────────────────

type ResearchEntry = { id: number; [key: string]: unknown };
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
    setForm(blank); setOpen(false);
  }

  function edit(i: number) { setForm(items[i] as Record<string, string>); setEditing(i); setOpen(true); }
  function remove(i: number) { onSave(items.filter((_, j) => j !== i)); }

  const convColor: Record<string, string> = { High: "#4ade80", Medium: "#c9a84c", Low: "#f87171" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => { setForm(blank); setEditing(null); setOpen(true); }}
          style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", color: "#4ade80", borderRadius: 5, padding: "6px 18px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>
          + NEW ENTRY
        </button>
      </div>

      {items.length === 0 && <div style={{ textAlign: "center", padding: 80, color: "#2a2d35", fontSize: 12, letterSpacing: 2 }}>NO ENTRIES</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => {
          const e = item as Record<string, string>;
          return (
            <div key={item.id} style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                  {(type === "thesis" || type === "tradeIdeas") && e.ticker && <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 600 }}>{e.ticker}</span>}
                  {e.title && <span style={{ fontSize: 13, color: "#8b9299" }}>{e.title}</span>}
                  {type === "thesis" && e.conviction && <span style={{ fontSize: 10, color: convColor[e.conviction], border: `1px solid ${convColor[e.conviction]}40`, borderRadius: 3, padding: "2px 7px" }}>{e.conviction}</span>}
                  {type === "tradeIdeas" && e.direction && <span style={{ fontSize: 10, color: e.direction === "Long" ? "#4ade80" : "#f87171", border: `1px solid ${e.direction === "Long" ? "#4ade8040" : "#f8717140"}`, borderRadius: 3, padding: "2px 7px" }}>{e.direction} · {e.term}</span>}
                  {(type === "macro" || type === "marketUpdates") && e.date && <span style={{ fontSize: 11, color: "#444" }}>{e.date}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <button onClick={() => edit(i)} style={{ background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>EDIT</button>
                  <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 15 }}>✕</button>
                </div>
              </div>
              {(type === "macro" || type === "marketUpdates") && e.tags && (
                <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                  {e.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => <span key={t} style={{ fontSize: 10, color: "#c9a84c", background: "#c9a84c10", border: "1px solid #c9a84c25", borderRadius: 3, padding: "2px 7px" }}>{t}</span>)}
                </div>
              )}
              {(e.summary || e.thesis || e.body) && <p style={{ fontSize: 13, color: "#8b9299", lineHeight: 1.65, fontFamily: "'Lora', serif", marginBottom: 8 }}>{e.summary || e.thesis || e.body}</p>}
              {type === "thesis" && (e.catalysts || e.risks) && (
                <div style={{ display: "flex", gap: 24, marginTop: 6 }}>
                  {e.catalysts && <div style={{ fontSize: 11, color: "#4ade80" }}>▲ {e.catalysts}</div>}
                  {e.risks && <div style={{ fontSize: 11, color: "#f87171" }}>▼ {e.risks}</div>}
                </div>
              )}
              {type === "tradeIdeas" && (e.entry || e.target || e.stop) && (
                <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
                  {e.entry && <span style={{ fontSize: 11, color: "#555" }}>ENTRY <span style={{ color: "#e2e8f0" }}>{e.entry}</span></span>}
                  {e.target && <span style={{ fontSize: 11, color: "#555" }}>TARGET <span style={{ color: "#4ade80" }}>{e.target}</span></span>}
                  {e.stop && <span style={{ fontSize: 11, color: "#555" }}>STOP <span style={{ color: "#f87171" }}>{e.stop}</span></span>}
                </div>
              )}
              {e.links && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column" as const, gap: 2 }}>
                  {e.links.split("\n").filter(Boolean).map((l, j) => <a key={j} href={l} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#c9a84c", textDecoration: "none" }}>↗ {l.length > 70 ? l.slice(0, 70) + "…" : l}</a>)}
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
          <button onClick={save} style={{ background: "#c9a84c", color: "#0a0c10", border: "none", borderRadius: 6, padding: "9px 0", width: "100%", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8 }}>SAVE</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = ["POSITIONS", "BLOTTER", "ANALYTICS", "TRADE IDEAS", "SECURITY THESIS", "MACRO", "MARKET UPDATES"];

export default function ResearchDB() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<DBData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/data").then(r => r.json()).then(setData);
  }, []);

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
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080a0e" }}><div style={{ fontSize: 11, color: "#333", letterSpacing: 3 }}>LOADING...</div></div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080a0e" }}>
      <div style={{ borderBottom: "1px solid #141720", padding: "0 28px", display: "flex", alignItems: "center", height: 52 }}>
        <div style={{ width: 3, height: 18, background: "#c9a84c", borderRadius: 2, marginRight: 14 }} />
        <span style={{ fontSize: 11, color: "#c9a84c", letterSpacing: 3 }}>RESEARCH DB</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {saving && <span style={{ fontSize: 10, color: "#444", letterSpacing: 1 }}>SAVING...</span>}
          {!saving && lastSaved && <span style={{ fontSize: 10, color: "#2a2d35", letterSpacing: 1 }}>SAVED {lastSaved.toLocaleTimeString()}</span>}
        </div>
      </div>

      <div style={{ borderBottom: "1px solid #141720", padding: "0 28px", display: "flex", overflowX: "auto" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            background: "none", border: "none",
            borderBottom: tab === i ? "2px solid #c9a84c" : "2px solid transparent",
            color: tab === i ? "#c9a84c" : "#3a3d45",
            padding: "13px 18px", fontSize: 10, letterSpacing: 2, cursor: "pointer",
            transition: "color 0.15s", marginBottom: -1, whiteSpace: "nowrap",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "28px 28px", maxWidth: 1280, margin: "0 auto" }}>
        {tab === 0 && <PositionsTab data={data} onChange={update} />}
        {tab === 1 && <BlotterTab data={data} onChange={update} />}
        {tab === 2 && <AnalyticsTab data={data} />}
        {tab === 3 && <ResearchTab items={data.tradeIdeas ?? []} onSave={items => update({ ...data, tradeIdeas: items })} type="tradeIdeas" />}
        {tab === 4 && <ResearchTab items={data.thesis ?? []} onSave={items => update({ ...data, thesis: items })} type="thesis" />}
        {tab === 5 && <ResearchTab items={data.macro ?? []} onSave={items => update({ ...data, macro: items })} type="macro" />}
        {tab === 6 && <ResearchTab items={data.marketUpdates ?? []} onSave={items => update({ ...data, marketUpdates: items })} type="marketUpdates" />}
      </div>
    </div>
  );
}

