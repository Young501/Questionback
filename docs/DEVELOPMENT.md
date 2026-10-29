# 开发与架构

## 环境

Node.js 20+、Git，无第三方依赖和打包器。在仓库根目录执行 `node verify.cjs`、`node server.cjs`。访问 http://127.0.0.1:4173/。本地服务只绑定本机。Windows 启动器便于双击，macOS/Linux 直接运行 Node 命令。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| index.html | 页面外壳、导航和脚本加载 |
| style.css | 响应式样式与连线布局 |
| app.js | 本地数据库、校验、抽题、作答、判分、收藏、错题、备份、主要页面 |
| knowledge.js | 笔记校验、合并学习包、知识库阅读与题目关联、Markdown 导出 |
| content.js | 正式内置笔记与题目，LOCAL_PACKS 数组 |
| demo.js | 仅测试用旧演示题，正式页面不加载 |
| server.cjs | 4173 静态服务，资源白名单及无缓存响应 |
| verify.cjs | Node vm 中的行为回归验证，不修改真实浏览器 |
| build-learning-pack.cjs | 遍历内置学习包并导出 JSON 与 Markdown |
| 整理/ | 可导入学习包与笔记 |
| 资料/ | 原始 PDF |
| preview*.png | 已有预览，不保证反映每次后续界面变化 |

脚本加载顺序 content.js → knowledge.js → app.js。代码使用经典脚本共享作用域，不是 ES modules。调整顺序前检查跨文件依赖。

## 持久化

localStorage key 为 `shiti.local.v1`，JSON version=1。questions 与 knowledge 保存题库笔记；materials 保存网页导入文本；progress 按题 id 保存 attempts/wrong/streak/due/last/lastCorrect；sessions 按本地 YYYY-MM-DD 保存每日 ids/answers；extraPractice 保存当前加练日期、轮次、启用状态和答案；favorites 为收藏 id 数组。

validateBackup() 处理恢复和启动读取，兼容旧备份缺少 knowledge、favorites、extraPractice。save() 写入本地数据。新增字段必须兼容旧备份，不能改 key 或清空数据。

## 行为入口

- startDaily()：仅当当天没有记录时抽题，按到期错题、其他到期题、未学题、未到期题排序。
- pickReviewQuestions()：候选按已有顺序抽取，优先 18 道客观和 2 道回忆，不足用现有题补充，最多 20。这个配比优先于完全避重，相邻两轮可能重复。
- startExtraPractice()：优先上一轮未出现的题，替换当前加练轮次但不改每日 sessions。历史掌握进度保留。
- grade()：每轮每题只提交一次，更新 progress；回忆自评，其他题自动判分。
- matching 的 selected[i] 是左侧 i 配到的右侧下标，-1 表示未配；必须按位置判分，不能用多选题的集合比较。
- mergeLearningPack()：全部校验后按 id 追加，重复 id 跳过；启动时自动载入内置内容。工具链路题有专门的 recall→matching 兼容迁移。
- 知识库、收藏、错题专项轮次临时保存在 practice，刷新不保留轮次答案视图；已提交的长期 progress 会保存。每日与加练保存已提交答案，输入中未提交的草稿不保证刷新保留。

## 修改验证

修改前后运行 node verify.cjs。内容修改运行 node build-learning-pack.cjs，检查导出差异。UI 修改额外验证对应题型、提交解析、刷新及窄屏；现有测试不覆盖真实布局。

提交前 git diff、git status，检查无个人备份与临时文件。推送 GitHub 只是保存仓库，没有自动发布服务。

## 常见问题

- node 无法识别：安装 Node.js 后重新打开终端，检查 node --version。
- 4173 被占用：先打开固定地址确认是否已有拾题；若是其他程序占用，停止对应服务。不要随意换端口而误以为数据丢失。
- 新 JS 返回 404：更新 server.cjs 白名单和 index.html 加载顺序。
- 同 id 新题未覆盖旧题：这是去重设计，使用新 id 或编写兼容迁移。
- 存储失败：先导出备份，检查浏览器容量与设置，不要先清除数据。
