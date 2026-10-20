<div align="center">
  <img src="docs/assets/mark.svg" width="58" height="58" alt="Reading Cues">
  <h1>Reading Cues · 轻读</h1>
  <p>Small visual cues for Chinese phrases, right on the page.</p>
  <p><a href="https://github.com/Yueyue673/reading-cues/releases/latest">Download</a> · <a href="README.md">简体中文</a></p>
</div>

![Reading Cues reading workspace](docs/assets/cover.png)

Reading Cues is a local reading experiment for desktop Chrome and Edge. It marks Chinese phrases without rewriting the page. The default uses stable pastel colors at 20% opacity; the same phrase keeps its color while you scroll.

You can change the density or style, keep a personal dictionary, and optionally try a reading ruler or paragraph focus. The offline workspace lets you mark exact text ranges, undo edits and compare your choices with automatic cues. Annotation drafts can be copied or exported as JSON.

The interface and language rules primarily support simplified Chinese. Rules still make mistakes. This is not an established intervention for ADHD or dyslexia; engineering tests and calibration agreement do not demonstrate reading benefits.

## Install

1. Download and extract `reading-cues-0.6.0.zip` from [Releases](https://github.com/Yueyue673/reading-cues/releases/latest).
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked**, select the folder containing `manifest.json`, and allow website access.
4. Reload existing pages. Ordinary HTTP / HTTPS pages work automatically.

Open `compare.html` from the package to try the workspace without installing. Existing preferences survive upgrades. Manual installations do not update automatically.

PDFs, image text, closed shadow roots and protected browser pages are not supported. Android, Firefox and Safari are not adapted.

## Privacy and contributions

No model calls, telemetry or uploaded page text. Preferences and personal terms stay in browser storage. Workspace annotations live only in the current page; export before refreshing. The optional visual aids use temporary pointer positions only while enabled.

[Privacy](PRIVACY.md) · [Contributing](CONTRIBUTING.md) · [Research](docs/RESEARCH.md) · [Validation](docs/VALIDATION.md)

MIT for project code and original content. The bundled jieba dictionary retains its upstream [MIT license](licenses/jieba-MIT.txt). Documentation presentation was inspired by [Voyager](https://github.com/voyager-crew/voyager); the interface, copy and cover were created for Reading Cues.
