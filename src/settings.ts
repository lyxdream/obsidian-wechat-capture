export interface WechatCaptureSettings {
  wechatFolder: string;
  attachmentFolder: string;
}

export const DEFAULT_SETTINGS: WechatCaptureSettings = {
  wechatFolder: "Inbox/公众号",
  attachmentFolder: "attachments",
};
