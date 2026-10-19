# 轻读 · Reading Cues

**给中文句意的转弯处，留一点温和的提示。**

一个本地运行的桌面浏览器扩展。从“少量、完整表达的阅读提示”这一件小事做起：不一定、并非所有、只有…才…、虽然…但是…。支持个人词库，随时暂停。

**[下载安装包](https://github.com/Yueyue673/reading-cues/releases/latest) · [研究与设计依据](docs/RESEARCH.md) · [验证报告](docs/VALIDATION.md) · [反馈与贡献](CONTRIBUTING.md)**

![轻读试读页：原文保留，少量完整表达以浅底色提示](docs/preview.png)

## 可以做什么

- **小而可控**：18 条原创规则，覆盖限制、不确定性、成对条件、转折与让步；包含部分经过明确列举的简繁词形。
- **自己的词库**：添加需要提示的完整词语；忽略不需要的表达；本地 JSON 导入、导出。
- **不改变文字**：两种样式——浅底色、下划线。保留字体、文字颜色、换行、复制结果和网页文字节点。
- **适度提示**：每段最多 1–3 组，默认 2 组；再以提示字数占比约束密度。成对表达一起出现或一起省略。
- **主动启用**：首次使用时选择网站；以后在该站点自动生效。可以关闭一个网站或暂停全部。
- **本地运行**：没有模型 API、登录、阅读记录上传、统计追踪、远程词库或运行时第三方依赖。

这是一项可个性化的阅读辅助实验。现有研究不能证明这套中文规则对 ADHD 或阅读障碍使用者普遍有效。提示只是词形规则的命中，不表示“全文重点”或对句意的正确判断。效果需要结合自己的理解与负担来观察。

## 安装，不需要编程

1. 到 [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) 下载 `reading-cues-0.1.0.zip`，解压到一个固定目录。
2. Chrome 地址栏打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启**开发者模式** → **加载已解压的扩展程序** → 选择解压后包含 `manifest.json` 的目录。
4. 打开普通网页，点击工具栏的轻读图标，再点击**在这个网站启用**。浏览器会处理该站点的权限请求。
5. 选择浅底色或下划线。若提示太多，可以将每段上限设为 1 组。

解压目录中的 `demo.html` 也可以直接双击离线试读，无需安装扩展。它不会保存粘贴的文字。

目前提供手动加载包，尚未发布到 Chrome / Edge 扩展商店。目标是桌面 Chromium 浏览器；自动化实测使用 Chromium。Firefox、Safari、手机浏览器尚未验证。

## 个人词库与暂停

选中网页中的 2–40 字词语，右键选择**轻读：以后提示…**。也可以在插件的**个人词库与设置**里添加、移除或设置“不再提示”。它按原样匹配，不自动分词；忽略项优先于基础规则和个人提示。

关闭当前网站后，后续访问不再自动加载提示。要同时撤回访问权限，请进入设置里的“已启用的网站”，点击**关闭并撤回权限**。权限按协议和域名保存，不包含子域名；浏览器的站点匹配不能区分端口。

## 已知边界

- 使用有限词形与上下文规则，无法可靠消除所有词义歧义、推断否定范围或判断文章重点。比如“只有…才能…”仍可能遇到名词、专名等误标。
- 默认跳过编辑区、代码、导航、链接、标题、作者已有的语义强调和动态通知。跳过的内容也构成匹配边界，不跨过去配对。
- 初版不处理 iframe、Shadow DOM、PDF、图片里的文字与浏览器保护页面。
- 每个连续文本块最多处理 8,000 个 UTF-16 单元；整页最多约 300,000 单元、60,000 个遍历节点或 2,000 组提示。超限会在弹窗显示“仅处理了部分正文”。
- 高频变化网页采用合并重扫；极复杂页面可能有额外负担，可直接关闭该站点。背景图等无法可靠估计对比度时，浅底色会退回下划线。
- 改变网站主题后可重新打开/刷新页面；初版监测常见样式变化与系统主题，不能覆盖所有绘制方式。

## 开发

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

最后一条启动本机试读页。也可仅用 `node scripts/build.mjs` 离线构建；构建不需要 npm 依赖。加载目录为 `dist/extension/`，打包输出在 `dist/`。

```text
src/core.js          纯函数匹配、输入校验、个人词库格式
src/lexicon.json     原创规则、稳定 ID、正反例
src/renderer.js      Range、非破坏性高亮、动态页面与资源上限
src/background.js    站点授权后的脚本注册、串行设置写入
src/content.js       页面与本地设置连接
src/popup.*          当前网站开关与少量偏好
src/options.*        个人词库、备份、撤回网站权限
src/demo.*           可离线运行的试读页
tests/              语言反例、工作线程与真实浏览器测试
```

研究、试用和工程检查分别记录，不把测试通过当作辅助效果证明。下一轮优先根据具体误标和连续阅读反馈改进，参见 [试用记录方法](docs/TRYOUT.md) 与 [路线图](docs/ROADMAP.md)。

## English

Reading Cues is a local-first Chinese reading-assistance experiment for desktop Chromium browsers. A small original lexicon identifies complete expressions and paired markers, with conservative matching, per-paragraph limits, opt-in sites, personal phrases and reversible CSS Custom Highlights. No LLM, telemetry, remote code or runtime dependencies. Efficacy for Chinese readers with ADHD or dyslexia has **not** been established. Contributions should include positive and negative examples and respect the original wording and reader's control.

## 许可

[MIT](LICENSE)，适用于项目原创代码、规则、例句和文档。没有捆绑 Chinese-DiMLex 或其他第三方词库。开发依赖保留各自许可。详见 [隐私说明](PRIVACY.md)。
