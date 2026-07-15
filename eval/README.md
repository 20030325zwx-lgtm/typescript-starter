# AI 分析评测工具

将已获授权或自建的真实题图人工标注结果与 Dify 实际输出整理成 JSON，至少准备 30 道后执行：

```powershell
npm run evaluate:analysis -- eval/dataset.local.json
```

实际评测集建议保存为 `dataset.local.json`，不要提交受版权保护的题图、原文或个人数据。数据格式参考 `dataset.example.json`。

输出指标包括题型准确率、答案准确率、知识点完全匹配率、耗时 P50/P95 和估算成本。
