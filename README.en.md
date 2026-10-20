<div align="center">
  <img src="docs/assets/mark.svg" width="58" height="58" alt="Reading Cues">
  <h1>Reading Cues · 轻读</h1>
  <p>Light color marks for phrases on Chinese web pages.</p>
  <p><a href="https://github.com/Yueyue673/reading-cues/releases/latest">Download</a> · <a href="#install-and-update">Install</a> · <a href="README.md">简体中文</a></p>
</div>

Reading Cues is a free browser extension that marks some Chinese phrases with light colors, helping you see which characters belong together. You can adjust the colors and number of marks, add your own terms, or turn on a horizontal reading guide or paragraph focus. Page text is processed on your computer and is never uploaded.

It currently supports desktop Chrome and Edge through manual installation. Once installed and allowed to access websites, it runs automatically on ordinary web pages. The interface and language rules primarily support simplified Chinese.

## See the same notice before and after

The left side shows the original notice; the right side shows the extension's actual output. Text, font size and line breaks stay the same.

![The same original Chinese notice without marks and with default phrase marks](docs/assets/cover.png)

The default uses pastel colors at the lightest setting, 20%. A phrase keeps its color while you scroll. Colors do not indicate importance. You can increase the intensity, select one color, use underlines or heavier-looking text, or reduce the number of marks.

## Mark a term you often miss

To mark only `截止时间` (“deadline”), open the extension's settings, select **只提示个人词库** (personal terms only), then enter the term under **我需要提示** and click **添加**. Both occurrences in this notice are marked.

![The real settings form and both deadline occurrences marked in the notice](docs/assets/case-personal.png)

Personal terms also work alongside automatic marks. You can add selected page text through the right-click menu, or exclude terms you no longer want marked.

## Keep track of a line or paragraph

Under **更多阅读辅助**, choose **阅读尺** for a horizontal band that follows the pointer, or **段落聚焦** to dim the area outside the current paragraph. Both start off; choose one at a time, or turn them off. Pointer movements are not recorded.

![The same notice and pointer position with the reading ruler and paragraph focus](docs/assets/case-aids.png)

<details>
<summary>Choose your own phrases and compare</summary>

Open `compare.html` from the package. Select an example or paste text, choose **自己标注**, select a phrase and click **标记**. Finish to compare automatic marks with your selections side by side.

![Automatic marks and manual selections in the workspace](docs/assets/comparison.png)

You can undo, edit, copy or export your annotations. Drafts live only in the current page; export before refreshing. They are not automatically added to your personal dictionary.

</details>

## Install and update

There is no extension-store listing yet.

1. Download `reading-cues-0.6.1.zip` from [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) and fully extract it to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked**, select the folder containing `manifest.json`, and allow website access.
4. Reload existing pages.

To try it without installing, open `compare.html` for annotation and comparison, or `demo.html` for styles and colors. No article upload is needed.

For updates, replace the files in the same folder, reload the extension and refresh pages. Saved preferences and personal terms remain. Manual installations do not update automatically.

## What to expect

- Ordinary page text and comments exposed to extensions can be marked. Comments were checked on one public Bilibili video page; compatibility can vary elsewhere.
- PDFs, image text, protected browser pages and components that hide their text from extensions are unsupported. Android, Firefox and Safari are not adapted.
- Phrase selection can be wrong, especially with complex sentences, names and traditional Chinese. You can adjust or pause it.

The project is motivated by ADHD and reading difficulties. It does not have established benefits for reading comprehension or attention. These examples demonstrate working features, not evidence of reading benefits.

## Privacy and contributions

No AI service calls, telemetry or uploaded page text. Settings and personal terms stay in browser storage. [Privacy](PRIVACY.md)

To report a phrase error, share a short, non-private example, the actual marks and the phrase boundaries you prefer. [Contributing](CONTRIBUTING.md) · [Research](docs/RESEARCH.md) · [Validation](docs/VALIDATION.md) · [Plans](docs/ROADMAP.md)

For local development and reproducible screenshots, see the [Chinese README](README.md).

## Share Reading Cues

Four separate Chinese-language posters show phrase marks, paragraph focus, personal terms and installation. Each uses verified product output and is available as a 2160 × 2700 PNG.

[View the posters and individual images](docs/POSTERS.md) · [Download all four](https://github.com/Yueyue673/reading-cues/releases/download/v0.6.1/reading-cues-posters-zh-CN.zip)

## License and credits

Project code and original content use [MIT](LICENSE). The bundled jieba dictionary retains its upstream [MIT license](licenses/jieba-MIT.txt) and [source record](docs/POS-SOURCE.md). Presentation was inspired by [Voyager](https://github.com/voyager-crew/voyager); Reading Cues has its own branding, interface and case images.
