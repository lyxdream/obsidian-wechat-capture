import { Notice, Plugin } from "obsidian";
import { WechatCaptureSettingTab } from "./src/setting-tab";
import { DEFAULT_SETTINGS, type WechatCaptureSettings } from "./src/settings";
import { UrlCaptureModal } from "./src/url-modal";
import { extractWechatArticle } from "./src/wechat";

export default class WechatCapturePlugin extends Plugin {
  settings: WechatCaptureSettings = DEFAULT_SETTINGS;

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
      const notice = new Notice("正在提取公众号文章…", 0);

      try {
        const result = await extractWechatArticle(this.app, url, this.settings);

        notice.hide();
        const imgHint =
          result.imageCount > 0
            ? `，${result.imageCount} 张图片`
            : "（图片下载失败，正文已保留远程链接）";
        new Notice(`已保存: ${result.title}${imgHint}`, 5000);

        const file = this.app.vault.getAbstractFileByPath(result.notePath);
        if (file && "extension" in file) {
          await this.app.workspace.getLeaf(false).openFile(file);
        }
      } catch (err) {
        notice.hide();
        throw err;
      }
    }).open();
  }
}
