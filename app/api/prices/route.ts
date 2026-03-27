import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tickers = searchParams.get("tickers")?.split(",").filter(Boolean) ?? [];

  const results: Record<string, number | null> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          { next: { revalidate: 60 } }
        );
        const d = await r.json();
        results[ticker] = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
      } catch {
        results[ticker] = null;
      }
    })
  );

  return NextResponse.json(results);
}
