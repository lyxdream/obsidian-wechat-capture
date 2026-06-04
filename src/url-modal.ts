import { App, Modal, Notice } from "obsidian";

export class UrlCaptureModal extends Modal {
  private onSubmit: (url: string) => Promise<void>;

  constructor(app: App, onSubmit: (url: string) => Promise<void>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("wechat-capture-modal");

    contentEl.createEl("h2", { text: "提取公众号文章" });

    contentEl.createEl("p", {
      text: "粘贴微信公众号文章链接（mp.weixin.qq.com）",
      cls: "wechat-capture-hint",
    });

    const input = contentEl.createEl("input", {
      type: "url",
      placeholder: "https://...",
      cls: "wechat-capture-input",
    });
    input.focus();

    const btnRow = contentEl.createDiv({ cls: "wechat-capture-btn-row" });

    const submitBtn = btnRow.createEl("button", { text: "开始提取", cls: "mod-cta" });
    submitBtn.addEventListener("click", () => void this.handleSubmit(input.value));

    const cancelBtn = btnRow.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.close());

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void this.handleSubmit(input.value);
      if (e.key === "Escape") this.close();
    });
  }

  private async handleSubmit(raw: string): Promise<void> {
    const url = raw.trim();
    if (!url) {
      new Notice("请输入链接");
      return;
    }
    try {
      new URL(url);
    } catch {
      new Notice("链接格式不正确");
      return;
    }

    submitBtnDisable(this.contentEl);
    try {
      await this.onSubmit(url);
      this.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`提取失败: ${msg}`, 8000);
    } finally {
      submitBtnEnable(this.contentEl);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function submitBtnDisable(el: HTMLElement): void {
  const btn = el.querySelector(".mod-cta") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.setText("提取中…");
  }
}

function submitBtnEnable(el: HTMLElement): void {
  const btn = el.querySelector(".mod-cta") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = false;
    btn.setText("开始提取");
  }
}
