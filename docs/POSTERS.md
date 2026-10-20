# 轻读项目海报

四张独立 PNG，尺寸均为 **2160 × 2700（4:5）**，可以单独保存、发布。以“句子里的路标”为创意，结合图片生成模型制作的纸雕插画、准确文字与实际截图，介绍已经可用的功能。

[打包下载四张原图](https://github.com/Yueyue673/reading-cues/releases/download/v0.6.1/reading-cues-posters-zh-CN.zip) · [安装轻读](../README.md#安装和更新)

## 01 · 句子里，也可以有路标

纸带、公交车、旧书店和浅彩书签呼应日常短句，下方展示这句文字的实际标记。先让人知道轻读是中文网页阅读插件，以及标记是什么样。

<a href="posters/01-phrase.png"><img src="posters/previews/01-phrase.jpg" width="540" alt="海报一：句子里，也可以有路标。纸带路线的概念插画与浅色词组标记实拍"></a>

[打开独立原图](posters/01-phrase.png)

## 02 · 读这一段，周围暗一点

用台灯照亮书页的概念插画，表现阅读时先看眼前一段的场景。实际功能让鼠标所在段落周围变暗，不改写正文；海报注明它默认关闭，以及在哪里开启。[实际画面](assets/case-aids.png)

<a href="posters/02-focus.png"><img src="posters/previews/02-focus.jpg" width="540" alt="海报二：读这一段，周围暗一点。台灯与书页的概念插画，配真实功能说明"></a>

[打开独立原图](posters/02-focus.png)

## 03 · 常漏看的词，自己加个记号

金色书签表现自己的阅读记号。选择“只提示个人词库”后，添加“截止时间”，回到网页看两处提示。表单与标记结果来自实际扩展操作。

<a href="posters/03-personal.png"><img src="posters/previews/03-personal.jpg" width="540" alt="海报三：常漏看的词，自己加个记号。真实设置表单及网页里的提示"></a>

[打开独立原图](posters/03-personal.png)

## 04 · 下一篇网页，试试这样读

用书页展开的小路引导开始使用，说明需要电脑上的 Chrome / Edge 手动安装。二维码指向 [GitHub 最新下载页](https://github.com/Yueyue673/reading-cues/releases/latest)，已从最终整张海报解码核对；电脑端也可以输入海报底部的网址。

<a href="posters/04-install.png"><img src="posters/previews/04-install.jpg" width="540" alt="海报四：下一篇网页，试试这样读。概念插画、电脑端安装步骤与下载二维码"></a>

[打开独立原图](posters/04-install.png)

## 内容依据与使用

海报基于 v0.6.1。文案、概念插画与真实功能分别核对；没有使用人数、效果比例或健康效果承诺。[视觉说明与图片生成提示词](ART-DIRECTION.md)

- [README](../README.md)：当前功能、默认样式、平台范围与安装步骤。
- [隐私说明](../PRIVACY.md)：文字处理、词库和显示设置保存在本机，不上传网页正文。
- [MIT 许可](../LICENSE)：开源许可；当前版本安装包可免费下载。
- [v0.6.1 下载页](https://github.com/Yueyue673/reading-cues/releases/tag/v0.6.1)：实际可用的安装包。
- [词组、个人词语与配色代码](../src/core.js)、[实际绘制代码](../src/renderer.js)、[段落聚焦代码](../src/reading-aids.js)：截图所使用的功能实现。

海报、原创示例文字与排版源文件沿用项目 MIT 许可。可以转发，也可以按许可修改；请保留许可要求的声明。功能展示不能作为改善 ADHD、阅读障碍或专注力的证据。

## 重新制作

排版源文件在 [posters.html](posters/posters.html) 与 [posters.css](posters/posters.css)，原始截图在 [screens/](posters/screens/)，选定的生成插画在 [artwork/](artwork/)。海报没有嵌入手机模型，也没有另画界面冒充截图。

需要 Node.js 22+、项目的 Playwright，以及仅用于制图的二维码工具：

```sh
npm ci
npx playwright install --with-deps chromium
npm install --prefix artifacts/poster-tools --ignore-scripts --no-package-lock qrcode@1.5.4 jsqr@1.4.0
node scripts/make-posters.mjs
```

脚本使用独立的临时浏览器和本机原创文字，实际运行扩展并检查前后正文与布局，验证两个“截止时间”范围，生成四张原图及 360 × 450 的手机尺寸检查图，再从最终海报识别二维码。检查记录保存在忽略的 `artifacts/poster-qa/`。

只调整排版时，可以使用 `node scripts/make-posters.mjs --layout-only` 复用现有截图。项目功能变化时，应重新拍摄，并更新文案、版本和入口。
