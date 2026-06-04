# Wechat Capture

Obsidian 插件：将**微信公众号文章**采集到笔记库。

[![CI](https://github.com/lyxdream/obsidian-wechat-capture/actions/workflows/ci.yml/badge.svg)](https://github.com/lyxdream/obsidian-wechat-capture/actions/workflows/ci.yml)

## 功能

| 功能 | 说明 | 依赖 |
|------|------|------|
| 公众号全文 | 标题、作者、正文、图片 → Markdown | 无（开箱即用） |

## 安装

### 方式 A：社区插件（上架后）

在 Obsidian **设置 → 社区插件** 中搜索 **Wechat Capture** 安装。

### 方式 B：手动安装

1. 从 [Releases](https://github.com/lyxdream/obsidian-wechat-capture/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 复制到你的库目录：

   ```text
   <你的库>/.obsidian/plugins/obsidian-wechat-capture/
   ```

3. 在 Obsidian 中启用插件

### 方式 C：开发模式（符号链接）

```bash
git clone https://github.com/lyxdream/obsidian-wechat-capture.git
cd obsidian-wechat-capture
npm install
npm run build

ln -s "$(pwd)" "<你的库>/.obsidian/plugins/obsidian-wechat-capture"
```

## 使用

1. 点击左侧 Ribbon 图标，或 `Cmd/Ctrl + P` 打开命令面板
2. 选择 **提取公众号文章**
3. 粘贴链接并开始提取

### 设置项

**设置 → Wechat Capture**

| 设置 | 默认值 | 说明 |
|------|--------|------|
| 公众号笔记目录 | `wechat` | 文章保存位置 |
| 附件目录 | `attachments` | 公众号图片附件根目录 |

## 开发

```bash
npm install
npm run dev      # 监听构建
npm run build    # 生产构建
```

构建产物为 `main.js`（已在 `.gitignore` 中，Release 时上传）。

### 项目结构

```text
obsidian-wechat-capture/
├── main.ts              # 插件入口
├── manifest.json        # Obsidian 插件元信息
├── styles.css
├── versions.json        # 社区插件版本兼容
├── src/
│   ├── wechat.ts        # 公众号提取
│   └── ...
└── .github/workflows/   # CI 构建
```

## 发布新版本

1. 更新 `manifest.json` 和 `package.json` 中的 `version`
2. 更新 `versions.json`（Obsidian 最低版本映射）
3. `npm run build`
4. 创建 GitHub Release，上传 `main.js`、`manifest.json`、`styles.css`

## 已知限制

- 微信公众号可能返回验证页，需先在浏览器打开链接
- 图片若在微信 CDN 已压水印，无法去除
- 仅支持 Obsidian **桌面端**

## 许可证

[MIT](LICENSE)

## 致谢

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
