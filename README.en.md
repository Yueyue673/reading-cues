<div align="center">
  <img src="docs/assets/mark.svg" width="58" height="58" alt="Reading Cues">
  <h1>Reading Cues · 轻读</h1>
  <p>Light color marks for phrases on Chinese web pages.</p>
  <p><a href="https://github.com/Yueyue673/reading-cues/releases/latest">Download</a> · <a href="#install-and-update">Install</a> · <a href="docs/GETTING-STARTED.en.md">User guide</a> · <a href="README.md">简体中文</a></p>
</div>

![Concept illustration: pastel bookmarks mark a paper route between a bus and a bookshop. Actual output appears below.](docs/assets/hero-en.jpg)

Reading Cues is a free browser extension that marks some Chinese phrases with light colors, helping you see which characters belong together. Adjust the colors and number of marks, add your own terms, or use a horizontal reading guide or paragraph focus. It requires manual installation in desktop Chrome or Edge. Page text is processed on your computer and is never uploaded.

The interface and phrase rules primarily support simplified Chinese.

## See the same notice before and after

Once installed and allowed to access websites, it marks ordinary pages automatically. The text, font size and line breaks stay the same.

![Actual extension output: the original Chinese notice on the left and phrase marks on the right.](docs/assets/cover.png)

The default uses pastel colors at the lightest setting, 20%. A phrase keeps its color while you scroll. Colors do not indicate importance, and phrase selection can be wrong.

## Add a term you often miss

To mark only `截止时间` (“deadline”), open the settings, select **只提示个人词库** (personal terms only), enter the term under **我需要提示**, and click **添加**. Both occurrences in this notice are marked.

![The actual settings form and two deadline occurrences marked in the same notice.](docs/assets/case-personal.png)

Personal terms also work alongside automatic marks. Add selected text through the right-click menu, or exclude terms you no longer want marked.

## Adjust the display

| What you want | What to change |
| --- | --- |
| Clearer marks | Increase the background intensity |
| Fewer colors or marks | Choose one color or reduce the number of marks |
| Lines or heavier-looking text | Choose underlines, heavier text, or both |
| A guide for the current line | Enable **阅读尺** under **更多阅读辅助** |
| Less visual detail around a paragraph | Enable **段落聚焦** to dim the area outside the paragraph under the pointer |

The ruler and paragraph focus start off. Choose one at a time and turn it off whenever you want. [Steps and actual screenshots](docs/GETTING-STARTED.en.md)

Open `compare.html` from the package to select your own phrases and compare them with automatic marks. Drafts live only in the current page; copy or export before refreshing.

## Install and update

You need **desktop Chrome or Edge**. There is no extension-store listing or adapted mobile version yet.

1. Download `reading-cues-0.6.1.zip` from [Releases](https://github.com/Yueyue673/reading-cues/releases/latest) and fully extract it to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Allow website access and reload existing pages.

To try it without installing, open `demo.html` for styles or `compare.html` for annotation. No article upload is needed. [Full user guide](docs/GETTING-STARTED.en.md)

For updates, replace the files in the same folder, reload the extension and refresh pages. Saved preferences and personal terms remain. Manual installations do not update automatically.

## What to expect

- Ordinary page text and comments exposed to extensions can be marked. Comments were checked on one public Bilibili video page; compatibility can vary elsewhere.
- PDFs, image text, protected browser pages and components that hide their text from extensions are unsupported. Android, Firefox and Safari are not adapted.
- Complex sentences, names and traditional Chinese can be grouped incorrectly. You can adjust or pause the marks. They do not reliably identify an article's main points.
- The project is motivated by ADHD and reading difficulties. It does not have established benefits for reading comprehension or attention. Examples show working features, not evidence of reading benefits.

No AI service calls or uploaded page text. Settings and personal terms stay in local browser storage. [Privacy](PRIVACY.md)

## Feedback and contributions

Share a short, non-private example, the actual marks and the phrase boundaries you prefer. [Report an issue](https://github.com/Yueyue673/reading-cues/issues) · [Contributing](CONTRIBUTING.md)

[Phrase selection](docs/ANNOTATION-DESIGN.md) · [Research](docs/RESEARCH.md) · [Validation](docs/VALIDATION.md) · [Plans](docs/ROADMAP.md) · [Development and screenshots](docs/DEVELOPMENT.md)

## Share Reading Cues

[Four separate Chinese posters](docs/POSTERS.md) · [Download the PNGs](https://github.com/Yueyue673/reading-cues/releases/download/v0.6.1/reading-cues-posters-zh-CN.zip) · [Artwork sources and prompts](docs/ART-DIRECTION.md)

## License and credits

Project code, original rules and documentation use [MIT](LICENSE). The bundled jieba data retains its upstream [MIT license](licenses/jieba-MIT.txt) and [source record](docs/POS-SOURCE.md).

Presentation was inspired by [Voyager](https://github.com/voyager-crew/voyager). Campaign illustrations were made with an image-generation model. Functional examples use actual screenshots, and the logo is Reading Cues' own design.
