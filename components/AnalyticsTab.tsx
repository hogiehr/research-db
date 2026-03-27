"use client";

import { TradeEntry, AssetClass, DBData } from "@/lib/db";
import { computeGL, fmt$, glColor, ASSET_COLOR, ASSET_CLASSES } from "./BlotterTab";

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}

function holdDays(t: TradeEntry): number | null {
  if (!t.entryDate || !t.exitDate) return null;
  const ms = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
  return Math.round(ms / 86400000);
}

type Stats = {
  total: number; wins: number; losses: number; winRate: number | null;
  avgWin: number | null; avgLoss: number | null; profitFactor: number | null;
  totalGL: number; avgHold: number | null;
};

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
  const totalGL = withGL.reduce((s, x) => s + x.gl, 0);
  const holds = closed.map(t => holdDays(t)).filter((d): d is number => d != null);
  const avgHold = holds.length ? holds.reduce((s, d) => s + d, 0) / holds.length : null;
  return { total: closed.length, wins: wins.length, losses: losses.length, winRate: withGL.length ? wins.length / withGL.length : null, avgWin, avgLoss, profitFactor, totalGL, avgHold };
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, padding: "18px 20px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 22, color: color ?? "#e2e8f0", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "#1e2128" }}>
        <div style={{ width: `${winPct}%`, background: "#4ade80", transition: "width 0.4s" }} />
        <div style={{ width: `${100 - winPct - lossPct}%`, background: "#2a2d35" }} />
        <div style={{ width: `${lossPct}%`, background: "#f87171", transition: "width 0.4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "#444" }}>
        <span style={{ color: "#4ade80" }}>{wins}W</span>
        <span style={{ color: "#f87171" }}>{losses}L</span>
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: TradeEntry }) {
  const gl = computeGL(t);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f1117" }}>
      <div>
        <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>{t.ticker}</span>
        <span style={{ fontSize: 11, color: "#444", marginLeft: 8 }}>{t.assetClass}</span>
        {t.description && <span style={{ fontSize: 11, color: "#333", marginLeft: 6 }}>{t.description}</span>}
        <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{t.entryDate} {t.exitDate ? `→ ${t.exitDate}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" as const }}>
        <div style={{ fontSize: 16, color: glColor(gl), fontWeight: 600 }}>{gl != null ? (gl >= 0 ? "+" : "") + fmt$(gl) : "—"}</div>
        <div style={{ fontSize: 10, color: "#444" }}>{t.direction} · {t.units} units</div>
      </div>
    </div>
  );
}

type Props = { data: DBData };

export default function AnalyticsTab({ data }: Props) {
  const blotter = data.blotter ?? [];
  const overall = calcStats(blotter);

  if (blotter.filter(t => t.status === "Closed").length === 0) {
    return <div style={{ textAlign: "center", padding: 80, color: "#2a2d35", fontSize: 12, letterSpacing: 2 }}>NO CLOSED TRADES YET</div>;
  }

  const byClass: Record<string, Stats> = {};
  for (const ac of ASSET_CLASSES) {
    const trades = blotter.filter(t => t.assetClass === ac);
    if (trades.some(t => t.status === "Closed")) byClass[ac] = calcStats(trades);
  }

  const pfDisplay = overall.profitFactor == null ? "—" : overall.profitFactor === Infinity ? "∞" : overall.profitFactor.toFixed(2) + "x";

  return (
    <div>
      <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 14 }}>OVERALL — {overall.total} CLOSED TRADES</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 16 }}>
        <StatCard label="Win Rate" value={overall.winRate != null ? (overall.winRate * 100).toFixed(1) + "%" : "—"} color={glColor(overall.winRate != null ? overall.winRate - 0.5 : null)} sub={`${overall.wins}W / ${overall.losses}L`} />
        <StatCard label="Total G/L" value={fmt$(overall.totalGL)} color={glColor(overall.totalGL)} />
        <StatCard label="Profit Factor" value={pfDisplay} color={overall.profitFactor != null && overall.profitFactor >= 1 ? "#4ade80" : "#f87171"} sub="gross win / gross loss" />
        <StatCard label="Avg Win" value={fmt$(overall.avgWin)} color="#4ade80" />
        <StatCard label="Avg Loss" value={fmt$(overall.avgLoss)} color="#f87171" />
        <StatCard label="Avg Hold" value={overall.avgHold != null ? `${Math.round(overall.avgHold)}d` : "—"} color="#8b9299" />
      </div>
      <WinRateBar wins={overall.wins} losses={overall.losses} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 28 }}>
        <div>
          <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 14 }}>BY ASSET CLASS</div>
          <div style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e2128" }}>
                  {["CLASS","TRADES","WIN%","AVG WIN","AVG LOSS","P.F.","TOTAL GL"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", color: "#444", fontWeight: 400, fontSize: 10, letterSpacing: 1, textAlign: "left" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byClass).map(([ac, s]) => {
                  const pf = s.profitFactor == null ? "—" : s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2) + "x";
                  return (
                    <tr key={ac} style={{ borderBottom: "1px solid #0f1117" }}>
                      <td style={{ padding: "9px 12px", fontSize: 11 }}><span style={{ color: ASSET_COLOR[ac as AssetClass] }}>{ac.toUpperCase()}</span></td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "#8b9299" }}>{s.total}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.winRate != null ? s.winRate - 0.5 : null) }}>{s.winRate != null ? (s.winRate * 100).toFixed(0) + "%" : "—"}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "#4ade80" }}>{fmt$(s.avgWin)}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "#f87171" }}>{fmt$(s.avgLoss)}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: s.profitFactor != null && s.profitFactor >= 1 ? "#4ade80" : "#f87171" }}>{pf}</td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: glColor(s.totalGL), fontWeight: 600 }}>{fmt$(s.totalGL)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 14 }}>BEST & WORST</div>
          <div style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, padding: "6px 18px 4px" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 1.5, padding: "10px 0 4px" }}>TOP 3 WINNERS</div>
            {(() => {
              const sorted = [...blotter].filter(t => t.status === "Closed").map(t => ({ t, gl: computeGL(t) })).filter(x => x.gl != null && x.gl > 0).sort((a, b) => b.gl! - a.gl!).slice(0, 3);
              return sorted.length === 0 ? <div style={{ fontSize: 11, color: "#333", padding: "8px 0" }}>None yet</div> : sorted.map(({ t }) => <TradeRow key={t.id} t={t} />);
            })()}
            <div style={{ fontSize: 10, color: "#f87171", letterSpacing: 1.5, padding: "14px 0 4px" }}>TOP 3 LOSERS</div>
            {(() => {
              const sorted = [...blotter].filter(t => t.status === "Closed").map(t => ({ t, gl: computeGL(t) })).filter(x => x.gl != null && x.gl < 0).sort((a, b) => a.gl! - b.gl!).slice(0, 3);
              return sorted.length === 0 ? <div style={{ fontSize: 11, color: "#333", padding: "8px 0 14px" }}>None yet</div> : sorted.map(({ t }) => <TradeRow key={t.id} t={t} />);
            })()}
          </div>
        </div>
      </div>

      {(() => {
        const closed = blotter.filter(t => t.status === "Closed" && t.exitDate).map(t => ({ date: t.exitDate!, gl: computeGL(t) ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
        if (closed.length < 2) return null;
        let running = 0;
        const points = closed.map(({ date, gl }) => { running += gl; return { date, gl, running }; });
        const min = Math.min(...points.map(p => p.running));
        const max = Math.max(...points.map(p => p.running));
        const range = max - min || 1;
        const W = 800, H = 120, PAD = 16;
        const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
        const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
        const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.running).toFixed(1)}`).join(" ");
        const areaD = `${pathD} L ${x(points.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
        const finalColor = points[points.length - 1].running >= 0 ? "#4ade80" : "#f87171";
        return (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 14 }}>CUMULATIVE G/L</div>
            <div style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, padding: "20px 20px 12px" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                <defs><linearGradient id="glGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={finalColor} stopOpacity="0.2" /><stop offset="100%" stopColor={finalColor} stopOpacity="0" /></linearGradient></defs>
                {min < 0 && max > 0 && <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="#2a2d35" strokeWidth="1" strokeDasharray="4 4" />}
                <path d={areaD} fill="url(#glGrad)" />
                <path d={pathD} fill="none" stroke={finalColor} strokeWidth="1.5" />
                {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.running)} r="2.5" fill={p.gl >= 0 ? "#4ade80" : "#f87171"} />)}
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#333", marginTop: 4 }}>
                <span>{points[0].date}</span>
                <span style={{ color: finalColor, fontSize: 12 }}>{points[points.length - 1].running >= 0 ? "+" : ""}{fmt$(points[points.length - 1].running)}</span>
                <span>{points[points.length - 1].date}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
