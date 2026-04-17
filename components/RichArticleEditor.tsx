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
    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    setUploading(true);
    try {
      for (const file of imageFiles) {
        const blob = await uploadAsset(folder, file);
        insertHtml(`<figure style="margin:28px auto;text-align:center;"><img src="${blob.url}" alt="${file.name}" style="display:block;max-width:100%;margin:0 auto;border-radius:10px;border:1px solid #c4c7ce;" /></figure><p></p>`);
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
        <button style={toolbarButtonStyle} type="button" onClick={() => exec("insertUnorderedList")}>• List</button>
        <button style={toolbarButtonStyle} type="button" onClick={() => {
          const url = window.prompt("Paste a link");
          if (url) exec("createLink", url);
        }}>Link</button>
        <input accept="image/*" multiple onChange={e => { if (e.target.files) void insertFiles(e.target.files); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
        <button style={toolbarButtonStyle} type="button" onClick={() => fileInputRef.current?.click()}>{uploading ? "..." : "Image"}</button>
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
          fontSize: 18,
          lineHeight: 1.9,
          maxWidth: 860,
          margin: "0 auto",
          outline: "none",
          padding: "36px 44px",
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
        [contenteditable] h1 { font-size: 34px; }
        [contenteditable] h2 { font-size: 26px; }
        [contenteditable] h3 { font-size: 20px; }
        [contenteditable] blockquote {
          border-left: 3px solid #c9a84c;
          color: #4b5563;
          margin: 18px 0;
          padding-left: 16px;
        }
        [contenteditable] ul {
          padding-left: 26px;
        }
        [contenteditable] p {
          margin: 0 0 16px;
        }
        [contenteditable] figure {
          margin: 28px auto;
          text-align: center;
        }
        [contenteditable] img {
          display: block;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}
