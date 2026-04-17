"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type BlobUploadControlProps = {
  accept?: string;
  buttonLabel?: string;
  folder: string;
  multiple?: boolean;
  onUploaded?: (urls: string[]) => void;
  onChange: (value: string) => void;
  value: string;
};

const buttonStyle: React.CSSProperties = {
  background: "#e2e4e8",
  border: "1px solid #2a2d35",
  borderRadius: 6,
  color: "#3a3f4c",
  cursor: "pointer",
  fontSize: 10,
  letterSpacing: 1,
  padding: "7px 12px",
};

function sanitizeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export default function BlobUploadControl({
  accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp",
  buttonLabel = "UPLOAD FILE",
  folder,
  multiple = false,
  onUploaded,
  onChange,
  value,
}: BlobUploadControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const pathname = `${folder}/${sanitizeFilename(file.name || "upload")}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/uploads",
        });
        uploadedUrls.push(blob.url);
      }

      if (multiple) {
        const existing = value
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);
        onChange([...existing, ...uploadedUrls].join("\n"));
      } else if (uploadedUrls[0]) {
        onChange(uploadedUrls[0]);
      }

      onUploaded?.(uploadedUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" as const }}>
      <input
        accept={accept}
        multiple={multiple}
        onChange={e => void handleFiles(e.target.files)}
        ref={inputRef}
        style={{ display: "none" }}
        type="file"
      />
      <button disabled={uploading} onClick={() => inputRef.current?.click()} style={{ ...buttonStyle, opacity: uploading ? 0.6 : 1 }} type="button">
        {uploading ? "UPLOADING..." : buttonLabel}
      </button>
      <span style={{ color: error ? "#dc2626" : "#5a6070", fontSize: 10, letterSpacing: 0.5 }}>
        {error || "Stores the file in the app and fills in the URL automatically"}
      </span>
    </div>
  );
}
