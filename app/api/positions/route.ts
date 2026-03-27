import { NextResponse } from "next/server";
import { getData } from "@/lib/db";
export async function GET() {
  const data = await getData();
  const open = data.blotter.filter(t => t.status === "Open");
  return NextResponse.json({
    equityPositions: open.filter(t => (t.assetClass === "Equity" || t.assetClass === "Crypto") && !t.isStrategy).map(t => ({ ticker: t.ticker, status: t.status, assetClass: t.assetClass, direction: t.direction, units: t.units, entryPrice: t.entryPrice, entryDate: t.entryDate, description: t.description, notes: t.notes })),
    optionsPositions: open.filter(t => t.assetClass === "Options" && !t.isStrategy).map(t => ({ ticker: t.ticker, status: t.status, direction: t.direction, units: t.units, entryPrice: t.entryPrice, pc: t.pc, strike: t.strike, expiration: t.expiration, entryDate: t.entryDate, description: t.description })),
    strategies: open.filter(t => t.isStrategy).map(t => ({ ticker: t.ticker, status: t.status, strategyType: t.strategyType, contracts: t.contracts, description: t.description, netPremium: t.netPremium, entryDate: t.entryDate })),
    otherPositions: open.filter(t => !["Equity","Crypto","Options"].includes(t.assetClass)).map(t => ({ ticker: t.ticker, status: t.status, assetClass: t.assetClass, direction: t.direction, units: t.units, entryPrice: t.entryPrice, entryDate: t.entryDate, description: t.description })),
  });
}
