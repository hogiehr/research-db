import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const tickers = new URL(req.url).searchParams.get("tickers")?.split(",").filter(Boolean) ?? [];
  const results: Record<string, number | null> = {};
  await Promise.all(tickers.map(async t => {
    try { const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`, { next: { revalidate: 60 } }); const d = await r.json(); results[t] = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null; } catch { results[t] = null; }
  }));
  return NextResponse.json(results);
}
