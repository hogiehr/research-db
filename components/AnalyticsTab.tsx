"use client";
import { TradeEntry, AssetClass, DBData } from "@/lib/db";
import { computeGL, fmt$, glColor, ASSET_COLOR, ASSET_CLASSES } from "./BlotterTab";

type Term = "ST" | "MT" | "LT";

function classifyTerm(t: TradeEntry): Term {
  const entryDate = t.entryDate ? new Date(t.entryDate) : null;
  const exitDate = t.exitDate ? new Date(t.exitDate) : new Date();
  if (!entryDate) return "ST";
  const days = Math.round((exitDate.getTime() - entryDate.getTime()) / 86400000);
  if (days < 30) return "ST";
  if (days < 180) return "MT";
  return "LT";
}

function holdDays(t: TradeEntry): number | null {
  if (!t.entryDate || !t.exitDate) return null;
  return Math.round((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 86400000);
}

type Stats = { total: number; wins: number; losses: number; winRate: number | null; avgWin: number | null; avgLoss: number | null; profitFactor: number | null; totalGL: number; avgHold: number | null };

function calcStats(trades: TradeEntry[]): Stats {
  const closed = trades.filter(t => t.status === "Closed");
  const withGL = closed.map(t => ({ t, gl: computeGL(t) })).filter(x => x.gl != null) as { t: TradeEntry; gl: number }[];
  const wins = withGL.filter(x => x.gl > 0);
  const losses = withGL.filter(x => x.gl < 0);
  const avgWin = wins.length ? wins.reduce((s, x) => s + x.gl, 0) / wins.length : null;
  const avgLoss = losses.length ? losses.reduce((s, x) => s + x.gl, 0) / losses.length : null;
  const grossWin = wins.reduce((s, x) => s + x.gl, 0);
  const grossLoss = Math.abs(losses.reduce((s, x) => s + x.gl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null;
  const holds = closed.map(t => holdDays(t)).filter((d): d is number => d != null);
  return {
    total: closed.length, wins: wins.length, losses: losses.length,
    winRate: withGL.length ? wins.length / withGL.length : null,
    avgWin, avgLoss, profitFactor,
    totalGL: withGL.reduce((s, x) => s + x.gl, 0),
    avgHold: holds.length ? holds.reduce((s, d) => s + d, 0) / holds.length : null,
  };
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: "16px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, color: "#4a5060", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 20, color: color ?? "#0d0f14", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a5060", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "#c4c7ce" }}>
        <div style={{ width: `${winPct}%`, background: "#16a34a" }} />
        <div style={{ width: `${100 - winPct - lossPct}%`, background: "#b0b3bc" }} />
        <div style={{ width: `${lossPct}%`, background: "#dc2626" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#4a5060" }}>
        <span style={{ color: "#16a34a" }}>{wins}W</span>
        <span style={{ color: "#dc2626" }}>{losses}L</span>
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: TradeEntry }) {
  const gl = computeGL(t);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f1117" }}>
      <div>
        <span style={{ fontSize: 14, color: "#0d0f14", fontWeight: 600 }}>{t.ticker}</span>
        <span style={{ fontSize: 11, color: "#4a5060", marginLeft: 8 }}>{t.assetClass}</span>
        {t.description && <span style={{ fontSize: 11, color: "#5a6070", marginLeft: 6 }}>{t.description}</span>}
        <div style={{ fontSize: 11, color: "#4a5060", marginTop: 2 }}>{t.entryDate}{t.exitDate ? ` → ${t.exitDate}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" as const }}>
        <div style={{ fontSize: 15, color: glColor(gl), fontWeight: 600 }}>{gl != null ? (gl >= 0 ? "+" : "") + fmt$(gl) : "—"}</div>
        <div style={{ fontSize: 10, color: "#4a5060" }}>{t.direction} · {t.units} units</div>
      </div>
    </div>
  );
}

function StatsRow({ label, s, color }: { label: string; s: Stats; color: string }) {
  const pf = s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2) + "x";
  if (s.total === 0) return null;
  return (
    <tr style={{ borderBottom: "1px solid #0f1117" }}>
      <td style={{ padding: "9px 12px", fontSize: 11 }}><span style={{ color, fontWeight: 600, letterSpacing: 1 }}>{label}</span></td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: "#2a2f3c" }}>{s.total}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.winRate != null ? s.winRate - 0.5 : null) }}>{s.winRate != null ? (s.winRate * 100).toFixed(0) + "%" : "—"}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: "#16a34a" }}>{fmt$(s.avgWin)}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: "#dc2626" }}>{fmt$(s.avgLoss)}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: s.profitFactor != null && s.profitFactor >= 1 ? "#16a34a" : "#dc2626" }}>{pf}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.totalGL), fontWeight: 600 }}>{fmt$(s.totalGL)}</td>
      <td style={{ padding: "9px 12px", fontSize: 12, color: "#3a3f4c" }}>{s.avgHold != null ? `${Math.round(s.avgHold)}d` : "—"}</td>
    </tr>
  );
}

const TERM_COLOR: Record<Term, string> = { ST: "#2563eb", MT: "#a07828", LT: "#7c3aed" };
const TERM_LABEL: Record<Term, string> = { ST: "SHORT TERM (<1mo)", MT: "MED TERM (<6mo)", LT: "LONG TERM (6mo+)" };

export default function AnalyticsTab({ data }: { data: DBData }) {
  const blotter = data.blotter ?? [];
  const closed = blotter.filter(t => t.status === "Closed");
  const overall = calcStats(blotter);

  if (closed.length === 0) return <div style={{ textAlign: "center", padding: 80, color: "#b0b3bc", fontSize: 12, letterSpacing: 2 }}>NO CLOSED TRADES YET</div>;

  const byClass: Record<string, Stats> = {};
  for (const ac of ASSET_CLASSES) { const trades = blotter.filter(t => t.assetClass === ac); if (trades.some(t => t.status === "Closed")) byClass[ac] = calcStats(trades); }

  const byTerm: Record<Term, Stats> = {
    ST: calcStats(blotter.filter(t => classifyTerm(t) === "ST")),
    MT: calcStats(blotter.filter(t => classifyTerm(t) === "MT")),
    LT: calcStats(blotter.filter(t => classifyTerm(t) === "LT")),
  };

  const pfDisplay = overall.profitFactor == null ? "—" : overall.profitFactor === Infinity ? "∞" : overall.profitFactor.toFixed(2) + "x";
  const tableHeaders = ["CLASS","TRADES","WIN%","AVG WIN","AVG LOSS","P.F.","TOTAL GL","AVG HOLD"];
  const thStyle = { padding: "8px 12px", color: "#4a5060", fontWeight: 400, fontSize: 10, letterSpacing: 1, textAlign: "left" as const };

  return (
    <div>
      {/* Overall headline */}
      <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 14 }}>OVERALL — {overall.total} CLOSED TRADES</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 16 }}>
        <StatCard label="Win Rate" value={overall.winRate != null ? (overall.winRate * 100).toFixed(1) + "%" : "—"} color={glColor(overall.winRate != null ? overall.winRate - 0.5 : null)} sub={`${overall.wins}W / ${overall.losses}L`} />
        <StatCard label="Total G/L" value={fmt$(overall.totalGL)} color={glColor(overall.totalGL)} />
        <StatCard label="Profit Factor" value={pfDisplay} color={overall.profitFactor != null && overall.profitFactor >= 1 ? "#16a34a" : "#dc2626"} sub="gross win / gross loss" />
        <StatCard label="Avg Win" value={fmt$(overall.avgWin)} color="#16a34a" />
        <StatCard label="Avg Loss" value={fmt$(overall.avgLoss)} color="#dc2626" />
        <StatCard label="Avg Hold" value={overall.avgHold != null ? `${Math.round(overall.avgHold)}d` : "—"} color="#2a2f3c" />
      </div>
      <WinRateBar wins={overall.wins} losses={overall.losses} />

      {/* By term + by class side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 28 }}>

        {/* BY TERM */}
        <div>
          <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 14 }}>BY TERM</div>
          <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>{tableHeaders.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                <StatsRow label="ST" s={byTerm.ST} color={TERM_COLOR.ST} />
                <StatsRow label="MT" s={byTerm.MT} color={TERM_COLOR.MT} />
                <StatsRow label="LT" s={byTerm.LT} color={TERM_COLOR.LT} />
              </tbody>
            </table>
          </div>
          {/* Term breakdown cards */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {(["ST", "MT", "LT"] as Term[]).map(term => {
              const s = byTerm[term];
              if (s.total === 0) return null;
              return (
                <div key={term} style={{ background: "#f0f1f3", border: `1px solid ${TERM_COLOR[term]}25`, borderLeft: `3px solid ${TERM_COLOR[term]}`, borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: TERM_COLOR[term], letterSpacing: 1.5 }}>{TERM_LABEL[term]}</span>
                    <span style={{ fontSize: 11, color: glColor(s.totalGL), fontWeight: 600 }}>{fmt$(s.totalGL)}</span>
                  </div>
                  <WinRateBar wins={s.wins} losses={s.losses} />
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: "#3a3f4c" }}>{s.total} trades</span>
                    <span style={{ color: s.winRate != null && s.winRate >= 0.5 ? "#16a34a" : "#dc2626" }}>{s.winRate != null ? (s.winRate * 100).toFixed(0) + "% win" : "—"}</span>
                    {s.avgHold != null && <span style={{ color: "#3a3f4c" }}>avg {Math.round(s.avgHold)}d</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BY ASSET CLASS + best/worst */}
        <div>
          <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 14 }}>BY ASSET CLASS</div>
          <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid #1e2128" }}>{tableHeaders.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(byClass).map(([ac, s]) => {
                  const pf = s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2) + "x";
                  return <tr key={ac} style={{ borderBottom: "1px solid #0f1117" }}>
                    <td style={{ padding: "9px 12px", fontSize: 11 }}><span style={{ color: ASSET_COLOR[ac as AssetClass] }}>{ac.toUpperCase()}</span></td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "#2a2f3c" }}>{s.total}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.winRate != null ? s.winRate - 0.5 : null) }}>{s.winRate != null ? (s.winRate * 100).toFixed(0) + "%" : "—"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "#16a34a" }}>{fmt$(s.avgWin)}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "#dc2626" }}>{fmt$(s.avgLoss)}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: s.profitFactor != null && s.profitFactor >= 1 ? "#16a34a" : "#dc2626" }}>{pf}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.totalGL), fontWeight: 600 }}>{fmt$(s.totalGL)}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "#3a3f4c" }}>{s.avgHold != null ? `${Math.round(s.avgHold)}d` : "—"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 14 }}>BEST & WORST</div>
          <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: "6px 18px 4px" }}>
            <div style={{ fontSize: 10, color: "#16a34a", letterSpacing: 1.5, padding: "10px 0 4px" }}>TOP 3 WINNERS</div>
            {(() => { const s = [...closed].map(t => ({ t, gl: computeGL(t) })).filter(x => x.gl != null && x.gl > 0).sort((a, b) => b.gl! - a.gl!).slice(0, 3); return s.length === 0 ? <div style={{ fontSize: 11, color: "#5a6070", padding: "8px 0" }}>None yet</div> : s.map(({ t }) => <TradeRow key={t.id} t={t} />); })()}
            <div style={{ fontSize: 10, color: "#dc2626", letterSpacing: 1.5, padding: "14px 0 4px" }}>TOP 3 LOSERS</div>
            {(() => { const s = [...closed].map(t => ({ t, gl: computeGL(t) })).filter(x => x.gl != null && x.gl < 0).sort((a, b) => a.gl! - b.gl!).slice(0, 3); return s.length === 0 ? <div style={{ fontSize: 11, color: "#5a6070", padding: "8px 0 14px" }}>None yet</div> : s.map(({ t }) => <TradeRow key={t.id} t={t} />); })()}
          </div>
        </div>
      </div>

      {/* Cumulative G/L chart */}
      {(() => {
        const pts = closed.filter(t => t.exitDate).map(t => ({ date: t.exitDate!, gl: computeGL(t) ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
        if (pts.length < 2) return null;
        let running = 0;
        const points = pts.map(({ date, gl }) => { running += gl; return { date, gl, running }; });
        const min = Math.min(...points.map(p => p.running)), max = Math.max(...points.map(p => p.running)), range = max - min || 1;
        const W = 800, H = 120, PAD = 16;
        const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
        const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
        const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.running).toFixed(1)}`).join(" ");
        const areaD = `${pathD} L ${x(points.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
        const fc = points[points.length - 1].running >= 0 ? "#16a34a" : "#dc2626";
        return (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 10, color: "#a07828", letterSpacing: 2, marginBottom: 14 }}>CUMULATIVE G/L</div>
            <div style={{ background: "#f0f1f3", border: "1px solid #1e2128", borderRadius: 8, padding: "20px 20px 12px" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                <defs><linearGradient id="glGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fc} stopOpacity="0.2" /><stop offset="100%" stopColor={fc} stopOpacity="0" /></linearGradient></defs>
                {min < 0 && max > 0 && <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="#b0b3bc" strokeWidth="1" strokeDasharray="4 4" />}
                <path d={areaD} fill="url(#glGrad)" /><path d={pathD} fill="none" stroke={fc} strokeWidth="1.5" />
                {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.running)} r="2.5" fill={p.gl >= 0 ? "#16a34a" : "#dc2626"} />)}
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a6070", marginTop: 4 }}>
                <span>{points[0].date}</span>
                <span style={{ color: fc, fontSize: 12 }}>{points[points.length - 1].running >= 0 ? "+" : ""}{fmt$(points[points.length - 1].running)}</span>
                <span>{points[points.length - 1].date}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
