# Start using Reading Cues

Reading Cues marks some Chinese phrases with light colors and can mark terms you add yourself. You need desktop Chrome or Edge. Mobile browsers, Firefox and Safari are not adapted. The interface is primarily simplified Chinese; the labels below match it. [简体中文](GETTING-STARTED.zh-CN.md)

## Install

1. Visit [Downloads](https://github.com/Yueyue673/reading-cues/releases/latest) and choose `reading-cues-0.6.1.zip` under Assets, rather than GitHub's automatic source archive.
2. Fully extract it to a folder you will keep in place.
3. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Allow website access and reload existing pages. Ordinary pages are marked automatically.

You do not have to enable every site separately. Any website restrictions you set in the browser take priority.

## Find the settings

Open the browser's extension menu and choose **轻读**. Common display controls are there. **个人词库与设置** opens your personal dictionary and paused websites.

The default is a multicolor background at 20% intensity. A phrase keeps its color while you scroll. Choose **换一组颜色** to change the palette.

![The same notice without marks and with the actual default output.](assets/cover.png)

## Mark your own terms

To mark only `截止时间` (“deadline”):

1. Open **个人词库与设置**.
2. Set **标记哪些词** to **只提示个人词库**.
3. Enter the term under **我需要提示**, then click **添加**.
4. Return to the page. Exact occurrences are marked.

![Adding a term in the actual settings marks both occurrences in the notice.](assets/case-personal.png)

To keep automatic marks too, choose **自动标记词组（默认）**. Personal terms work alongside them. You can also select text on a page and add it through the right-click menu. Terms must contain 2–40 characters and match literally; synonyms are not added automatically.

To suppress a term, add it under **这些表达不再提示**. Removing it from your personal dictionary only removes your addition; automatic rules may still select it.

## Change colors, style and quantity

- Too faint: expand **颜色与强度** and increase **底色强度**.
- Too many colors: choose **单色** under **配色方式**, then select a color.
- Too many marks: choose **少一些** under **标记多少**.
- Prefer lines: choose **下划线**; **加重** and **加重＋下划线** are also available.
- Restore the default display with **使用最浅的随机多色**.

Custom single-color controls are disabled in multicolor mode. Colors do not indicate importance, and the extension cannot reliably identify an article's main points.

## Guide a line or focus a paragraph

Under **更多阅读辅助**, choose:

- **阅读尺**: a horizontal band follows the pointer.
- **段落聚焦**: the paragraph under the pointer stays unchanged while its surroundings become dimmer.

![Actual extension output with the reading ruler and paragraph focus at the same pointer position.](assets/case-aids.png)

Both start off. Choose one at a time, or **关闭** to turn it off. They require pointer positioning; movements are not recorded.

## Pause, update and back up

Choose **仅暂停这个网站** to pause the current site, or **暂停所有网站的提示** to pause everywhere. You can restore marks in the same place.

Manual installations do not update automatically. Replace the files in the same folder, reload the extension and refresh pages. Keeping the same installation folder preserves preferences and personal terms.

Dictionary export is at the bottom of the settings page. It includes personal and ignored terms, not website permissions. Import merges and removes duplicates without clearing existing terms.

## Try it without installing

Open `demo.html` from the package to paste text and try styles. Input is not saved and disappears on refresh.

Open `compare.html`, choose **自己标注**, select a phrase and click **标记**. Finish to compare automatic marks with your selections.

![Automatic marks and your own selections shown side by side in the workspace.](assets/comparison.png)

Undo, edit, copy or export your work. Drafts live only in the current page, so save before refreshing. They are not automatically added to the extension's personal dictionary.

## Missing or unsuitable marks

Check that the extension is not paused and can access the site, then refresh. Also check whether personal-only mode is selected on a page without your terms.

PDFs, image text, browser settings pages and some closed page components are unsupported. Comment sections vary, so compatibility is not guaranteed everywhere.

Complex sentences, names and traditional Chinese can be grouped incorrectly. Add a full phrase, reduce marks or turn them off. This may not suit every reader.

[Report a problem](https://github.com/Yueyue673/reading-cues/issues) · [Privacy](../PRIVACY.md) · [Project home](../README.en.md)
