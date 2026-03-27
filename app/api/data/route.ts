import { NextResponse } from "next/server";
import { getData, setData, DBData } from "@/lib/db";
export async function GET() { return NextResponse.json(await getData()); }
export async function POST(req: Request) { await setData(await req.json() as DBData); return NextResponse.json({ ok: true }); }
