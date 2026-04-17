"use client";

type MarkdownArticleProps = {
  content: string;
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "image"; alt: string; src: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2] && match[3]) {
      parts.push(<a key={parts.length} href={match[3]} target="_blank" rel="noreferrer" style={{ color: "#a07828", textDecoration: "none" }}>{match[2]}</a>);
    } else if (match[4]) {
      parts.push(<strong key={parts.length}>{match[4]}</strong>);
    } else if (match[5]) {
      parts.push(<em key={parts.length}>{match[5]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }

    const imageMatch = line.match(/^!\[(.*)\]\((.+)\)$/);
    if (imageMatch) {
      blocks.push({ type: "image", alt: imageMatch[1], src: imageMatch[2] });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2] });
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s+/.test(lines[i].trim()) && !/^!\[.*\]\(.+\)$/.test(lines[i].trim()) && !/^> /.test(lines[i].trim()) && !/^- /.test(lines[i].trim())) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

export default function MarkdownArticle({ content }: MarkdownArticleProps) {
  const blocks = parseMarkdown(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const size = block.level === 1 ? 24 : block.level === 2 ? 19 : 16;
          return <div key={index} style={{ fontSize: size, lineHeight: 1.3, color: "#0d0f14", fontFamily: "'Lora', serif", fontWeight: 600 }}>{renderInline(block.text)}</div>;
        }
        if (block.type === "image") {
          return <img key={index} alt={block.alt} src={block.src} style={{ width: "100%", borderRadius: 10, border: "1px solid #c4c7ce", objectFit: "cover" }} />;
        }
        if (block.type === "quote") {
          return <blockquote key={index} style={{ margin: 0, padding: "8px 0 8px 16px", borderLeft: "3px solid #c9a84c", color: "#3a3f4c", fontStyle: "italic", fontFamily: "'Lora', serif", lineHeight: 1.8 }}>{renderInline(block.text)}</blockquote>;
        }
        if (block.type === "list") {
          return (
            <ul key={index} style={{ margin: 0, paddingLeft: 22, color: "#2a2f3c", fontFamily: "'Lora', serif", lineHeight: 1.8 }}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return <p key={index} style={{ margin: 0, fontSize: 14, color: "#2a2f3c", lineHeight: 1.9, fontFamily: "'Lora', serif" }}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
