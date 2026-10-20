<div align="center">
  <img src="docs/assets/mark.svg" width="58" height="58" alt="轻读标志">
  <h1>轻读 · Reading Cues</h1>
  <p>给中文网页里的完整词组，加一点阅读线索。</p>
  <p><a href="https://github.com/Yueyue673/reading-cues/releases/latest">下载扩展</a> · <a href="#安装">安装方法</a> · <a href="README.en.md">English</a></p>
  <p><a href="https://github.com/Yueyue673/reading-cues/actions/workflows/check.yml"><img src="https://github.com/Yueyue673/reading-cues/actions/workflows/check.yml/badge.svg" alt="自动检查状态"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-315e4b?style=flat-square" alt="MIT 许可"></a></p>
</div>

![轻读：浅色词组提示与阅读工作台](docs/assets/cover.png)

## 为什么做轻读

有些文字，单个字都认识，连在一起却容易丢掉线索。轻读从词组开始：在原文上加一点标记，再根据你的反馈调整边界、颜色和数量。

默认是**最浅一档的随机多色底色（20%）**。同一个词组保持同色，滚动时不会重新随机。装好并授权后，普通网页自动运行。

所有处理都在本地完成，没有模型调用费。阅读尺和段落聚焦可以按需开启，也可以一直关闭。

## 用起来是什么样

| 你想做的事 | 轻读里的操作 |
| --- | --- |
| 看清网页中的词组 | 自动加浅色底色，也可改成下划线或加重 |
| 提示太密、太花 | 减少标记数量，或切换单色 |
| 某个词总想一起读 | 选中文字，右键加入个人词库 |
| 阅读时需要定位 | 试试阅读尺或段落聚焦，一次开启一种 |
| 觉得自动选词不合适 | 在工作台自己标注，再与自动结果对照 |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workbench-dark.png">
  <img src="docs/assets/workbench.png" alt="工作台：左侧换素材，中间试读，顶部切换原文、自动标记和自己标注">
</picture>

工作台里，选中文字后点“标记”；完成后直接看对照。可以撤销、继续修改，最后复制或导出标注。自己的标注与自动结果分别保留。

![自动标记与个人标注的双栏对照](docs/assets/comparison.png)

## 安装

目前提供桌面 **Chrome / Edge** 的手动安装包，尚未上架扩展商店。

1. 在 [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) 下载 `reading-cues-0.6.0.zip`，完整解压到固定目录。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启“开发者模式”。
3. 点“加载已解压的扩展程序”，选择包含 `manifest.json` 的目录。
4. 确认网站访问权限，刷新已有网页即可。

想先试读：双击包内 `compare.html` 打开工作台，或用 `demo.html` 试样式。无需上传文章。

更新时用新包覆盖原目录，在扩展管理页重新加载，再刷新网页。个人词库和已有显示偏好会保留；想切到这版默认配色，可在设置里点“使用最浅的随机多色”。手动安装不会自动更新。

## 目前的范围

- 支持普通 HTTP / HTTPS 网页、嵌入页和开放评论组件；B 站评论曾在一个公开视频页实测。
- 不支持 PDF、图片文字、关闭的影子树和浏览器保护页。安卓、Firefox、Safari 尚未适配。
- 选词仍是试验规则，复杂句、专名和繁体会有错误。没有证据表明它对所有 ADHD 或阅读困难读者都有效。

网页正文不上传。插件设置和个人词库保存在本机；工作台标注仅在当前页暂存，刷新前请导出。[隐私说明](PRIVACY.md)

## 一起改进

不必会写代码。给出一句能复现问题的短文、实际标记和你希望的边界，就能帮助下一轮调整。请先改写私人内容。

[报告误标](https://github.com/Yueyue673/reading-cues/issues/new?template=incorrect-cue.yml) · [报告兼容或体验问题](https://github.com/Yueyue673/reading-cues/issues/new?template=compatibility.yml) · [贡献说明](CONTRIBUTING.md)

想了解选词依据，可以看[标注与算法](docs/ANNOTATION-DESIGN.md)、[研究记录](docs/RESEARCH.md)和[验证记录](docs/VALIDATION.md)。未来功能与取舍放在[路线](docs/ROADMAP.md)里。

<details>
<summary>本地开发</summary>

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

构建结果在 `dist/extension/`，安装包在 `dist/`。也可以离线运行 `node scripts/build.mjs`。`node scripts/capture-preview.mjs` 生成文档截图，需先安装 Playwright Chromium。

修改选词前请阅读[贡献说明](CONTRIBUTING.md)。校准样例、工程检查和阅读效果是三件不同的事；不要用测试数量代替实际体验。

</details>

## 许可与致谢

代码、原创规则和文档采用 [MIT](LICENSE)。本地词性数据来自 jieba，保留其 [MIT 许可](licenses/jieba-MIT.txt)与[来源记录](docs/POS-SOURCE.md)。

文档入口和产品展示参考了 [Voyager](https://github.com/voyager-crew/voyager)。界面、文案和封面按轻读的用途重新设计。
