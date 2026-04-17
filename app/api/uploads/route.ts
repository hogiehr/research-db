import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

function sanitizeSegment(value: string, fallback: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
  return cleaned || fallback;
}

function sanitizeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folderValue = formData.get("folder");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const folder = sanitizeSegment(typeof folderValue === "string" ? folderValue : "uploads", "uploads");
    const filename = sanitizeFilename(file.name || "upload");
    const pathname = `${folder}/${filename}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefixValue = searchParams.get("prefix") || "";
    const prefix = sanitizeSegment(prefixValue, "");
    const { blobs } = await list(prefix ? { prefix: `${prefix}/` } : undefined);
    return NextResponse.json({ blobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list uploads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing file url" }, { status: 400 });
    }

    await del(url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
