import { NextResponse } from "next/server";
import { getData, setData, DBData } from "@/lib/db";

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body: DBData = await req.json();
  await setData(body);
  return NextResponse.json({ ok: true });
}
