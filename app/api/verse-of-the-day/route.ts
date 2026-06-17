import { NextResponse } from "next/server";

const FALLBACK_VERSE = {
  reference: "Psalm 46:10",
  text: "Be still, and know that I am God.",
  permalink: "https://www.biblegateway.com/passage/?search=Psalm%2046%3A10&version=ESV",
  version: "English Standard Version",
  source: "fallback",
};

function decodeHtml(value: string) {
  return value
    .replace(/&ldquo;|&rdquo;/g, "\"")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .trim();
}

export async function GET() {
  try {
    const response = await fetch("https://www.biblegateway.com/votd/get/?format=json&version=ESV", {
      headers: {
        "User-Agent": "HogansPlayground/1.0",
        "Accept": "application/json",
      },
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) throw new Error(`BibleGateway returned ${response.status}`);
    const payload = await response.json();
    const votd = payload?.votd;
    if (!votd?.text || !votd?.display_ref) throw new Error("Verse payload missing expected fields");

    return NextResponse.json({
      reference: String(votd.display_ref),
      text: decodeHtml(String(votd.text)),
      permalink: String(votd.permalink || ""),
      version: String(votd.version || "English Standard Version"),
      source: "BibleGateway",
    });
  } catch {
    return NextResponse.json(FALLBACK_VERSE);
  }
}
