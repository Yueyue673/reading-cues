<div align="center">
  <img src="docs/assets/mark.svg" width="58" height="58" alt="轻读标志">
  <h1>轻读 · Reading Cues</h1>
  <p>给中文网页里的词组加上浅色标记。</p>
  <p><a href="https://github.com/Yueyue673/reading-cues/releases/latest">下载安装包</a> · <a href="#安装和更新">安装方法</a> · <a href="docs/GETTING-STARTED.zh-CN.md">使用说明</a> · <a href="README.en.md">English</a></p>
  <p><a href="https://github.com/Yueyue673/reading-cues/actions/workflows/check.yml"><img src="https://github.com/Yueyue673/reading-cues/actions/workflows/check.yml/badge.svg" alt="自动检查状态"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-315e4b?style=flat-square" alt="MIT 许可"></a></p>
</div>

![轻读概念插画：纸带连接公交车和旧书店，浅彩书签像句子里的路标。实际功能见下方截图。](docs/assets/hero-zh.jpg)

轻读是一个免费的中文网页阅读插件。它会用浅颜色标出一些词语，帮你看清哪些字可以连在一起读。你也可以用跟随鼠标的横条定位当前行，或把周围内容变暗，集中看一段。颜色、标记数量和想提示的词都能自己调整。需要在电脑上的 Chrome / Edge 手动安装；网页文字在本机处理，不会上传。

## 打开网页，看看标记前后

安装并允许访问网站后，普通网页会自动标记，无需每次开启。下面用同一份原创通知对照，原文、字号和换行都没有改变。

![同一份通知的实际截图：左边是原文，右边开启轻读，用浅底色标出部分词组。](docs/assets/cover.png)

默认是最浅一档的随机彩色底色，强度为 20%。同一个词组保持同色，滚动时不会换色。颜色不表示重要程度，自动选词也可能分错。

## 把常漏看的词加进去

例如，只想提示通知里的“截止时间”：打开“个人词库与设置”，选择“只提示个人词库”，在“我需要提示”里输入这个词，点“添加”。回到网页，两处出现都会有提示。

![实际操作：在设置里添加“截止时间”，通知中两次出现这个词都被标出。](docs/assets/case-personal.png)

也可以在自动标记模式中添加个人词语。选中网页文字后，右键就能添加。不想再提示的词，可以加入“这些表达不再提示”。

## 按自己舒服的方式显示

| 你想调整什么 | 可以怎么做 |
| --- | --- |
| 颜色太浅，看不清 | 在“颜色与强度”中调深底色 |
| 太花、太密 | 换成单色，或把“标记多少”改成“少一些” |
| 更喜欢线条或较重的字 | 改成下划线、加重，或两者一起使用 |
| 想定位正在读的一行 | 在“更多阅读辅助”中开启“阅读尺”，横条会跟随鼠标 |
| 想先看眼前这一段 | 开启“段落聚焦”，让鼠标所在段落周围变暗 |

阅读尺和段落聚焦默认关闭，一次选择一种，可随时关闭。[查看操作步骤和实际画面](docs/GETTING-STARTED.zh-CN.md)

觉得自动选词不合适，也可以用包内的 `compare.html` 自己标一段，再与自动结果比较。标注仅在当前页暂存，刷新前请复制或导出。

## 安装和更新

目前需要**电脑上的 Chrome / Edge**，尚未上架扩展商店，手机端暂未适配。

1. 在 [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) 下载 `reading-cues-0.6.1.zip`，完整解压到固定目录。
2. 在 Chrome 打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`，开启“开发者模式”。
3. 点“加载已解压的扩展程序”，选择包含 `manifest.json` 的解压目录。
4. 确认网站访问权限，再刷新已经打开的网页。

想先试试：双击解压目录里的 `demo.html` 试样式，或打开 `compare.html` 自己标注。无需上传文章。[完整使用说明](docs/GETTING-STARTED.zh-CN.md)

更新时覆盖原目录，在扩展管理页重新加载，再刷新网页。个人词库和已有设置会保留；手动安装不会自动更新。

## 使用前知道这几件事

- 支持普通网页正文及插件能够读取的评论文字。曾在一个 B 站公开视频页验证评论区，其他页面仍可能有兼容问题。
- PDF、图片里的文字、浏览器设置页，以及不允许外部读取的网页组件暂不支持。安卓、Firefox、Safari 尚未适配。
- 复杂句、人名和繁体内容可能分错。你可以调整、暂停或关闭；它不能可靠判断文章重点。
- 轻读源于对 ADHD 和阅读困难的关注，目前不能承诺它能改善阅读理解或专注力。案例展示的是功能，是否读得更轻松，需要自己试用。

网页文字不上传，不调用 AI 服务。设置和个人词库保存在本机浏览器中。[隐私说明](PRIVACY.md)

## 反馈与贡献

不必会写代码。给出一句能复现问题的短文、实际标记和你希望一起读的词组，就能帮助改进。请先改写私人内容。

[报告误标](https://github.com/Yueyue673/reading-cues/issues/new?template=incorrect-cue.yml) · [报告显示或兼容问题](https://github.com/Yueyue673/reading-cues/issues/new?template=compatibility.yml) · [贡献说明](CONTRIBUTING.md)

想了解程序怎样选词，可以看[选词与标注](docs/ANNOTATION-DESIGN.md)、[研究记录](docs/RESEARCH.md)和[验证记录](docs/VALIDATION.md)。计划中的功能放在[后续计划](docs/ROADMAP.md)，开发和生成截图的方法见[开发说明](docs/DEVELOPMENT.md)。

## 分享轻读

[四张独立海报](docs/POSTERS.md) · [下载高清 PNG](https://github.com/Yueyue673/reading-cues/releases/download/v0.6.1/reading-cues-posters-zh-CN.zip) · [视觉源文件与生成说明](docs/ART-DIRECTION.md)

## 许可和致谢

代码、原创规则和文档采用 [MIT](LICENSE)。本地词性数据来自 jieba，保留其 [MIT 许可](licenses/jieba-MIT.txt)与[来源记录](docs/POS-SOURCE.md)。

介绍顺序与产品展示参考了 [Voyager](https://github.com/voyager-crew/voyager)。宣传插画使用图片生成模型制作，实际功能案例使用真实截图，标志沿用轻读自己的设计。
