"use client";
import { useState } from "react";
import { DBData } from "@/lib/db";

export type JournalEntry = { id: number; date: string; body: string; };

const iStyle: React.CSSProperties = { width: "100%", background: "#1a1d24", border: "1px solid #2a2d35", borderRadius: 6, padding: "8px 10px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "'DM Mono', monospace" };

export default function JournalTab({ data, onChange }: { data: DBData; onChange: (d: DBData) => void }) {
  const entries: JournalEntry[] = (data as any).journal ?? [];
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [writing, setWriting] = useState(false);

  function save() {
    if (!newBody.trim()) return;
    const entry: JournalEntry = { id: Date.now(), date: newDate, body: newBody.trim() };
    const updated = [entry, ...entries].sort((a, b) => b.date.localeCompare(a.date));
    onChange({ ...data, journal: updated } as any);
    setNewBody(""); setWriting(false);
  }

  function saveEdit(id: number) {
    onChange({ ...data, journal: entries.map(e => e.id === id ? { ...e, body: editBody } : e) } as any);
    setEditing(null);
  }

  function remove(id: number) {
    onChange({ ...data, journal: entries.filter(e => e.id !== id) } as any);
    if (expanded === id) setExpanded(null);
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const older = sorted.slice(1);
  const dayOfWeek = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {!writing ? (
        <button onClick={() => { setWriting(true); setNewDate(new Date().toISOString().slice(0, 10)); }}
          style={{ width: "100%", background: "#0f1117", border: "1px dashed #2a2d35", borderRadius: 8, padding: "16px", fontSize: 11, color: "#444", cursor: "pointer", letterSpacing: 2, marginBottom: 24, textAlign: "left" as const, fontFamily: "'DM Mono', monospace" }}>
          + NEW ENTRY
        </button>
      ) : (
        <div style={{ background: "#0f1117", border: "1px solid #c9a84c40", borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...iStyle, width: "auto", fontSize: 11 }} />
            <span style={{ fontSize: 10, color: "#555", letterSpacing: 1 }}>{newDate ? dayOfWeek(newDate) : ""}</span>
          </div>
          <textarea autoFocus value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Pre-market thoughts..."
            style={{ ...iStyle, height: 200, resize: "vertical" as const, lineHeight: 1.7, fontFamily: "'Lora', serif", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={() => { setWriting(false); setNewBody(""); }} style={{ flex: 1, background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>CANCEL</button>
            <button onClick={save} disabled={!newBody.trim()} style={{ flex: 2, background: "#c9a84c", color: "#0a0c10", border: "none", borderRadius: 6, padding: "8px 0", fontSize: 11, fontWeight: 700, cursor: newBody.trim() ? "pointer" : "not-allowed", letterSpacing: 1, opacity: newBody.trim() ? 1 : 0.4 }}>SAVE ENTRY</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && <div style={{ textAlign: "center", padding: 80, color: "#2a2d35", fontSize: 12, letterSpacing: 2 }}>NO ENTRIES YET</div>}

      {latest && (
        <div style={{ background: "#0a0c10", border: "1px solid #2a2d35", borderRadius: 10, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: "#c9a84c", letterSpacing: 2, marginBottom: 4 }}>LATEST</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontFamily: "'DM Mono', monospace" }}>{dayOfWeek(latest.date)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(latest.id); setEditBody(latest.body); }} style={{ background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 4, padding: "3px 10px", fontSize: 10, cursor: "pointer" }}>EDIT</button>
              <button onClick={() => remove(latest.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
          </div>
          {editing === latest.id ? (
            <>
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} autoFocus
                style={{ ...iStyle, height: 200, resize: "vertical" as const, lineHeight: 1.7, fontFamily: "'Lora', serif", fontSize: 14 }} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => setEditing(null)} style={{ flex: 1, background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 6, padding: "7px 0", fontSize: 11, cursor: "pointer" }}>CANCEL</button>
                <button onClick={() => saveEdit(latest.id)} style={{ flex: 2, background: "#c9a84c", color: "#0a0c10", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>SAVE</button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 15, color: "#c8d0d8", lineHeight: 1.8, fontFamily: "'Lora', serif", whiteSpace: "pre-wrap" as const }}>{latest.body}</p>
          )}
        </div>
      )}

      {older.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 10 }}>PREVIOUS ENTRIES</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {older.map(entry => (
              <div key={entry.id} style={{ background: "#0a0c10", border: "1px solid #1e2128", borderRadius: 8, overflow: "hidden" }}>
                <div onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", overflow: "hidden" }}>
                    <span style={{ fontSize: 12, color: "#8b9299", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" as const }}>{dayOfWeek(entry.date)}</span>
                    {expanded !== entry.id && (
                      <span style={{ fontSize: 12, color: "#444", fontFamily: "'Lora', serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 380 }}>
                        {entry.body.slice(0, 80)}{entry.body.length > 80 ? "…" : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
                    {expanded === entry.id && <>
                      <button onClick={e => { e.stopPropagation(); setEditing(entry.id); setEditBody(entry.body); }} style={{ background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>EDIT</button>
                      <button onClick={e => { e.stopPropagation(); remove(entry.id); }} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </>}
                    <span style={{ fontSize: 11, color: "#333" }}>{expanded === entry.id ? "▲" : "▼"}</span>
                  </div>
                </div>
                {expanded === entry.id && (
                  <div style={{ padding: "4px 18px 18px" }}>
                    {editing === entry.id ? (
                      <>
                        <textarea value={editBody} onChange={e => setEditBody(e.target.value)} autoFocus
                          style={{ ...iStyle, height: 180, resize: "vertical" as const, lineHeight: 1.7, fontFamily: "'Lora', serif", fontSize: 14 }} />
                        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                          <button onClick={() => setEditing(null)} style={{ flex: 1, background: "none", border: "1px solid #2a2d35", color: "#555", borderRadius: 6, padding: "7px 0", fontSize: 11, cursor: "pointer" }}>CANCEL</button>
                          <button onClick={() => saveEdit(entry.id)} style={{ flex: 2, background: "#c9a84c", color: "#0a0c10", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>SAVE</button>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 14, color: "#8b9299", lineHeight: 1.8, fontFamily: "'Lora', serif", whiteSpace: "pre-wrap" as const }}>{entry.body}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
