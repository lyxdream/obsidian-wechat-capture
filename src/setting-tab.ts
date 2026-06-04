import { App, PluginSettingTab, Setting } from "obsidian";
import type WechatCapturePlugin from "../main";
import { DEFAULT_SETTINGS } from "./settings";

export class WechatCaptureSettingTab extends PluginSettingTab {
  plugin: WechatCapturePlugin;

  constructor(app: App, plugin: WechatCapturePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "公众号采集设置" });

    new Setting(containerEl)
      .setName("公众号笔记目录")
      .setDesc("提取的公众号文章保存到此文件夹")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.wechatFolder)
          .setValue(this.plugin.settings.wechatFolder)
          .onChange(async (value) => {
            this.plugin.settings.wechatFolder = value.trim() || DEFAULT_SETTINGS.wechatFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("附件目录")
      .setDesc("公众号文章图片等附件的根目录")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachmentFolder)
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value.trim() || DEFAULT_SETTINGS.attachmentFolder;
            await this.plugin.saveSettings();
          })
      );
  }
}
