# 轻读 · Reading Cues

**看清词组边界，按自己的节奏读。**

在桌面 Chrome / Edge 中本地运行的中文阅读辅助扩展。安装授权后，全局自动处理普通 HTTP / HTTPS 网页；不用逐站开启，没有网页浮窗。默认通过本地分词和交替底色提供词组边界，颜色不表示重要程度。

**[下载 v0.3.0](https://github.com/Yueyue673/reading-cues/releases/latest) · [研究复核](docs/RESEARCH-REVIEW-0.3.md) · [验证记录](docs/VALIDATION.md) · [反馈](https://github.com/Yueyue673/reading-cues/issues)**

![词组分界与自由配色试读](docs/preview.png)

## 本次改进

- **选词方向调整**：默认“词组分界”。浏览器本地分词，优先保留完整的多字词和连续表达，不再默认只找逻辑连接词。可以选择隔 1 / 2 / 3 个词组标记。
- **三种方式可选**：词组分界、逻辑与数值提示、只提示个人词库。374 条原创逻辑 / 数值 / 概念规则仍可使用，但不代表文章重点。
- **修复清空重画的闪烁路径**：保留未变化的原生高亮和文字范围；小段新增只处理新增块；样式变化独立合并，滚动中延后处理。增加真实视频播放、鼠标移动、播放器控件和滚动回归检查。
- **标记更清楚**：默认底色强度从约 17% 提高到 50%；六组预设、自由取色，浅色 / 深色网页分别设置，强度可调 20–85%。保留清楚的下划线样式。
- **文字对比保护**：底色影响清晰度时自动配深浅字色；图片背景用下划线。保持字号、字形和换行，不拆分或包裹网页文字节点。

没有大模型 API、账户、遥测、远程词库或运行时第三方依赖。设置保存在本机。工程测试通过不等于阅读辅助效果已得到证明。

## 安装与升级

1. 从 [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) 下载 `reading-cues-0.3.0.zip`，完整解压到固定目录。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启**开发者模式** → **加载已解压的扩展程序** → 选择含 `manifest.json` 的目录。
4. 完成浏览器的网站访问授权。打开普通网页即可自动工作；已有页面刷新一次。

从 v0.2 升级：可先导出个人词库备份，用新包覆盖原目录，点击扩展管理页的**重新加载**，然后刷新文章页。个人词库、忽略词、样式、显式暂停和暂停站点保留；默认阅读方式改为词组分界。v0.3 没有新增权限。

从 v0.1 升级还会从逐站白名单改为全局访问，浏览器可能要求确认新增权限或重新启用；完成后不再逐站操作。手动加载的包不会自动更新。

包内 `demo.html` 可双击离线试读，也可粘贴自己的文字比较；输入不保存。目前尚未上架商店，安卓、Firefox 和 Safari 未适配。

## 按需要微调

打开插件可以选阅读方式、标记样式、分界密度和颜色。底色强度与标记数量分别调整；下划线跟随原文字色，取色设置用于底色样式。

分词可能切错，尤其是人名地名或歧义表达。选中 2–40 字的完整词组 → 右键 **轻读：以后提示…**，可用个人词组纠正；个人词组优先且每次出现都提示。设置页可以添加、移除、不再提示，以及导入 / 导出 JSON。导入只合并个人词与忽略词，不导入网站或权限。

全局默认运行，必要时可以暂停当前网站或全部。站点暂停按协议与域名保存，覆盖其普通嵌入页，不自动包含子域名；浏览器匹配不能区分端口。插件不记录浏览历史。浏览器自身的网站访问限制优先。

## 研究与边界

中文词界研究有正面、无收益与负面结果，错误边界可能干扰阅读；注意力维持、词义提取、视觉拥挤和理解监控也不是同一困难。当前方案根据明确的使用偏好提供可调的边界线索，不能宣称已经改善中文成人 ADHD / 阅读障碍使用者的理解。具体证据、相反结果与待验证假设见 [研究复核](docs/RESEARCH-REVIEW-0.3.md)。

- 分词使用浏览器本地 `Intl.Segmenter`；不理解篇章，不保证边界正确，也不判断语义重点。不同浏览器版本可能产生不同边界。内置连续表达只用于合并词组，配对 / 数值逻辑筛选属于可选逻辑模式。
- 默认只交替标记 2 字以上词组。它不是给每个字上色，也不保证所有概念都自动合并。个人词组可覆盖分词，忽略列表在全部模式生效。
- 普通 HTTP / HTTPS iframe 自动处理；PDF、图片文字、Shadow DOM、浏览器内置页与商店保护页未支持。
- 编辑器、代码、导航、链接、标题、作者已有语义强调、动态通知与媒体控件保持原样。
- 每连续文本块最多 8,000 个 UTF-16 单元；每文档最多约 300,000 单元、60,000 个遍历节点或 6,000 组标记，超限只处理部分内容。弹窗会说明，不在网页弹通知。持续更新的长页面可能先触及数量上限。
- 默认强度与密度是工程起点，不是最佳医学参数。对比度保护是有限工程检查，不能覆盖所有背景、透明文字和混合色；复杂页面与不同显卡的实际体验仍需反馈。
- “全局自动”不绕过浏览器限制；无痕窗口是否允许运行由浏览器设置控制。

试用时先固定颜色比较原文与分界，再分别比较密度与强度；观察整段理解和负担，不只检查高亮处。见 [试用方法](docs/TRYOUT.md)。

## 开发

Node.js 22+：

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
npm run package
npm run preview
```

只构建可离线运行 `node scripts/build.mjs`。扩展目录为 `dist/extension/`，安装包输出到 `dist/`。

```text
src/core.js        本地分词、连续表达合并、逻辑匹配、设置校验
src/lexicon.json   374 条原创连续 / 配对 / 数值规则与原创例句
src/renderer.js    增量范围更新、原生高亮复用、配色与资源上限
src/background.js 设置写入、升级迁移与已有网页注入
src/content.js    网页 / 嵌入页自动启动与暂停
src/ui-common.js  阅读方式、取色、强度与即时预览
src/popup.*       自动状态与可选设置
src/options.*     个人词库、备份、偏好与暂停站点
src/demo.*        离线试读
tests/            语言反例、分词边界、迁移与真实浏览器回归
```

## English

Reading Cues is a local Chinese reading-assistance experiment for desktop Chromium. Version 0.3 defaults to word-group boundary cues using local `Intl.Segmenter`, complete phrase overrides and alternating backgrounds. Optional logic cues and personal-only mode remain available. Custom light/dark colors, six presets and adjustable intensity improve visibility. Incremental updates retain unchanged native highlights; regression tests include pointer movement and actual video frames. No LLM, telemetry or runtime dependencies. Word boundaries may be wrong, and effectiveness for Chinese readers with ADHD or dyslexia remains unestablished.

## 许可

[MIT](LICENSE)，适用于原创代码、规则、例句和文档。未捆绑 Chinese-DiMLex 或其他外部词库；浏览器自带的分词实现由浏览器提供。开发依赖保留各自许可。[隐私与权限](PRIVACY.md) · [贡献规范](CONTRIBUTING.md) · [路线](docs/ROADMAP.md)
