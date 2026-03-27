import { kv } from "@vercel/kv";

export type ResearchEntry = { id: number; [key: string]: unknown };
export type AssetClass = "Equity" | "Options" | "Futures" | "Forex" | "Fixed Income" | "Crypto";
export type StrategyType = "Call Spread" | "Put Spread" | "Iron Condor" | "Straddle" | "Strangle" | "Covered Call" | "Cash Secured Put" | "Calendar Spread" | "Risk Reversal";

export type OptionLeg = {
  role: string; pc: "C" | "P"; strike: number; expiration: string;
  premium: number; contracts: number; direction: "Long" | "Short";
};

export type TradeEntry = {
  id: number; status: "Open" | "Closed"; assetClass: AssetClass;
  ticker: string; description: string; direction: "Long" | "Short";
  units: number; entryPrice: number; exitPrice: number | null;
  entryDate: string; exitDate: string | null; glDollar: number | null;
  notes: string; thesis: string;
  pc?: "C" | "P"; strike?: number; expiration?: string; eqEntryPrice?: number;
  contractMultiplier?: number; pipValue?: number; lotSize?: number;
  isStrategy?: boolean; strategyType?: StrategyType; legs?: OptionLeg[];
  netPremium?: number; maxProfit?: number | null; maxLoss?: number | null; contracts?: number;
};

export type Settings = {
  equityBaseline: number; optionsBaseline: number;
  futuresBaseline: number; forexBaseline: number;
};

export type DBData = {
  tradeIdeas: ResearchEntry[]; thesis: ResearchEntry[];
  macro: ResearchEntry[]; marketUpdates: ResearchEntry[];
  blotter: TradeEntry[]; settings: Settings;
};

const DEFAULT_DATA: DBData = {
  tradeIdeas: [], thesis: [], macro: [], marketUpdates: [], blotter: [],
  settings: { equityBaseline: 900, optionsBaseline: 600, futuresBaseline: 1000, forexBaseline: 1000 },
};

const KEY = "rdb:data";
const SEED_TICKERS = new Set(["DRI", "SCVL", "RBRK", "ZM", "SE", "XPEV"]);

export async function getData(): Promise<DBData> {
  const val = await kv.get<DBData>(KEY);
  if (!val) { await kv.set(KEY, DEFAULT_DATA); return DEFAULT_DATA; }
  if (!val.blotter) val.blotter = [];
  if (!val.settings) val.settings = { equityBaseline: 900, optionsBaseline: 600, futuresBaseline: 1000, forexBaseline: 1000 };
  if (!val.settings.futuresBaseline) { val.settings.futuresBaseline = 1000; val.settings.forexBaseline = 1000; }
  val.blotter = val.blotter.filter(t => !(SEED_TICKERS.has(t.ticker) && t.entryDate === ""));
  val.blotter = val.blotter.filter(t => !(t.ticker === "AMZN" && t.entryDate === "" && !t.isStrategy));
  return val;
}

export async function setData(data: DBData): Promise<void> {
  await kv.set(KEY, data);
}
