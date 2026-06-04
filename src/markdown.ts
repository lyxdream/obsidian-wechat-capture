import { formatDateTime } from "./utils";

export interface NoteFrontmatter {
  source: "wechat";
  url: string;
  title: string;
  author?: string;
  published?: string;
  created: string;
  tags: string[];
}

export function buildMarkdownNote(fm: NoteFrontmatter, body: string): string {
  const lines: string[] = ["---"];
  lines.push(`source: ${fm.source}`);
  lines.push(`url: ${fm.url}`);
  lines.push(`title: ${escapeYaml(fm.title)}`);
  if (fm.author) lines.push(`author: ${escapeYaml(fm.author)}`);
  if (fm.published) lines.push(`published: ${escapeYaml(fm.published)}`);
  lines.push(`created: ${fm.created}`);
  lines.push(`tags: [${fm.tags.join(", ")}]`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${fm.title}`);
  lines.push("");
  lines.push(body.trim());
  lines.push("");
  return lines.join("\n");
}

function escapeYaml(s: string): string {
  if (/[:#\[\]{}&,*?|>!'"%@`]/.test(s) || s.includes("\n")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

export function defaultCreated(): string {
  return formatDateTime();
}
