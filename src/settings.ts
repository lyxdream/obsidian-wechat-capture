export interface WechatCaptureSettings {
  wechatFolder: string;
  attachmentFolder: string;
}

export const DEFAULT_SETTINGS: WechatCaptureSettings = {
  wechatFolder: "wechat",
  attachmentFolder: "attachments",
};
