"use client";
import { useState } from "react";
import { TradeEntry, OptionLeg, StrategyType, AssetClass, DBData } from "@/lib/db";

export const ASSET_CLASSES: AssetClass[] = ["Equity", "Options", "Futures", "Forex", "Fixed Income", "Crypto"];
export const ASSET_COLOR: Record<AssetClass, string> = { Equity: "#16a34a", Options: "#a07828", Futures: "#2563eb", Forex: "#7c3aed", "Fixed Income": "#059669", Crypto: "#be185d" };
const STRATEGIES: StrategyType[] = ["Call Spread", "Put Spread", "Iron Condor", "Straddle", "Strangle", "Covered Call", "Cash Secured Put", "Calendar Spread", "Risk Reversal"];
const STRATEGY_LEGS: Record<StrategyType, Omit<OptionLeg, "strike"|"expiration"|"premium"|"contracts">[]> = {
  "Call Spread": [{ role: "Long Call", pc: "C", direction: "Long" }, { role: "Short Call", pc: "C", direction: "Short" }],
  "Put Spread": [{ role: "Long Put", pc: "P", direction: "Long" }, { role: "Short Put", pc: "P", direction: "Short" }],
  "Iron Condor": [{ role: "Long Put", pc: "P", direction: "Long" }, { role: "Short Put", pc: "P", direction: "Short" }, { role: "Short Call", pc: "C", direction: "Short" }, { role: "Long Call", pc: "C", direction: "Long" }],
  "Straddle": [{ role: "Long Call", pc: "C", direction: "Long" }, { role: "Long Put", pc: "P", direction: "Long" }],
  "Strangle": [{ role: "Long Call", pc: "C", direction: "Long" }, { role: "Long Put", pc: "P", direction: "Long" }],
  "Covered Call": [{ role: "Short Call", pc: "C", direction: "Short" }],
  "Cash Secured Put": [{ role: "Short Put", pc: "P", direction: "Short" }],
  "Calendar Spread": [{ role: "Long Call (far)", pc: "C", direction: "Long" }, { role: "Short Call (near)", pc: "C", direction: "Short" }],
  "Risk Reversal": [{ role: "Long Call", pc: "C", direction: "Long" }, { role: "Short Put", pc: "P", direction: "Short" }],
};

function calcStrategyMetrics(legs: OptionLeg[], contracts: number) {
  const netPerShare = legs.reduce((s, l) => s + (l.direction === "Long" ? -l.premium : l.premium), 0);
  const netPremium = netPerShare * 100 * contracts;
  const lc = legs.find(l => l.pc === "C" && l.direction === "Long");
  const sc = legs.find(l => l.pc === "C" && l.direction === "Short");
  const lp = legs.find(l => l.pc === "P" && l.direction === "Long");
  const sp = legs.find(l => l.pc === "P" && l.direction === "Short");
  if (lc && sc && !lp && !sp && lc.strike < sc.strike) { const w = (sc.strike - lc.strike) * 100 * contracts; return { netPremium, maxProfit: w - Math.abs(netPremium), maxLoss: -Math.abs(netPremium) }; }
  if (lp && sp && !lc && !sc && sp.strike > lp.strike) { const w = (sp.strike - lp.strike) * 100 * contracts; return { netPremium, maxProfit: Math.abs(netPremium), maxLoss: -(w - Math.abs(netPremium)) }; }
  return { netPremium, maxProfit: null as number | null, maxLoss: null as number | null };
}

export function computeGL(t: TradeEntry, livePrice?: number | null): number | null {
  if (t.status === "Closed") return t.glDollar;
  if (t.isStrategy) return null;
  const price = livePrice ?? null;
  if (t.assetClass === "Equity" || t.assetClass === "Crypto") {
    if (price == null) return null;
    return t.direction === "Long" ? (price - t.entryPrice) * t.units : (t.entryPrice - price) * t.units;
  }
  if (t.assetClass === "Options") {
    if (price == null || t.eqEntryPrice == null) return null;
    const move = price - t.eqEntryPrice;
    return (t.pc === "C" ? move : -move) * t.units * 100;
  }
  return null;
}

export function fmt$(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-$" : "$") + s;
}
export function glColor(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "#2a2f3c";
  return n >= 0 ? "#16a34a" : "#dc2626";
}

const iStyle: React.CSSProperties = { width: "100%", background: "#d4d6db", border: "1px solid #2a2d35", borderRadius: 6, padding: "8px 10px", color: "#0d0f14", fontSize: 12, outline: "none", fontFamily: "'DM Mono', monospace" };
const taStyle: React.CSSProperties = { ...iStyle, height: 72, resize: "vertical" as const };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12, flex: 1, minWidth: 0 }}><label style={{ display: "block", fontSize: 10, color: "#3a3f4c", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#e2e4e8", border: "1px solid #2a2d35", borderRadius: 12, width: "100%", maxWidth: 780, maxHeight: "92vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "#a07828", letterSpacing: 2, textTransform: "uppercase" as const }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StrategyForm({ ticker, strategyType, contracts, entryDate, onSave, onCancel }: { ticker: string; strategyType: StrategyType; contracts: number; entryDate: string; onSave: (legs: OptionLeg[], m: { netPremium: number; maxProfit: number | null; maxLoss: number | null }) => void; onCancel: () => void }) {
  const [legs, setLegs] = useState<OptionLeg[]>(STRATEGY_LEGS[strategyType].map(t => ({ ...t, strike: 0, expiration: entryDate, premium: 0, contracts })));
  function upd(i: number, key: keyof OptionLeg, val: unknown) { setLegs(p => p.map((l, j) => j === i ? { ...l, [key]: val } : l)); }
  const m = calcStrategyMetrics(legs, contracts);
  return (
    <div>
      <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 1.5, marginBottom: 14 }}>{strategyType.toUpperCase()} — {ticker} — {contracts} contract{contracts !== 1 ? "s" : ""}</div>
      {legs.map((leg, i) => (
        <div key={i} style={{ background: "#f0f1f3", borderRadius: 8, padding: "12px 16px", marginBottom: 10, border: "1px solid #1e2128" }}>
          <div style={{ fontSize: 10, color: leg.direction === "Long" ? "#16a34a" : "#dc2626", letterSpacing: 1.5, marginBottom: 10 }}>{leg.direction.toUpperCase()} — {leg.role}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Strike"><input style={iStyle} type="number" step="any" value={leg.strike || ""} onChange={e => upd(i, "strike", parseFloat(e.target.value) || 0)} /></Field>
            <Field label="Expiration"><input style={iStyle} type="date" value={leg.expiration} onChange={e => upd(i, "expiration", e.target.value)} /></Field>
            <Field label="Premium (per share)"><input style={iStyle} type="number" step="any" value={leg.premium || ""} onChange={e => upd(i, "premium", parseFloat(e.target.value) || 0)} /></Field>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 16, padding: "12px 16px", background: "#f0f1f3", borderRadius: 8, border: "1px solid #1e2128", marginBottom: 16 }}>
        <div><div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1, marginBottom: 3 }}>NET PREMIUM</div><div style={{ fontSize: 14, color: m.netPremium <= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{m.netPremium <= 0 ? "+" : ""}{fmt$(Math.abs(m.netPremium))} {m.netPremium <= 0 ? "credit" : "debit"}</div></div>
        {m.maxProfit != null && <div><div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1, marginBottom: 3 }}>MAX PROFIT</div><div style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>{fmt$(m.maxProfit)}</div></div>}
        {m.maxLoss != null && <div><div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1, marginBottom: 3 }}>MAX LOSS</div><div style={{ fontSize: 14, color: "#dc2626", fontWeight: 600 }}>{fmt$(m.maxLoss)}</div></div>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "none", border: "1px solid #2a2d35", color: "#3a3f4c", borderRadius: 6, padding: "9px 0", fontSize: 12, cursor: "pointer" }}>BACK</button>
        <button onClick={() => onSave(legs, m)} style={{ flex: 2, background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>SAVE STRATEGY</button>
      </div>
    </div>
  );
}

const BLANK: Omit<TradeEntry, "id"> = { status: "Open", assetClass: "Equity", ticker: "", description: "", direction: "Long", units: 1, entryPrice: 0, exitPrice: null, entryDate: new Date().toISOString().slice(0, 10), exitDate: null, glDollar: null, notes: "", thesis: "" };

export default function BlotterTab({ data, onChange }: { data: DBData; onChange: (d: DBData) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<TradeEntry, "id">>(BLANK);
  const [strategyStep, setStrategyStep] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>("Call Spread");
  const [filter, setFilter] = useState<"All"|"Open"|"Closed">("All");
  const [classFilter, setClassFilter] = useState<AssetClass|"Strategy"|"All">("All");
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeGL, setCloseGL] = useState(""), [closeDate, setCloseDate] = useState(new Date().toISOString().slice(0, 10));
  const blotter = data.blotter ?? [];
  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }
  const canBuildStrategy = !!form.ticker.trim() && form.units > 0;

  function openStrategyBuilder() {
    if (!canBuildStrategy) return;
    setStrategyStep(true);
  }

  function save() {
    if (editing !== null) onChange({ ...data, blotter: blotter.map(t => t.id === editing ? { ...form, id: editing } : t) });
    else onChange({ ...data, blotter: [{ ...form, id: Date.now() }, ...blotter] });
    setOpen(false); setEditing(null); setForm(BLANK); setStrategyStep(false);
  }

  function saveStrategy(legs: OptionLeg[], m: { netPremium: number; maxProfit: number | null; maxLoss: number | null }) {
    const c = form.units;
    const entry: TradeEntry = { ...form, id: editing ?? Date.now(), assetClass: "Options", isStrategy: true, strategyType: selectedStrategy, legs, contracts: c, netPremium: m.netPremium, maxProfit: m.maxProfit, maxLoss: m.maxLoss, description: form.description || `${selectedStrategy} — ${form.ticker}`, entryPrice: Math.abs(m.netPremium / (c * 100)) };
    if (editing !== null) onChange({ ...data, blotter: blotter.map(t => t.id === editing ? entry : t) });
    else onChange({ ...data, blotter: [entry, ...blotter] });
    setOpen(false); setEditing(null); setForm(BLANK); setStrategyStep(false);
  }

  function closeTrade(id: number) {
    const gl = parseFloat(closeGL);
    if (isNaN(gl)) return;
    onChange({ ...data, blotter: blotter.map(t => t.id !== id ? t : { ...t, status: "Closed", exitDate: closeDate, glDollar: gl }) });
    setClosingId(null); setCloseGL(""); setCloseDate(new Date().toISOString().slice(0, 10));
  }

  function editTrade(t: TradeEntry) { const { id, ...rest } = t; setForm(rest); setEditing(id); if (t.isStrategy && t.strategyType) { setSelectedStrategy(t.strategyType); setStrategyStep(true); } setOpen(true); }

  const filtered = blotter.filter(t => {
    if (filter !== "All" && t.status !== filter) return false;
    if (classFilter === "Strategy" && !t.isStrategy) return false;
    if (classFilter !== "All" && classFilter !== "Strategy" && (t.assetClass !== classFilter || t.isStrategy)) return false;
    return true;
  });

  const th: React.CSSProperties = { padding: "7px 12px", color: "#4a5060", fontWeight: 400, textAlign: "left" as const, fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" as const };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 12, whiteSpace: "nowrap" as const, fontFamily: "'DM Mono', monospace" };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" as const }}>
        <button onClick={() => { setForm(BLANK); setEditing(null); setStrategyStep(false); setOpen(true); }} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>+ NEW TRADE</button>
        <div style={{ display: "flex", gap: 2, background: "#e2e4e8", borderRadius: 6, border: "1px solid #1e2128", padding: 3 }}>
          {(["All","Open","Closed"] as const).map(f => <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "#c4c7ce" : "none", border: "none", color: filter === f ? "#0d0f14" : "#4a5060", borderRadius: 4, padding: "5px 12px", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>{f.toUpperCase()}</button>)}
        </div>
        <div style={{ display: "flex", gap: 2, background: "#e2e4e8", borderRadius: 6, border: "1px solid #1e2128", padding: 3 }}>
          <button onClick={() => setClassFilter("All")} style={{ background: classFilter === "All" ? "#c4c7ce" : "none", border: "none", color: classFilter === "All" ? "#0d0f14" : "#4a5060", borderRadius: 4, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>ALL</button>
          <button onClick={() => setClassFilter("Strategy")} style={{ background: classFilter === "Strategy" ? "#c4c7ce" : "none", border: "none", color: classFilter === "Strategy" ? "#a21caf" : "#4a5060", borderRadius: 4, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>STRATEGY</button>
          {ASSET_CLASSES.map(ac => <button key={ac} onClick={() => setClassFilter(ac)} style={{ background: classFilter === ac ? "#c4c7ce" : "none", border: "none", color: classFilter === ac ? ASSET_COLOR[ac] : "#4a5060", borderRadius: 4, padding: "5px 8px", fontSize: 10, cursor: "pointer" }}>{ac.toUpperCase()}</button>)}
        </div>
        <span style={{ fontSize: 11, color: "#5a6070", marginLeft: "auto" }}>{filtered.length} trade{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ overflowX: "auto", background: "#f0f1f3", borderRadius: 8, border: "1px solid #1e2128" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>
            {["STATUS","TYPE","TICKER","DESCRIPTION","DIR","SIZE","ENTRY / NET PREM","MAX PROFIT","MAX LOSS","ENTRY DATE","EXIT DATE","G/L $",""].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={13} style={{ ...td, textAlign: "center", padding: 48, color: "#b0b3bc", letterSpacing: 2 }}>NO TRADES</td></tr>}
            {filtered.map(t => {
              const gl = t.status === "Closed" ? t.glDollar : null;
              const isStrat = t.isStrategy;
              return <tr key={t.id} style={{ borderBottom: "1px solid #0f1117" }}>
                <td style={td}><span style={{ fontSize: 10, color: t.status === "Open" ? "#16a34a" : "#3a3f4c", border: `1px solid ${t.status === "Open" ? "#16a34a40" : "#b0b3bc60"}`, borderRadius: 3, padding: "2px 7px" }}>{t.status.toUpperCase()}</span></td>
                <td style={td}>{isStrat ? <span style={{ fontSize: 10, color: "#a21caf" }}>{t.strategyType?.toUpperCase()}</span> : <span style={{ fontSize: 10, color: ASSET_COLOR[t.assetClass] }}>{t.assetClass.toUpperCase()}</span>}</td>
                <td style={{ ...td, color: "#0d0f14", fontWeight: 600 }}>{t.ticker}</td>
                <td style={{ ...td, color: "#3a3f4c", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || "—"}</td>
                <td style={{ ...td, color: t.direction === "Long" ? "#16a34a" : "#dc2626" }}>{isStrat ? "—" : (t.direction === "Long" ? "L" : "S")}</td>
                <td style={{ ...td, color: "#2a2f3c" }}>{isStrat ? `${t.contracts}x` : t.units}</td>
                <td style={{ ...td, color: isStrat ? (t.netPremium != null && t.netPremium <= 0 ? "#16a34a" : "#dc2626") : "#2a2f3c" }}>{isStrat ? (t.netPremium != null ? `${t.netPremium <= 0 ? "+" : ""}${fmt$(Math.abs(t.netPremium))} ${t.netPremium <= 0 ? "cr" : "db"}` : "—") : `$${t.entryPrice.toFixed(2)}`}</td>
                <td style={{ ...td, color: "#16a34a" }}>{isStrat ? fmt$(t.maxProfit) : "—"}</td>
                <td style={{ ...td, color: "#dc2626" }}>{isStrat ? fmt$(t.maxLoss) : "—"}</td>
                <td style={{ ...td, color: "#3a3f4c" }}>{t.entryDate || "—"}</td>
                <td style={{ ...td, color: "#3a3f4c" }}>{t.exitDate || "—"}</td>
                <td style={{ ...td, color: glColor(gl), fontWeight: 600 }}>{t.status === "Open" ? <span style={{ color: "#5a6070", fontSize: 10 }}>open</span> : fmt$(gl)}</td>
                <td style={td}><div style={{ display: "flex", gap: 6 }}>
                  {t.status === "Open" && <button onClick={() => { setClosingId(t.id); setCloseGL(""); setCloseDate(new Date().toISOString().slice(0, 10)); }} style={{ background: "#dcf0dc", border: "1px solid #2a4a2a", color: "#16a34a", borderRadius: 4, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>CLOSE</button>}
                  <button onClick={() => editTrade(t)} style={{ background: "none", border: "1px solid #2a2d35", color: "#3a3f4c", borderRadius: 4, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>EDIT</button>
                  <button onClick={() => onChange({ ...data, blotter: blotter.filter(x => x.id !== t.id) })} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 15 }}>✕</button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={editing !== null ? "Edit Trade" : "New Trade"} onClose={() => { setOpen(false); setEditing(null); setStrategyStep(false); }}>
          {strategyStep && form.ticker ? (
            <StrategyForm ticker={form.ticker} strategyType={selectedStrategy} contracts={form.units} entryDate={form.entryDate} onSave={saveStrategy} onCancel={() => setStrategyStep(false)} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label="Asset Class"><select style={iStyle} value={form.assetClass} onChange={e => set("assetClass", e.target.value)}>{ASSET_CLASSES.map(ac => <option key={ac}>{ac}</option>)}</select></Field>
                <Field label="Direction"><select style={iStyle} value={form.direction} onChange={e => set("direction", e.target.value)}><option>Long</option><option>Short</option></select></Field>
                <Field label="Status"><select style={iStyle} value={form.status} onChange={e => set("status", e.target.value)}><option>Open</option><option>Closed</option></select></Field>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label="Ticker"><input style={iStyle} value={form.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="AAPL, ES, EUR/USD..." /></Field>
                <Field label="Description"><input style={iStyle} value={form.description} onChange={e => set("description", e.target.value)} placeholder="optional label" /></Field>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label="Units / Contracts"><input style={iStyle} type="number" step="any" value={form.units} onChange={e => set("units", parseFloat(e.target.value) || 0)} /></Field>
                <Field label="Entry Price"><input style={iStyle} type="number" step="any" value={form.entryPrice} onChange={e => set("entryPrice", parseFloat(e.target.value) || 0)} /></Field>
                <Field label="Entry Date"><input style={iStyle} type="date" value={form.entryDate} onChange={e => set("entryDate", e.target.value)} /></Field>
              </div>
              {form.assetClass === "Options" && <>
                <div style={{ borderTop: "1px solid #1e2128", paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 1.5, marginBottom: 10 }}>SINGLE LEG</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Field label="P/C"><select style={iStyle} value={form.pc ?? "C"} onChange={e => set("pc", e.target.value)}><option>C</option><option>P</option></select></Field>
                    <Field label="Strike"><input style={iStyle} type="number" step="any" value={form.strike ?? ""} onChange={e => set("strike", parseFloat(e.target.value))} /></Field>
                    <Field label="Expiration"><input style={iStyle} type="date" value={form.expiration ?? ""} onChange={e => set("expiration", e.target.value)} /></Field>
                    <Field label="Eq Price at Entry"><input style={iStyle} type="number" step="any" value={form.eqEntryPrice ?? ""} onChange={e => set("eqEntryPrice", parseFloat(e.target.value))} placeholder="underlying at fill" /></Field>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #1e2128", paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "#a21caf", letterSpacing: 1.5, marginBottom: 10 }}>MULTI-LEG STRATEGY</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <Field label="Strategy Type"><select style={iStyle} value={selectedStrategy} onChange={e => { setSelectedStrategy(e.target.value as StrategyType); if (form.ticker.trim() && form.units > 0) setStrategyStep(true); }}>{STRATEGIES.map(s => <option key={s}>{s}</option>)}</select></Field>
                    <div style={{ marginBottom: 12 }}><button type="button" onClick={openStrategyBuilder} disabled={!canBuildStrategy} style={{ background: "#f0eaf8", border: "1px solid #5a3a7a", color: "#a21caf", borderRadius: 6, padding: "8px 16px", fontSize: 11, fontWeight: 600, cursor: canBuildStrategy ? "pointer" : "not-allowed", letterSpacing: 1, opacity: canBuildStrategy ? 1 : 0.4 }}>BUILD LEGS →</button></div>
                  </div>
                </div>
              </>}
              {form.assetClass === "Futures" && <div style={{ borderTop: "1px solid #1e2128", paddingTop: 12, marginTop: 4 }}><div style={{ fontSize: 10, color: "#2563eb", letterSpacing: 1.5, marginBottom: 10 }}>FUTURES</div><Field label="Contract Multiplier"><input style={iStyle} type="number" step="any" value={form.contractMultiplier ?? ""} onChange={e => set("contractMultiplier", parseFloat(e.target.value))} placeholder="e.g. 50 for ES" /></Field></div>}
              {form.assetClass === "Forex" && <div style={{ borderTop: "1px solid #1e2128", paddingTop: 12, marginTop: 4 }}><div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: 1.5, marginBottom: 10 }}>FOREX</div><div style={{ display: "flex", gap: 10 }}><Field label="Pip Value ($)"><input style={iStyle} type="number" step="any" value={form.pipValue ?? ""} onChange={e => set("pipValue", parseFloat(e.target.value))} /></Field><Field label="Lot Size"><input style={iStyle} type="number" step="any" value={form.lotSize ?? ""} onChange={e => set("lotSize", parseFloat(e.target.value))} /></Field></div></div>}
              {form.status === "Closed" && <div style={{ borderTop: "1px solid #1e2128", paddingTop: 12, marginTop: 4 }}><div style={{ fontSize: 10, color: "#3a3f4c", letterSpacing: 1.5, marginBottom: 10 }}>CLOSE</div><div style={{ display: "flex", gap: 10 }}><Field label="Exit Date"><input style={iStyle} type="date" value={form.exitDate ?? ""} onChange={e => set("exitDate", e.target.value)} /></Field><Field label="G/L $ (realized)"><input style={iStyle} type="number" step="any" value={form.glDollar ?? ""} onChange={e => set("glDollar", parseFloat(e.target.value))} placeholder="actual P&L" /></Field></div></div>}
              <Field label="Notes"><textarea style={taStyle} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Setup, rationale, outcome..." /></Field>
              <Field label="Thesis Link"><input style={iStyle} value={form.thesis} onChange={e => set("thesis", e.target.value)} placeholder="https://..." /></Field>
              <button onClick={save} style={{ background: "#a07828", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "9px 0", width: "100%", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8 }}>{editing !== null ? "SAVE CHANGES" : "ADD TRADE"}</button>
            </>
          )}
        </Modal>
      )}

      {closingId !== null && (() => {
        const t = blotter.find(x => x.id === closingId)!;
        const glNum = parseFloat(closeGL);
        return (
          <Modal title={`Close — ${t.isStrategy ? t.strategyType : t.ticker}`} onClose={() => setClosingId(null)}>
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f0f1f3", borderRadius: 6, fontSize: 11, color: "#2a2f3c" }}>
              {t.isStrategy ? `${t.strategyType} · ${t.contracts} contract${(t.contracts ?? 1) > 1 ? "s" : ""} · Net prem ${fmt$(t.netPremium)} · entered ${t.entryDate || "—"}` : `${t.direction} · ${t.assetClass} · ${t.units} @ $${t.entryPrice.toFixed(2)} · entered ${t.entryDate || "—"}`}
            </div>
            {t.isStrategy && t.maxProfit != null && <div style={{ display: "flex", gap: 20, marginBottom: 16, fontSize: 12 }}><span style={{ color: "#16a34a" }}>Max profit: {fmt$(t.maxProfit)}</span><span style={{ color: "#dc2626" }}>Max loss: {fmt$(t.maxLoss)}</span></div>}
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Exit Date"><input style={iStyle} type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} /></Field>
              <Field label="Realized G/L ($)"><input style={iStyle} type="number" step="any" autoFocus value={closeGL} onChange={e => setCloseGL(e.target.value)} placeholder="actual P&L — always manual" /></Field>
            </div>
            {!isNaN(glNum) && closeGL !== "" && <div style={{ marginBottom: 12, fontSize: 14, color: glColor(glNum), fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{glNum >= 0 ? "+" : ""}{fmt$(glNum)}</div>}
            <button onClick={() => closeTrade(closingId)} disabled={closeGL === "" || isNaN(parseFloat(closeGL))} style={{ background: "#16a34a", color: "#f0f1f3", border: "none", borderRadius: 6, padding: "9px 0", width: "100%", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, opacity: closeGL && !isNaN(parseFloat(closeGL)) ? 1 : 0.4 }}>MARK CLOSED</button>
          </Modal>
        );
      })()}
    </div>
  );
}
