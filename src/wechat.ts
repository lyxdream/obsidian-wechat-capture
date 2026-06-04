import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { normalizePath, type App } from "obsidian";
import { buildMarkdownNote, defaultCreated } from "./markdown";
import type { WechatCaptureSettings } from "./settings";
import {
  ensureFolder,
  fetchBinary,
  fetchText,
  isProbablyHtml,
  normalizeImageUrl,
  pickImageExt,
  sanitizeFilename,
  toAbsolute,
  uniqueNotePath,
  uniq,
} from "./utils";

export interface WechatExtractResult {
  notePath: string;
  title: string;
  imageCount: number;
}

function decodeWxJsString(s: string): string {
  return s
    .replace(/\\x26amp;/gi, "&")
    .replace(/\\x26/gi, "&")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/gi, "&");
}

function scrubScrapedUrl(raw: string): string {
  let s = raw.trim().replace(/\\u0026/gi, "&").replace(/&amp;/gi, "&");
  s = s.replace(/(?:\\x26)?amp.*$/i, "");
  s = s.replace(/[,;)\]}>'"]+$/, "").replace(/\\+$/, "");
  return s.trim();
}

function isNoiseCdnUrl(href: string): boolean {
  if (!href) return true;
  if (/\.js(\?|$)/i.test(href)) return true;
  if (/pic_blank\.gif/i.test(href)) return true;
  if (/mp\.weixin\.qq\.com\/mmbizappmsg/i.test(href)) return true;
  return false;
}

function mmbizUrlIdentityKey(href: string): string {
  try {
    const u = new URL(normalizeImageUrl(href));
    if (u.hostname !== "mmbiz.qpic.cn") return href;
    const fmt = u.searchParams.get("wx_fmt") || "";
    return `mmbiz:${u.pathname}:${fmt}`;
  } catch {
    return href;
  }
}

function mmbizWatermarkIdentityKeys(html: string): Set<string> {
  const re = /watermark_info:\s*\{\s*cdn_url:\s*JsDecode\('([^']+)'\)/g;
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = decodeWxJsString(m[1]);
    const cleaned = scrubScrapedUrl(raw);
    if (!cleaned || isNoiseCdnUrl(cleaned)) continue;
    try {
      keys.add(mmbizUrlIdentityKey(toAbsolute("https://mp.weixin.qq.com/", cleaned)!));
    } catch {
      /* ignore */
    }
  }
  return keys;
}

function dropWeChatWatermarkLayerUrls(html: string, urls: string[]): string[] {
  if (!html.includes("watermark_info")) return urls;
  const blocked = mmbizWatermarkIdentityKeys(html);
  if (blocked.size === 0) return urls;
  return urls.filter((u) => {
    try {
      return !blocked.has(mmbizUrlIdentityKey(u));
    } catch {
      return true;
    }
  });
}

function extractEmbeddedCdnUrls(html: string, pageUrl: string): string[] {
  const list: string[] = [];
  const re = /https?:\/\/mmbiz\.qpic\.cn\/[a-zA-Z0-9_/?&=%.+~-]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const cleaned = scrubScrapedUrl(m[0]);
    if (isNoiseCdnUrl(cleaned)) continue;
    const abs = toAbsolute(pageUrl, cleaned);
    if (abs) list.push(abs);
  }
  return list;
}

const EMBED_MARKER = "CCAPIMG";

function markerToken(idx: number): string {
  return `${EMBED_MARKER}${String(idx).padStart(4, "0")}`;
}

function replaceEmbedMarkers(md: string, embedMarkers: string[]): string {
  return md.replace(/CCAP\\?IMG(\d{4})/g, (_, num) => {
    const idx = Number(num);
    return embedMarkers[idx] ?? "";
  });
}

function collectContentImageUrls(contentHtml: string, fullHtml: string, pageUrl: string): string[] {
  const $ = cheerio.load(contentHtml);
  const list: string[] = [];

  $("img").each((_, el) => {
    const $el = $(el);
    for (const attr of ["data-src", "src", "data-original", "data-lazy-src", "data-url"]) {
      const abs = toAbsolute(pageUrl, $el.attr(attr));
      if (abs) list.push(abs);
    }
  });

  const deduped = uniq(list.map(normalizeImageUrl));
  return dropWeChatWatermarkLayerUrls(fullHtml, deduped);
}

function parseWechatMeta(html: string, pageUrl: string) {
  const $ = cheerio.load(html);

  const title =
    $("#activity-name").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().replace(/\s*\|.*$/, "").trim() ||
    "未命名文章";

  const author =
    $("#js_name").text().trim() ||
    $('meta[name="author"]').attr("content")?.trim() ||
    "";

  let published =
    $("#publish_time").text().trim() ||
    $('meta[property="og:release_date"]').attr("content")?.trim() ||
    "";

  if (!published) {
    const metaText = $("#meta_content .rich_media_meta_text").first().text().trim();
    if (metaText) published = metaText;
  }

  const contentEl = $("#js_content");
  const contentHtml = contentEl.html()?.trim() || "";

  if (!contentHtml) {
    if (/验证|secitptpage|环境异常/i.test(html)) {
      throw new Error("遇到微信验证页，请先在浏览器打开该链接完成验证，或稍后重试");
    }
    throw new Error("未解析到正文（可能是验证页或页面结构变化）");
  }

  return { title, author, published, contentHtml, pageUrl };
}

function lookupLocalPath(
  urlToLocal: Map<string, string>,
  identityToLocal: Map<string, string>,
  remoteUrl: string
): string | undefined {
  const norm = normalizeImageUrl(remoteUrl);
  if (urlToLocal.has(norm)) return urlToLocal.get(norm);
  const key = mmbizUrlIdentityKey(norm);
  return identityToLocal.get(key);
}

function preprocessImages(
  contentHtml: string,
  pageUrl: string,
  urlToLocal: Map<string, string>,
  identityToLocal: Map<string, string>,
  embedMarkers: string[]
): string {
  const $ = cheerio.load(contentHtml);

  $("img").each((_, el) => {
    const $el = $(el);
    let remoteUrl: string | null = null;
    let localPath: string | undefined;

    for (const attr of ["data-src", "src", "data-original", "data-lazy-src", "data-url"]) {
      const abs = toAbsolute(pageUrl, $el.attr(attr));
      if (!abs) continue;
      remoteUrl = normalizeImageUrl(abs);
      localPath = lookupLocalPath(urlToLocal, identityToLocal, remoteUrl);
      if (localPath) break;
    }

    if (localPath) {
      const idx = embedMarkers.length;
      embedMarkers.push(`![[${localPath}]]`);
      $el.replaceWith(`<p>${markerToken(idx)}</p>`);
    } else if (remoteUrl) {
      $el.replaceWith(`<img src="${remoteUrl}" alt="" />`);
    } else {
      $el.remove();
    }
  });

  $("script, style, svg, iframe").remove();
  return $.html();
}

function htmlToMarkdown(
  contentHtml: string,
  pageUrl: string,
  urlToLocal: Map<string, string>,
  identityToLocal: Map<string, string>
): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  const embedMarkers: string[] = [];
  const preprocessed = preprocessImages(
    contentHtml,
    pageUrl,
    urlToLocal,
    identityToLocal,
    embedMarkers
  );
  let md = turndown.turndown(preprocessed);
  md = replaceEmbedMarkers(md, embedMarkers);

  // 兜底：修复 Turndown 可能转义过的 Obsidian 嵌入语法
  md = md.replace(/!\\?\[\\?\[([^\]]+)\\?\]\\?\]/g, "![[$1]]");
  md = md.replace(/!\[\[([^\]]+)\\\]\]/g, "![[$1]]");

  return md.replace(/\n{3,}/g, "\n\n").trim();
}

async function downloadImages(
  app: App,
  imageUrls: string[],
  attachDir: string,
  pageUrl: string
): Promise<{ urlToLocal: Map<string, string>; identityToLocal: Map<string, string>; successCount: number }> {
  const urlToLocal = new Map<string, string>();
  const identityToLocal = new Map<string, string>();
  let successCount = 0;

  await ensureFolder(app.vault, attachDir);

  for (let i = 0; i < imageUrls.length; i++) {
    const remote = normalizeImageUrl(imageUrls[i]);
    try {
      const arrayBuffer = await fetchBinary(remote, pageUrl);
      const buf = new Uint8Array(arrayBuffer);
      if (isProbablyHtml(buf)) continue;

      const ext = pickImageExt(remote, buf);
      const fileName = `${String(i + 1).padStart(4, "0")}${ext}`;
      const vaultPath = normalizePath(`${attachDir}/${fileName}`);

      if (!app.vault.getAbstractFileByPath(vaultPath)) {
        await app.vault.createBinary(vaultPath, arrayBuffer);
      }

      urlToLocal.set(remote, vaultPath);
      identityToLocal.set(mmbizUrlIdentityKey(remote), vaultPath);
      successCount++;
    } catch (err) {
      console.warn("[wechat-capture] 图片下载失败:", remote, err);
    }
  }

  return { urlToLocal, identityToLocal, successCount };
}

export async function extractWechatArticle(
  app: App,
  pageUrl: string,
  settings: WechatCaptureSettings
): Promise<WechatExtractResult> {
  if (!pageUrl.includes("mp.weixin.qq.com")) {
    throw new Error("请输入有效的微信公众号文章链接");
  }

  const html = await fetchText(pageUrl);
  const meta = parseWechatMeta(html, pageUrl);
  const imageUrls = collectContentImageUrls(meta.contentHtml, html, pageUrl);

  const slug = sanitizeFilename(meta.title);
  const attachDir = normalizePath(`${settings.attachmentFolder}/wechat/${slug}`);
  const { urlToLocal, identityToLocal, successCount } = await downloadImages(
    app,
    imageUrls,
    attachDir,
    pageUrl
  );

  const body = htmlToMarkdown(meta.contentHtml, pageUrl, urlToLocal, identityToLocal);
  const noteContent = buildMarkdownNote(
    {
      source: "wechat",
      url: pageUrl,
      title: meta.title,
      author: meta.author || undefined,
      published: meta.published || undefined,
      created: defaultCreated(),
      tags: ["公众号", "采集"],
    },
    body
  );

  await ensureFolder(app.vault, normalizePath(settings.wechatFolder));
  const notePath = await uniqueNotePath(
    app.vault,
    normalizePath(settings.wechatFolder),
    meta.title
  );
  await app.vault.create(notePath, noteContent);

  return { notePath, title: meta.title, imageCount: successCount };
}
