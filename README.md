# 开卷 · 黑客松 Demo

48 小时可演示的垂直切片：**中控台 Agent 流水线 + 读者端 H5**，数据全程联动。

## 跑起来

```powershell
git clone https://github.com/Relethe/kaijuan.git
cd kaijuan
node server.mjs
```

打开：

- http://localhost:3000/console — 运营中控台（主屏）
- http://localhost:3000/h5 — 读者端 H5（副屏）
- http://localhost:3000/ — 入口

**无需安装依赖**：Node 24 内置 `http` 与 `node:sqlite`，无构建步骤，启动 <1 秒，断网可跑。

## 演示流程

1. 中控台点「开始跑流水线」→ 策划 Agent 产出方案，停在 Gate 1
2. 点「确认方案」→ 招募 Agent 生成问题云，现场/沉淀 Agent 继续
3. 到 Gate 2，点「确认发布」→ 台账入库、汇报 Agent 生成月报
4. 切到读者端：社区状态从「筹备中」→「预热中」→「已结束」，`#读书感悟` 出现署名札记
5. 点「重置演示」可清空流水线重跑（保留历史活动与种子数据）

## 语音与 AI 排版

- **中控台「一句话需求」**：点「🎤 语音」口述，或打一段大白话后点「AI 排版」，自动整理成标准需求并回填，下方显示识别到的字段。
- **读者端「写感悟」**：同样支持语音 / 文字输入 → AI 排版 → 结果可改 → 发布到 `#读书感悟`。
- **STT 自动检测**：`.env` 未配云端时用浏览器内置识别；配了 `STT_BASE_URL` + `STT_API_KEY` 就走云端（OpenAI 兼容 `/audio/transcriptions`）。详见 [docs/STT接入.md](docs/STT接入.md)。

## 接真实模型

复制 `.env.example` 为 `.env`，填好后重启：

```
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_API_KEY=你的 key
LLM_MODEL=glm-4-flash
```

未配置时全部走模板兜底（页面显示「离线演示模式」），流程不中断。任一 Agent 失败也自动回放模板。

## 为什么不是 Next.js

原计划是 Next.js 15 + Prisma + SQLite。比赛现场网络 20–50 KB/s，`next`（22MB）与 `@prisma/client` 两次 tarball 超时，`node_modules` 装不成。

改用零依赖实现：

| 层 | 计划 | 实际 | 原因 |
|---|---|---|---|
| 服务端 | Next.js Route Handlers | Node 原生 `http` | 无安装、无构建 |
| 数据库 | Prisma + SQLite | `node:sqlite`（Node 24 内置） | 同上 |
| 前端 | React + Tailwind | 原生 HTML/CSS/JS | 同上 |

代价是没有 SSR 与组件化；收益是演示不会因网络或构建失败翻车。页面结构与设计 token 按前端设计指南 V1 实现，赛后可平移进 Next.js。

## 目录

```text
kaijuan/
├── server.mjs          # http 服务 + API + SSE
├── db.mjs              # 建表、种子、查询
├── agents.mjs          # 六 Agent + 编排循环 + 两处 Gate + 兜底
├── lib/seed-data.mjs   # 海淀种子数据（3 场历史活动 + 1 场主角 + 30 条报名）
├── data.db             # SQLite（首次启动自动生成，不入库；删掉即重置）
├── .env.example        # 配置模板（复制为 .env 后填写）
└── public/
    ├── index.html      # 入口
    ├── console.html/js # 中控台
    ├── h5.html/js      # 读者端
    └── app.css         # 设计系统（指南 §4.2 的色板与排版）
```

## 已知限制

- 月报是 HTML（可一键打印为 PDF），不是 .pptx；pptxgenjs 装不上，赛后接
- 未接登录，报名写入匿名读者
- SSE 每 500ms 推一次全量状态，本机演示足够；多客户端并发需换增量推送

---

## English

**Kaijuan (开卷, "open book")** — a 48-hour hackathon vertical slice: an operator console that drives a multi-agent pipeline, plus a reader-facing H5 feed, with data linked end to end.

The interesting part is *why it has no dependencies*. The original plan was Next.js 15 + Prisma + SQLite. On venue Wi-Fi (20–50 KB/s) both the `next` (22 MB) and `@prisma/client` tarballs timed out, so `node_modules` could never finish installing. It was rebuilt with **zero dependencies**:

| Layer | Planned | Actually used | Why |
|---|---|---|---|
| Server | Next.js Route Handlers | Node native `http` | no install, no build step |
| Database | Prisma + SQLite | `node:sqlite` (built into Node 24) | same |
| Frontend | React + Tailwind | plain HTML / CSS / JS | same |

No `npm install`, no bundler, starts in under a second, runs offline.

### Run it

```bash
git clone https://github.com/Relethe/kaijuan.git
cd kaijuan
node server.mjs
```

Requires **Node 24+** (for `node:sqlite`).

- `http://localhost:3000/console` — operator console (main screen): run the pipeline, confirm the two gates
- `http://localhost:3000/h5` — reader feed (secondary screen)
- `http://localhost:3000/` — entry

It works offline out of the box: with no LLM key configured, every agent falls back to templates and the demo still completes end to end. To use a real model, copy `.env.example` to `.env`, fill in `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (any OpenAI-compatible endpoint), and restart.

### Known limitations

- The monthly report is HTML (printable to PDF), not a `.pptx` — `pptxgenjs` could not be installed on site
- No authentication; enrollments are recorded as an anonymous reader
- SSE pushes the full state every 500 ms — fine for a single-client local demo, would need incremental patches for real concurrency

## License

[MIT](LICENSE) © 2026 Relethe

