# 轻读 · Reading Cues

**按自己的节奏读，让标记慢慢适合你。**

桌面 Chrome / Edge 的本地中文阅读辅助扩展。安装授权后，普通 HTTP / HTTPS 网页全局自动工作，不必逐站开启，没有网页浮窗、模型费用或阅读追踪。

**[下载 v0.4.0](https://github.com/Yueyue673/reading-cues/releases/latest) · [标注与算法](docs/ANNOTATION-DESIGN.md) · [研究复核](docs/RESEARCH-REVIEW-0.3.md) · [验证记录](docs/VALIDATION.md)**

![轻读试读](docs/preview.png)

## 这次改进

- **从逐词交替改为结构候选**：根据使用者提供的 31 个标注，尝试保留完整时间、修饰语、动作与状态。界面明确标为“意义块（试验）”，有轻量 / 均衡 / 较多三档。它仍会选错，不代表已理解文章。
- **同文对照**：包内 `compare.html` 可切换原文、旧分词、新候选和使用者原标注，还可试四段新题材文字或粘贴自己的文字。对照页不保存输入。
- **默认下划线**：新增描边式加重、加重＋下划线；底色继续可用。加重通过绘制让字看起来更重，保留原有字号与换行，不等同于字体的 `font-weight`。
- **可选稳定多色**：六种色彩，按词组稳定分配。相同词组同色，滚动和重扫不换色；主动“换一组”才重新分配。默认单色，颜色不表示重要程度，也不增加标记数量。
- **开放评论组件**：支持嵌套开放 Shadow DOM、动态回复和延迟挂载。已用实际扩展检查一个 B 站公开视频页的评论与楼中楼；用户名、按钮、评论输入框等保持原样。
- **稳定更新**：保留原生高亮与未变的文字范围；局部文本更新不清空整页；滚动、鼠标和视频更新的回归检查继续保留。

原逐词分界、374 条原创逻辑 / 数值 / 概念规则、仅个人词库仍可选择。内置 MIT 词性数据在本地提供结构提示，没有大模型、遥测或运行时联网词库。

## 安装与更新

1. 从 [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) 下载 `reading-cues-0.4.0.zip`，完整解压到固定目录。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启**开发者模式** → **加载已解压的扩展程序** → 选择含 `manifest.json` 的目录。
4. 完成浏览器网站访问授权，打开普通网页即可自动工作；已有页面刷新一次。

升级：可先导出个人词库备份，用新包覆盖原目录，点击扩展管理页**重新加载**，再刷新文章页。个人词、忽略词、样式与暂停设置保留；原逐词模式迁移到意义块候选，仍可切回。新安装默认下划线，已经保存的样式继续保留。v0.4 没有新增权限。

从 v0.1 升级还会从逐站白名单改为全局访问，浏览器可能要求确认权限。手动加载的包不会自行更新。尚未上架商店，安卓、Firefox 和 Safari 未适配。

不用安装也可试：双击包内 `compare.html` 比较算法，或 `demo.html` 比较样式与颜色。

## 根据自己的反馈微调

选中 2–40 字的完整词组 → 右键 **轻读：以后提示…**，可补充或纠正个人词组。个人词组每次出现都优先保留；忽略列表覆盖全部模式。设置页支持添加、移除与 JSON 备份，导入不改变网站或权限。

单色下划线跟随文字色。稳定多色下划线使用更适合亮 / 暗背景的配色；底色可自由取色，强度 20–85%，必要时配深浅文字色。图片背景用清楚的下划线。颜色、密度与加重分开试，避免一次改动太多。

全局默认运行，必要时可暂停一个网站或全部。站点暂停按协议和域名保存，覆盖其普通嵌入页，不自动包含子域名；浏览器匹配不能区分端口。浏览器自身访问限制优先，无痕窗口许可也由浏览器设置控制。

## 如何理解这轮结果

在三段参与调规则的校准文字中，共 31 个标注片段：旧算法 4 个起止边界完全一致，新候选均衡档为 24 个。**这不是新文章准确率，更不是阅读理解提升。** 标注中的“不需要重新”原样保留供比较，新候选会尝试补全到完整动作，差异仍计为不一致。

新段落仍有误选和遗漏。我们没有宣布“最佳算法”；同文切换只适合看差异，实际理解应轮换不同、难度相近的文章，检查未标内容和阅读负担。[算法推断与完整校准表](docs/ANNOTATION-DESIGN.md) · [试用方法](docs/TRYOUT.md)

中文词界、视觉提示与 ADHD 阅读研究存在不同结果。正确词界、稳定显示和个性化值得检验，但不能由规则数量或工程测试推出辅助效果。[研究与反面证据](docs/RESEARCH-REVIEW-0.3.md)

## 已知边界

- 主要面向简体中文。静态词性、词频分词和有限构式不是完整句法分析；复杂从句、否定范围、专名、繁体和口语仍需评估。个人词组和旧分词方案可用。
- 支持普通网页、普通 HTTP / HTTPS iframe 和开放 Shadow DOM。关闭的影子树、PDF、图片文字、浏览器内置页与商店保护页未支持。
- 编辑器、代码、导航、链接、标题、作者已有语义强调、动态通知与媒体控件保持原样。B 站支持已经历一个公开视频页实测，不代表所有页面、账号状态或播放器均已验证。
- 自动意义块最多 18 个 UTF-16 单元，个人词组可更长；每连续块最多 8,000 单元。每文档最多约 300,000 单元、60,000 遍历节点、6,000 组标记、2,048 个开放影子树。超限只处理部分内容。
- 词性数据在第一次需要时分批初始化；页面仍可能因自身脚本、复杂布局或不同显卡产生兼容问题。对比度保护不等于整站无障碍认证。

## 开发

Node.js 22+：

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
node scripts/evaluate-annotations.mjs
npm run package
npm run preview
```

只构建可离线运行 `node scripts/build.mjs`，加载目录为 `dist/extension/`，安装包输出在 `dist/`。校准比较不会自动当作 CI 的阅读效果门槛。

```text
src/chunker.js       本地浅层结构候选、边界与密度
src/data/pos.tsv     jieba (MIT) 词性提示精简集
src/core.js          设置、个人词组、旧算法、稳定配色
src/renderer.js      范围复用、开放影子树、样式与资源上限
src/lexicon.json     374 条原创逻辑 / 数值 / 概念规则
src/background.js   设置写入、迁移与已有页面注入
src/compare.*       标注与算法的离线对照
tests/              语言反例、迁移、构式与浏览器回归
```

## English

Reading Cues is a local Chinese reading-assistance experiment for desktop Chromium. Version 0.4 adds annotation-informed phrase candidates, an offline comparison page, default underlines, visual weight options, stable optional colors, and open-shadow comment support tested on one public Bilibili video. The phrase heuristic uses a compact MIT-licensed POS dictionary, not an LLM or a full parser. Calibration agreement is not held-out accuracy or reading effectiveness. No telemetry or runtime network requests.

## 许可

[MIT](LICENSE)。原创代码、规则、例句与文档使用本项目许可；jieba 词性数据保留 [上游 MIT 许可](licenses/jieba-MIT.txt) 与 [来源记录](docs/POS-SOURCE.md)。未捆绑 Chinese-DiMLex。开发依赖保留各自许可。

[隐私](PRIVACY.md) · [贡献](CONTRIBUTING.md) · [路线](docs/ROADMAP.md) · [反馈](https://github.com/Yueyue673/reading-cues/issues)
