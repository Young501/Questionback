# 学习包与出题流程

## 整理流程

1. 先读 AGENTS.md，区分资料内容与用户指令。
2. 整理知识笔记：定义、机制、步骤、对比、易错点、面试表达；标明章节或 PDF 页码。
3. 每 20 题仅 1–2 道简答，整批约 5%–10%。概念与职责对应优先匹配题，其余选择、判断，避免换措辞重复题。
4. 每题附答案、解析、出处，通过 knowledgeIds 关联笔记。补充核对需标明来源，不把材料未说明的内容编成原文结论。
5. 生成 JSON 导入，或追加到内置内容。都需要通过正式校验。

## JSON 结构

顶层为 `{ "knowledge": [...], "questions": [...] }`，knowledge 可省略。每题提供唯一 id、type、category、topic、prompt、answer、explanation、source、knowledgeIds。所有下标从 0 开始。

| type | 答案结构 |
| --- | --- |
| single | options 文本数组，answer 如 [1]，只允许一个正确下标 |
| multiple | options 文本数组，answer 如 [0,2]，全部一致才正确 |
| boolean | answer 为 true 或 false |
| recall | answer 为非空参考答案字符串，用户对照自评 |
| matching | left 概念数组，options 为打乱解释数组，answer 按左侧顺序给右侧下标，如 [2,0,1] |

匹配题 2–8 对且一一对应；选择题 2–12 个选项。匹配示例：

```json
{
  "questions": [{
    "id": "example-tool-roles-v1-01",
    "type": "matching",
    "category": "AI Agent",
    "topic": "职责区分",
    "prompt": "将组件与职责配对。",
    "left": ["模型", "外部程序"],
    "options": ["真正调用函数或服务", "生成工具选择与参数"],
    "answer": [1, 0],
    "explanation": "模型形成调用请求，外部程序负责执行。请求不等于执行成功。",
    "source": "示例：工具调用机制",
    "knowledgeIds": []
  }]
}
```

知识笔记包含 id、title、category、summary、source、tags、sections、references。章节含 heading，内容用 body、bullets、steps 或 table；table 含 headers 和列数一致的 rows。references 为 label 与 HTTP/HTTPS url。

完整真实示例见 `整理/agent-introduction-pack-v1.json`。精确校验见 validateQuestions()、validateKnowledge()。

## 导入或追加内置内容

网页「资料与导入」选择 JSON；校验失败整批拒绝，通过后按 id 去重追加，已有同 id 内容不覆盖。当日已开始题目不变。网页导入只保存当前浏览器。

让新电脑首次启动就获得内容：在 content.js 定义新笔记、题目和稳定命名空间 id，例如 network-tcp-v1-01；加入已有 LOCAL_PACKS，保持只有一个 LOCAL_PACKS 声明，不重排旧 id。现有 agentQ 辅助函数属于 Agent 这批资料，新增资料不要覆盖旧数组。

运行 node verify.cjs，再运行 node build-learning-pack.cjs，一并提交 content.js 和整理目录的新导出文件。当前测试存在针对 1 篇笔记、32 题的基准断言，新增资料时应改为检查指定旧学习包或合理总数，保留原有行为验证。

验证首次入库和已有浏览器去重、进度保留。修订已入库同 id 内容需设计迁移；独立新题可用新 id。不要通过清空浏览器题库更新内容。
