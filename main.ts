import { Notice, Plugin, TFile } from "obsidian";
import { WechatCaptureSettingTab } from "./src/setting-tab";
import { DEFAULT_SETTINGS, type WechatCaptureSettings } from "./src/settings";
import { UrlCaptureModal } from "./src/url-modal";
import { normalizeWechatArticleUrl } from "./src/url-policy";
import { extractWechatArticle } from "./src/wechat";

interface CaptureOptions {
  openNote: boolean;
}

export default class WechatCapturePlugin extends Plugin {
  settings: WechatCaptureSettings = DEFAULT_SETTINGS;
  private activeCaptureUrls = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "extract-wechat-article",
      name: "提取公众号文章",
      callback: () => this.openCaptureModal(),
    });

    this.addRibbonIcon("newspaper", "提取公众号文章", () => {
      this.openCaptureModal();
    });

    this.addSettingTab(new WechatCaptureSettingTab(this.app, this));

    this.registerObsidianProtocolHandler("wechat-capture", (params) => {
      const url = params.url;
      return this.captureWithoutInterface(typeof url === "string" ? url : "");
    });
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private openCaptureModal(): void {
    new UrlCaptureModal(this.app, async (url) => {
      await this.captureArticle(url, { openNote: true });
    }).open();
  }

  private async captureWithoutInterface(rawUrl: string): Promise<void> {
    try {
      await this.captureArticle(rawUrl, { openNote: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[wechat-capture] 无界面提取失败:", err);
      new Notice(`无界面提取失败: ${message}`, 8000);
    }
  }

  private async captureArticle(rawUrl: string, options: CaptureOptions): Promise<void> {
    const url = normalizeWechatArticleUrl(rawUrl);
    if (this.activeCaptureUrls.has(url.href)) {
      throw new Error("该文章正在提取，请稍候");
    }

    this.activeCaptureUrls.add(url.href);
    const notice = new Notice("正在提取公众号文章…", 0);

    try {
      const result = await extractWechatArticle(this.app, url.href, this.settings);
      const imgHint =
        result.imageCount > 0
          ? `，${result.imageCount} 张图片`
          : "（图片下载失败，正文已保留远程链接）";
      new Notice(`已保存: ${result.title}${imgHint}`, 5000);

      if (options.openNote) {
        const file = this.app.vault.getAbstractFileByPath(result.notePath);
        if (file instanceof TFile) {
          await this.app.workspace.getLeaf(false).openFile(file);
        }
      }
    } finally {
      notice.hide();
      this.activeCaptureUrls.delete(url.href);
    }
  }
}
