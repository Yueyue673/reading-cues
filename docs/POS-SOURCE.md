# 本地词性数据来源

- 上游：[fxsjy/jieba](https://github.com/fxsjy/jieba)
- 固定提交：`67fa2e36e72f69d9134b8a1037b83fbb070b9775`
- 数据：[jieba/dict.txt](https://github.com/fxsjy/jieba/blob/67fa2e36e72f69d9134b8a1037b83fbb070b9775/jieba/dict.txt)
- 许可：[MIT，Copyright (c) 2013 Sun Junyi](../licenses/jieba-MIT.txt)。分发包也包含该完整许可。
- 原始文件 SHA-256：`7197c3211ddd98962b036cdf40324d1ea2bfaa12bd028e68faa70111a88e12a8`

过滤条件：词频至少 20、词长不超过 8 个 UTF-16 单元、只含汉字。保留词语、词性和量化后的对数词频，共 79,684 条，`src/data/pos.tsv` 为 1,067,813 字节。词条数量不是标记规则数量，更不是阅读效益指标。

`scripts/prepare-pos.mjs` 接收本地原始词典与许可路径，校验固定 SHA 后重建精简集；不会联网。普通构建直接使用仓库内的精简数据，不必下载上游：

```sh
node scripts/prepare-pos.mjs path/to/dict.txt path/to/LICENSE
node scripts/build.mjs
```

该词典用于本地分词和浅层词性提示；没有捆绑 jieba 的 HMM 或神经模型，不等同于 jieba 的完整词性标注结果。词性存在歧义，精简也会遗漏低频词。当前主要面向简体中文；繁体、专名和口语要另行评估。旧版 `Intl.Segmenter` 分界仍可选择。

374 条原创逻辑 / 数值 / 概念规则仍是独立数据 `src/lexicon.json`。第三方 POS 数据与原创规则的来源分别记录，没有把第三方词典改称原创。
