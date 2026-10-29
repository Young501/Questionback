# 用户的学习与出题偏好

- 后续根据资料生成题库时，尽量少出简答／回忆题：每 20 道题安排 1–2 道，即整批约 5%–10%。
- 其余优先使用单选、多选、判断、连线匹配。概念与定义／职责对应题优先设计成连线匹配。
- 每题必须附答案、解析与资料出处，资料同时整理进知识库。
- 题目一次生成、保存本地；每日稳定复习 20 题，支持另开 20 题加练、题目收藏。
- 修改抽题比例时，保留已经开始的每日复习与加练记录。

## 新电脑接手流程

1. 阅读 README.md、docs/DEVELOPMENT.md；新增资料时阅读 docs/LEARNING_PACKS.md，迁移时阅读 docs/MIGRATION.md。
2. 安装 Node.js 20+，在仓库根目录运行 node verify.cjs。无第三方依赖，不需要 npm install。
3. 通过 node server.cjs 启动，使用 http://127.0.0.1:4173/，不依赖上一台电脑的路径或常驻进程。

## 修改约束

- 保持原生 HTML/CSS/JS 架构，常规需求不要引入框架、数据库或云服务。
- localStorage key 为 shiti.local.v1。保留 sessions、extraPractice、progress、favorites、materials、questions 和 knowledge。新增字段兼容旧备份。
- 修改判分、抽题、持久化后补充必要的行为验证，运行 node verify.cjs；界面改动还要浏览器验证。
- content.js 是正式内置内容，demo.js 是测试夹具，禁止在正式页面加载演示题。
- 学习包同 id 去重且不会覆盖；修订已入库题目需要明确迁移，不得通过清空存储解决。
- 新增内置资料后运行 node build-learning-pack.cjs，一并提交整理目录的导出结果。新增 JS 同步更新 index.html 脚本顺序和 server.cjs 白名单。
- 不提交凭证、用户完整备份或 tmp 临时文件。保留原始资料出处。
