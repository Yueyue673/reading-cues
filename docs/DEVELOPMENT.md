# 开发与维护

普通用户请看[安装和使用](GETTING-STARTED.zh-CN.md)。这里说明本地构建、检查和视觉素材的维护。

## 运行与检查

需要 Node.js 22+。

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run package
npm run preview
```

构建结果在 `dist/extension/`，安装包在 `dist/`。离线构建可直接运行 `node scripts/build.mjs`；页面素材和本地词库已经随仓库提供。

修改语言规则前阅读[贡献说明](../CONTRIBUTING.md)。程序通过检查、符合已有标注和阅读效果改善，需要分别验证。

## 更新真实截图

```sh
node scripts/capture-preview.mjs
```

需要 Playwright Chromium。脚本在独立的临时浏览器中访问本机原创示例，实际开关扩展、添加个人词语和开启阅读辅助，检查正文及排版后生成案例图。不会操作日常浏览器。

截图保存在 `docs/assets/`，原始截图和核对记录在忽略的 `artifacts/doc-captures/`。`cover.png` 是真实前后对照；README 的 `hero-zh.jpg` 与 `hero-en.jpg` 是概念封面，两个用途不能互换。海报原图保留 PNG，展示页使用单独导出的轻量 JPEG 预览。

## 更新封面与海报

概念插画源文件在 `docs/artwork/`，使用内置图片生成工具创作。[视觉说明和完整提示词](ART-DIRECTION.md)

已选定的生成素材随仓库保存；重新排版不需要调用模型：

```sh
npm install --prefix artifacts/poster-tools --ignore-scripts --no-package-lock qrcode@1.5.4 jsqr@1.4.0
node scripts/make-posters.mjs
```

脚本重新拍摄实际功能、生成独立海报和中英文封面，检查边界、尺寸和最终海报二维码，并输出 360 × 450 的手机尺寸检查图。记录在忽略的 `artifacts/poster-qa/`。

只改版式时可加 `--layout-only` 复用已保存截图；功能变化后必须重新拍摄。生成素材不能替代实际界面和处理结果。

宣传图不会打包进插件，也不会成为插件在网页上的联网依赖。当前维护命令不修改安装包版本或选词规则。
