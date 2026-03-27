import { kv } from "@vercel/kv";

export type ResearchEntry = {
  id: number;
  [key: string]: unknown;
};

export type AssetClass = "Equity" | "Options" | "Futures" | "Forex" | "Fixed Income" | "Crypto";

export type StrategyType =
  | "Call Spread" | "Put Spread" | "Iron Condor"
  | "Straddle" | "Strangle" | "Covered Call"
  | "Cash Secured Put" | "Calendar Spread" | "Risk Reversal";

export type OptionLeg = {
  role: string;        // e.g. "Long Call", "Short Put"
  pc: "C" | "P";
  strike: number;
  expiration: string;
  premium: number;     // per share
  contracts: number;
  direction: "Long" | "Short";
};

export type TradeEntry = {
  id: number;
  status: "Open" | "Closed";
  assetClass: AssetClass;
  ticker: string;
  description: string;
  direction: "Long" | "Short";
  units: number;
  entryPrice: number;
  exitPrice: number | null;
  entryDate: string;
  exitDate: string | null;
  glDollar: number | null;      // always manual on close
  notes: string;
  thesis: string;
  // Single-leg options
  pc?: "C" | "P";
  strike?: number;
  expiration?: string;
  eqEntryPrice?: number;
  // Futures
  contractMultiplier?: number;
  // Forex
  pipValue?: number;
  lotSize?: number;
  // Multi-leg strategy
  isStrategy?: boolean;
  strategyType?: StrategyType;
  legs?: OptionLeg[];
  netPremium?: number;    // net debit (positive) or credit (negative) per spread × contracts
  maxProfit?: number | null;
  maxLoss?: number | null;
  contracts?: number;     // number of spreads/strategies
};

export type Settings = {
  equityBaseline: number;
  optionsBaseline: number;
  futuresBaseline: number;
  forexBaseline: number;
};

export type DBData = {
  tradeIdeas: ResearchEntry[];
  thesis: ResearchEntry[];
  macro: ResearchEntry[];
  marketUpdates: ResearchEntry[];
  blotter: TradeEntry[];
  settings: Settings;
};

const DEFAULT_DATA: DBData = {
  tradeIdeas: [], thesis: [], macro: [], marketUpdates: [],
  blotter: [
    { id: 1,  status: "Open", assetClass: "Equity", ticker: "DRI",  description: "", direction: "Long", units: 4,  entryPrice: 218.65, exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 2,  status: "Open", assetClass: "Equity", ticker: "SCVL", description: "", direction: "Long", units: 30, entryPrice: 20.38,  exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 3,  status: "Open", assetClass: "Equity", ticker: "RBRK", description: "", direction: "Long", units: 12, entryPrice: 54.13,  exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 4,  status: "Open", assetClass: "Equity", ticker: "ZM",   description: "", direction: "Long", units: 10, entryPrice: 91.74,  exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 5,  status: "Open", assetClass: "Equity", ticker: "SE",   description: "", direction: "Long", units: 10, entryPrice: 109.32, exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 6,  status: "Open", assetClass: "Equity", ticker: "XPEV", description: "", direction: "Long", units: 30, entryPrice: 18.42,  exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "" },
    { id: 7,  status: "Open", assetClass: "Options", ticker: "AMZN", description: "AMZN 215C Apr26", direction: "Long", units: 1, entryPrice: 5.39, exitPrice: null, entryDate: "", exitDate: null, glDollar: null, notes: "", thesis: "", pc: "C", strike: 215, expiration: "2026-04-17", eqEntryPrice: 208.595 },
  ],
  settings: { equityBaseline: 900, optionsBaseline: 600, futuresBaseline: 1000, forexBaseline: 1000 },
};

const KEY = "rdb:data";

export async function getData(): Promise<DBData> {
  const val = await kv.get<DBData>(KEY);
  if (!val) { await kv.set(KEY, DEFAULT_DATA); return DEFAULT_DATA; }
  if (!val.blotter) val.blotter = [];
  if (!val.settings) val.settings = { equityBaseline: 900, optionsBaseline: 600, futuresBaseline: 1000, forexBaseline: 1000 };
  if (!val.settings.futuresBaseline) { val.settings.futuresBaseline = 1000; val.settings.forexBaseline = 1000; }
  return val;
}

export async function setData(data: DBData): Promise<void> {
  await kv.set(KEY, data);
}
