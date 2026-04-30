"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";

type RichArticleEditorProps = {
  folder: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

const toolbarButtonStyle: React.CSSProperties = {
  background: "#f0f1f3",
  border: "1px solid #c4c7ce",
  borderRadius: 6,
  color: "#2a2f3c",
  cursor: "pointer",
  fontSize: 12,
  minWidth: 34,
  padding: "6px 10px",
};

function sanitizeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

async function uploadAsset(folder: string, file: File) {
  const pathname = `${folder}/${sanitizeFilename(file.name || "upload")}`;
  return upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/uploads",
  });
}

function getVideoEmbedHtml(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/\.(mp4|webm|mov)(\?|$)/i.test(trimmed)) {
    return `<figure style="margin:28px auto;text-align:center;"><video controls style="display:block;max-width:100%;margin:0 auto;border-radius:10px;border:1px solid #c4c7ce;"><source src="${trimmed}" /></video></figure><p></p>`;
  }
  const youtubeMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/i);
  if (youtubeMatch) {
    return `<figure style="margin:28px auto;text-align:center;"><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" style="width:100%;aspect-ratio:16/9;border:1px solid #c4c7ce;border-radius:10px;" allowfullscreen></iframe></figure><p></p>`;
  }
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/i);
  if (vimeoMatch) {
    return `<figure style="margin:28px auto;text-align:center;"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" style="width:100%;aspect-ratio:16/9;border:1px solid #c4c7ce;border-radius:10px;" allowfullscreen></iframe></figure><p></p>`;
  }
  return `<p><a href="${trimmed}" target="_blank" rel="noreferrer">${trimmed}</a></p>`;
}

export default function RichArticleEditor({ folder, onChange, placeholder = "Start writing...", value }: RichArticleEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  function sync() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function exec(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    sync();
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    sync();
  }

  async function insertFiles(files: FileList | File[]) {
    const mediaFiles = Array.from(files).filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!mediaFiles.length) return;
    setUploading(true);
    try {
      for (const file of mediaFiles) {
        const blob = await uploadAsset(folder, file);
        if (file.type.startsWith("video/")) {
          insertHtml(`<figure style="margin:28px auto;text-align:center;"><video controls style="display:block;max-width:100%;margin:0 auto;border-radius:10px;border:1px solid #c4c7ce;"><source src="${blob.url}" type="${file.type}" /></video></figure><p></p>`);
        } else {
          insertHtml(`<figure style="margin:28px auto;text-align:center;"><img src="${blob.url}" alt="${file.name}" style="display:block;max-width:100%;margin:0 auto;border-radius:10px;border:1px solid #c4c7ce;" /></figure><p></p>`);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData.items);
    const imageFiles = items
      .filter(item => item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file);

    if (!imageFiles.length) return;
    event.preventDefault();
    await insertFiles(imageFiles);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center", padding: "10px 12px", background: "#f0f1f3", border: "1px solid #c4c7ce", borderRadius: 10 }}>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("bold")}><strong>B</strong></button>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("italic")}><em>I</em></button>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("formatBlock", "<h2>")}>H2</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("formatBlock", "<blockquote>")}>Quote</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("insertUnorderedList")}>Bullets</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("insertOrderedList")}>1. List</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => {
          const url = window.prompt("Paste a link");
          if (url) exec("createLink", url);
        }}>Link</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => {
          const url = window.prompt("Paste a video URL");
          if (url) insertHtml(getVideoEmbedHtml(url));
        }}>Video</button>
        <input accept="image/*,video/mp4,video/quicktime,video/webm" multiple onChange={e => { if (e.target.files) void insertFiles(e.target.files); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
        <button style={toolbarButtonStyle} type="button" onClick={() => fileInputRef.current?.click()}>{uploading ? "..." : "Media"}</button>
        <div style={{ marginLeft: "auto", color: "#5a6070", fontSize: 10, letterSpacing: 0.4 }}>
          Paste screenshots directly into the draft
        </div>
      </div>

      <div
        contentEditable
        data-placeholder={placeholder}
        onBlur={sync}
        onInput={sync}
        onPaste={e => void handlePaste(e)}
        ref={editorRef}
        style={{
          minHeight: 480,
          background: "#fffdf8",
          border: "1px solid #d8d4ca",
          borderRadius: 14,
          color: "#1b1b1b",
          fontFamily: "'Lora', serif",
          fontSize: 20,
          lineHeight: 1.9,
          maxWidth: 760,
          margin: "0 auto",
          outline: "none",
          padding: "44px 40px",
          whiteSpace: "pre-wrap",
          width: "100%",
        }}
        suppressContentEditableWarning
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
        [contenteditable] h1, [contenteditable] h2, [contenteditable] h3 {
          color: #0d0f14;
          font-family: 'Lora', serif;
          line-height: 1.25;
          margin: 28px 0 12px;
        }
        [contenteditable] h1 { font-size: 42px; }
        [contenteditable] h2 { font-size: 30px; }
        [contenteditable] h3 { font-size: 22px; }
        [contenteditable] blockquote {
          border-left: 3px solid #c9a84c;
          color: #4b5563;
          margin: 18px 0;
          padding-left: 16px;
        }
        [contenteditable] ul, [contenteditable] ol {
          padding-left: 30px;
        }
        [contenteditable] p {
          margin: 0 0 16px;
        }
        [contenteditable] figure {
          margin: 28px auto;
          text-align: center;
        }
        [contenteditable] img, [contenteditable] video, [contenteditable] iframe {
          display: block;
          margin: 0 auto;
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}
