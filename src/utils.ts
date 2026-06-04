import { requestUrl } from "obsidian";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function sanitizeFilename(name: string, maxLen = 80): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "untitled";
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
}

export function formatDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 笔记文件名日期前缀（YYYY-MM-DD），优先用文章发布时间，否则用当天。 */
export function datePrefixForNote(published?: string): string {
  if (published) {
    const iso = published.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }
    const slash = published.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slash) {
      return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
    }
    const cn = published.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (cn) {
      return `${cn[1]}-${cn[2].padStart(2, "0")}-${cn[3].padStart(2, "0")}`;
    }
  }
  return formatDate();
}

export function formatDateTime(d = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${h}:${min}`;
}

export async function fetchText(url: string, referer?: string): Promise<string> {
  const res = await requestUrl({
    url,
    method: "GET",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text;
}

export function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href;
  } catch {
    return url.split("#")[0].trim();
  }
}

export async function fetchBinary(url: string, referer?: string): Promise<ArrayBuffer> {
  const normalized = normalizeImageUrl(url);
  const ref = referer || (normalized.includes("mmbiz.qpic.cn") ? "https://mp.weixin.qq.com/" : normalized);

  const attempts: Array<Record<string, string>> = [
    {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: ref,
    },
    { Referer: "https://mp.weixin.qq.com/" },
    {},
  ];

  let lastError: Error | null = null;

  for (const headers of attempts) {
    try {
      const res = await requestUrl({
        url: normalized,
        method: "GET",
        headers,
      });
      if (res.status >= 200 && res.status < 300 && res.arrayBuffer?.byteLength > 0) {
        return res.arrayBuffer;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Obsidian 桌面端兜底：Electron net
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { net } = require("electron") as typeof import("electron");
    const buf = await electronNetGet(normalized, ref, net);
    if (buf.byteLength > 0) return buf;
  } catch {
    /* ignore */
  }

  throw lastError ?? new Error("图片下载失败");
}

function electronNetGet(
  url: string,
  referer: string,
  net: typeof import("electron").net
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: "GET", url, redirect: "follow" });
    request.setHeader("User-Agent", UA);
    request.setHeader("Referer", referer);
    request.setHeader("Accept", "image/*,*/*;q=0.8");

    const chunks: Buffer[] = [];

    request.on("response", (response) => {
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        const code = response.statusCode ?? 0;
        if (code >= 200 && code < 300 && body.length > 0) {
          resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
        } else {
          reject(new Error(`HTTP ${code}`));
        }
      });
      response.on("error", reject);
    });

    request.on("error", reject);
    request.end();
  });
}

export function toAbsolute(base: string, href: string | undefined | null): string | null {
  if (!href || typeof href !== "string") return null;
  const t = href.trim();
  if (!t || t.startsWith("data:") || t.startsWith("javascript:")) return null;
  try {
    return new URL(t, base).href;
  } catch {
    return null;
  }
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function extFromMagic(buf: Uint8Array): string | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return ".gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return ".webp";
  return null;
}

export function extHintFromUrl(imageUrl: string): string | null {
  try {
    const u = new URL(imageUrl);
    const fmt = (u.searchParams.get("wx_fmt") || "").toLowerCase();
    if (fmt === "png") return ".png";
    if (fmt === "jpeg" || fmt === "jpg") return ".jpg";
    if (fmt === "gif") return ".gif";
    if (fmt === "webp") return ".webp";
    if (u.searchParams.get("tp") === "webp") return ".webp";
  } catch {
    /* ignore */
  }
  return null;
}

export function pickImageExt(imageUrl: string, buf: Uint8Array): string {
  return extFromMagic(buf) || extHintFromUrl(imageUrl) || ".jpg";
}

export function isProbablyHtml(buf: Uint8Array): boolean {
  const head = new TextDecoder().decode(buf.subarray(0, Math.min(64, buf.length))).trimStart();
  return head.startsWith("<!") || head.toLowerCase().startsWith("<html");
}

export async function ensureFolder(vault: import("obsidian").Vault, folderPath: string): Promise<void> {
  const parts = folderPath.split("/").filter(Boolean);
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (!vault.getAbstractFileByPath(acc)) {
      await vault.createFolder(acc);
    }
  }
}

export async function uniqueNotePath(vault: import("obsidian").Vault, folder: string, baseName: string): Promise<string> {
  const safe = sanitizeFilename(baseName);
  let path = `${folder}/${safe}.md`;
  if (!vault.getAbstractFileByPath(path)) return path;

  const stamp = Date.now();
  path = `${folder}/${safe}-${stamp}.md`;
  return path;
}
