const MAX_ARTICLE_URL_LENGTH = 2000;

export function normalizeWechatArticleUrl(rawUrl: string): URL {
  const value = rawUrl.trim();

  if (!value) {
    throw new Error("缺少公众号文章 URL");
  }
  if (value.length > MAX_ARTICLE_URL_LENGTH) {
    throw new Error("公众号文章 URL 过长");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("公众号文章 URL 格式不正确");
  }

  if (url.protocol !== "https:" || url.hostname !== "mp.weixin.qq.com") {
    throw new Error("仅支持 https://mp.weixin.qq.com 公众号文章链接");
  }
  if (url.username || url.password) {
    throw new Error("公众号文章 URL 不允许包含用户信息");
  }

  const path = url.pathname;
  const isShortArticle = path === "/s" && url.search !== "";
  const isPathArticle = /^\/s\/[^/]+/.test(path);
  if (!isShortArticle && !isPathArticle) {
    throw new Error("仅支持公众号文章路径 /s/... 或 /s?...");
  }

  url.hash = "";
  return url;
}
