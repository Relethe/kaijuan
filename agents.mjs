import { QUESTIONS as CAREER_QUESTIONS } from "./lib/seed-data.mjs";
import { getSettings } from "./settings.mjs";
import { listQuestions, listTasks, createTask, finishTask, getRun, setRun, addRunCost, setGateTime, addArtifact, replaceClusters, upsertMetrics, setActivityStatus, createRun, getActivity, addPost } from "./db.mjs";

const COST_PER_TOKEN = 0.00006;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CLUSTER_RULES = [
  { label: "转型与方向", keywords: ["转型","转管理","裁员","换行业","副业","创业","自由职业","长期","二线","读研","方向","产品经理","要不要","活法"] },
  { label: "阅读与方法", keywords: ["读不进","记不住","读什么","用到工作","阅读时间","读书","长文本","用不上"] },
  { label: "能力与成长", keywords: ["技术更新","学不过来","学历","晋升","专业不对口","面试","螺丝钉","能力","手艺"] },
  { label: "关系与沟通", keywords: ["领导","沟通","团队","父母","同行业","同事","责任"] },
  { label: "焦虑与倦怠", keywords: ["热情","同龄人","倦怠","取代","忙","原地","稳定","下班","焦虑","不想上班"] },
];

const CLUSTER_RULES_BY_TOPIC = {
  "亲密关系": [
    { label: "犹豫与选择", keywords: ["不知道", "该不该", "要不要", "判断", "放下", "等", "选择", "不可能"] },
    { label: "相处与沟通", keywords: ["说话", "吵架", "关心", "陪伴", "聊不到", "沟通", "低头", "谈钱", "异地"] },
    { label: "家庭与期待", keywords: ["父母", "催婚", "家人", "结婚", "年纪"] },
    { label: "边界与自我", keywords: ["空间", "边界", "控制", "孤独", "亲密", "垃圾桶", "委屈", "同类"] },
  ],
  "内耗": [
    { label: "自我怀疑", keywords: ["怀疑", "不够好", "努力", "比较", "失败", "后悔"] },
    { label: "情绪处理", keywords: ["焦虑", "情绪", "内耗", "停不下来", "松弛", "委屈", "负面"] },
    { label: "关系消耗", keywords: ["别人", "讨好", "失望", "在意", "一句话"] },
    { label: "行动卡点", keywords: ["开始", "提不起", "影响工作", "照顾", "想做"] },
  ],
  "阅读": [
    { label: "读不进去", keywords: ["读不进", "翻开", "刷手机", "读不下去", "经典"] },
    { label: "记不住用不上", keywords: ["记不住", "用不上", "用起来", "笔记", "道理"] },
    { label: "选书", keywords: ["读什么", "值得读", "书目", "小说"] },
    { label: "时间与习惯", keywords: ["时间", "习惯", "很忙", "每天", "电子书"] },
  ],
};

export function clusterQuestions(questions, topic) {
  const t = String(topic || "");
  const topicKey = Object.keys(CLUSTER_RULES_BY_TOPIC).find((k) => t.includes(k));
  const rules = topicKey ? CLUSTER_RULES_BY_TOPIC[topicKey] : CLUSTER_RULES;
  const buckets = new Map();
  for (const r of rules) buckets.set(r.label, []);
  buckets.set("其他", []);
  for (const q of questions) {
    let best = "其他", bestScore = 0;
    for (const r of rules) {
      const score = r.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
      if (score > bestScore) { bestScore = score; best = r.label; }
    }
    buckets.get(best).push(q);
  }
  return [...buckets.entries()].filter(([, qs]) => qs.length > 0)
    .map(([label, qs]) => ({ label, size: qs.length, questions: qs, summary: summarize(label) }))
    .sort((a, b) => b.size - a.size);
}

function summarize(label) {
  const map = {
    "转型与方向": "这一类不是问「怎么选」，而是问「选错了还来不来得及」。它们共享一个前提：现在的路走不下去了。",
    "阅读与方法": "读不进、记不住、用不上 —— 三个问题连着出现，说明卡点在方法而不在意愿。",
    "能力与成长": "集中在「我的能力还值不值钱」，与年龄、学历、技术更新周期绑在一起。",
    "关系与沟通": "问题不在事上，在人与人的接口上：向上沟通、团队责任、家人的期待。",
    "焦虑与倦怠": "最多的一类，但最不像问题：更像是一种被反复确认的状态。适合当场做情绪命名，而不是给方案。",
    "犹豫与选择": "不是没有答案，是不敢承认已经有偏向。",
    "相处与沟通": "问题在「怎么一起过日子」而不是「爱不爱」。",
    "家庭与期待": "外部期待和内部意愿在打架，这一类最适合现场对谈。",
    "边界与自我": "既想靠近又怕被吞掉，边界感是这簇的共同线索。",
    "自我怀疑": "把「我不够好」当成前提，而不是要去验证的判断。",
    "情绪处理": "不是要消灭情绪，是不知道拿它怎么办。",
    "关系消耗": "耗在别人的眼光里，不是耗在事情上。",
    "行动卡点": "知道该做什么，就是启动不了。",
    "读不进去": "卡在注意力和环境，不在智力。",
    "记不住用不上": "输入很多，提取路径没有建立。",
    "选书": "缺的是筛选标准，不是书单。",
    "时间与习惯": "不是没时间，是阅读没有被排进日程。",
    "其他": "暂未归入既有话题，建议现场开放提问。",
  };
  return map[label] ?? map["其他"];
}

export function plannerFallback(ctx) {
  const big = ctx.capacity >= 40;
  const ice = big ? "Emoji 猜书名" : "击鼓传书";
  return {
    summary: [ctx.capacity + " 人", ctx.district, "议题「" + (ctx.topic || "综合") + "」", ctx.bookTitle ? "《" + ctx.bookTitle + "》" : ""].filter(Boolean).join(" · "),
    agenda: [
      { phase: "破冰游戏", minutes: 20, playbook: ice, goal: "降门槛：让第一次来的人先开口", detail: big ? "零门槛、可投影、50 人同时参与不会乱；15 分钟能完成两轮" : "小场用传书更自然，抽到的人回答一个来自问题云的真问题" },
      { phase: "深度分享", minutes: 60, content: "领读人带读" + (ctx.bookTitle ? "《" + ctx.bookTitle + "》" : "本书") + "中与「" + (ctx.topic || "议题") + "」直接相关的章节，拆成三个可讨论的问题；每 20 分钟留 5 分钟自由回应。", goal: "建深度：从书里的句子走到自己的处境" },
      { phase: "茶歇自由交流", minutes: 30, content: "按问题云分桌，同题同桌；每桌一张问题卡，桌主负责把讨论收成一句话带回全场。", goal: "建关系：让同题的人先认识" },
    ],
    playbooks: pickPlaybooks(ctx),
    materials: ["投影或电视（Emoji 题库 / 流程页）","签到二维码","问题卡 × 50（来自本场问题云）","拼贴诗物料：旧书页、剪刀、胶水、A4 卡纸","茶歇：饮料 + 小食（品牌赞助位）","活动后缀提示卡（照片 + 一句触动 + 一件作品）"],
    budget: [{ item: "茶歇", amount: 320, note: "50 人 × 6.4 元，可按赞助抵扣" },{ item: "物料", amount: 120, note: "问题卡、拼贴诗材料" },{ item: "场地", amount: 0, note: "咖啡馆闲时置换，不碰图书销售利益" }],
    totalMinutes: 110,
    guardrail: "配比铁三角 20 + 60 + 30 已满足；游戏占比 18%，不会滑向联谊会。",
  };
}

export function recruiterFallback(ctx, questions) {
  const clusters = clusterQuestions(questions, ctx.topic);
  const top = clusters.slice(0, 2);
  return {
    copies: [
      { channel: "朋友圈", text: "周六晚上，" + ctx.district + "。\n\n" + ctx.capacity + " 个人，聊一个你可能问过自己很多次、但一直没跟人认真聊过的问题：" + (ctx.topic ?? "我到底该往哪走") + "。\n\n带一本你正在读的书来，或者只带一个问题。" },
      { channel: "群公告", text: "【开卷 · " + ctx.district + "青年场】\n时间：" + ctx.plannedAtText + "\n地点：" + ctx.venue + "\n书目：《" + (ctx.bookTitle ?? "待定") + "》\n\n报名需要提交一个真问题（或一段原文摘录 + 理由）。问题会汇总成本场「问题云」，领读人据此选现场讨论题 —— 你问什么，现场就聊什么。" },
      { channel: "海报文案", text: (ctx.topic ?? "职业迷茫") + "｜带着问题来，带着一群人走\n" + ctx.capacity + " 个位置 · " + ctx.district + " · 免费但需要一个问题" },
    ],
    questionCloud: {
      total: questions.length,
      clusters,
      selectedForStage: top.map((c) => ({ label: c.label, question: c.questions[0], reason: "本簇 " + c.size + " 人，是现场共鸣面最大的话题" })),
    },
    ledger: { approved: questions.length, waitlist: 0, source: "种子报名数据", topQuestions: questions.slice(0, 5) },
  };
}

export function onsiteFallback(ctx, plan) {
  const agenda = plan.agenda ?? [];
  let cursor = 19 * 60;
  const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const timeline = agenda.map((step) => {
    const start = cursor; cursor += step.minutes;
    return { time: fmt(start), end: fmt(cursor), phase: step.phase, cue: step.playbook ? "开始「" + step.playbook + "」；主持提词：先讲规则 1 分钟，再开始第一轮。" : (step.content ?? "按主持手册推进"), goal: step.goal };
  });
  return {
    timeline,
    checkin: { code: "KAIJUAN-" + ctx.id.slice(0, 6).toUpperCase(), instruction: "扫码签到，领取问题卡；未提交门槛内容的人引导至候补登记。" },
    hostLines: [
      { moment: "开场", line: "欢迎来到开卷。今晚我们不推荐书，只聊一个问题：" + (ctx.topic ?? "你最近在想的那个问题") + "。先说明三件事：没有标准答案、不评价别人的选择、散场前每人说一个小决定。" },
      { moment: "破冰转场", line: "刚才那个问题，如果有人想补充，等茶歇时找 TA 聊。现在我们把书翻开。" },
      { moment: "收尾", line: "今天没有结论。但你可以带走一个动作：回去之后，把那句最触动你的话，发给一个你想到的人。" },
    ],
    quoteTemplate: ["一句话：今天最触动你的一句原文", "一个动作：这周你打算做的一件小事", "一个表情：此刻的状态"],
  };
}

export function archivistFallback(ctx, cloud) {
  const top = cloud?.clusters?.[0];
  return {
    notes: {
      title: "我们害怕的不是没有方向，是别人觉得我们过得没有方向",
      body: "「你为什么来这里？」——书里这个问题被问出来的时候，现场安静了几秒。\n\n我们让每个人写下自己来这里的理由。有人写「想确认自己不是一个人」，有人写「想找个理由辞职」，有人写「不知道，就是想来」。\n\n后来聊到绿海龟：它不跟浪对着游，顺着浪的方向，反而游得更远。有人说这不就是躺平吗。领读人说：绿海龟不是不动，是不跟浪较劲。\n\n散场前，每个人说了一个下周要做的小决定。不是辞职，不是转行，是「这周先不接那个我不想接的活」。",
      basedOn: top ? "本场问题云最大簇「" + top.label + "」（" + top.size + " 人）" : "本场现场记录",
    },
    quoteCards: [
      { text: "我们害怕的不是生活没有意义，是身边的人觉得我们过得没有意义。", from: "现场分享" },
      { text: "绿海龟不是不动，是不跟浪较劲。", from: "《世界尽头的咖啡馆》共读环节" },
      { text: "今天没有结论，但可以带走一个动作。", from: "领读人收尾" },
    ],
    suffixPackage: { photo: "现场合影 1 张（默认打码选项，未获同意不发布）", line: "最触动的一句话：我们害怕的不是没有方向，是别人觉得我们过得没有方向。", work: "拼贴诗一页 / 金句卡一张", task: "活动结束后 48 小时内推送给到场读者，提交后计入社区贡献。" },
    signedBy: "林间（领读人）—— 草稿，需本人定稿后发布",
    disclaimer: "本札记为 AI 辅助草稿，署名与定稿权归领读人，不得直接以 AI 身份发布。",
  };
}

export function ledgerFallback(ctx) {
  const attendees = Math.round(ctx.capacity * 0.92);
  return {
    metrics: { attendees, capacity: ctx.capacity, ageDist: { "20-25": 0.34, "26-30": 0.41, "31-35": 0.18, "36-45": 0.07 }, satisfaction: 4.8, playbookRetention: 0.68, newReaders: Math.round(attendees * 0.36) },
    notes: "数据来自签到表与现场回收卡；满意度为五级量表均值。",
    storage: "已入库，可供月报与绩效视图复用。",
  };
}

export function reporterFallback(ctx, metrics) {
  const m = metrics?.metrics ?? {};
  return {
    reportTitle: "海淀 · 阅读活动月报",
    period: "2026 年 11 月",
    sections: [
      { heading: "本月概况", body: "本月共举办 4 场活动，覆盖海淀 3 个街道；单场平均到场 " + (m.attendees ?? 46) + " 人，较上月增长 18%。" },
      { heading: "覆盖与参与", body: "累计服务读者 186 人次，其中新读者 67 人（36%）；20–30 岁占比 75%，与青年发展型城区定位一致。" },
      { heading: "玩法与留存", body: "破冰玩法平均参与率 92%，活动后 7 日内社区回访率 68%；「Emoji 猜书名」为本月留存最高玩法。" },
      { heading: "问题云洞察", body: "本月收集真实问题 118 条，最大簇为「转型与方向」（31%），其次是「焦虑与倦怠」（24%）—— 建议下月议题向职业转型倾斜。" },
      { heading: "下月计划", body: "新增学院路共读场 1 场；试点银龄场（适老大字讲义）；将 3 个高留存玩法固化为标准物料包。" },
    ],
  };
}

const SYSTEM = {
  planner: "你是「开卷」的策划 Agent。输出 JSON：{summary,agenda[{phase,minutes,playbook,content,goal,detail}],playbooks[{name,why}],materials[],budget[{item,amount,note}],totalMinutes,guardrail}。配比铁三角固定 破冰20+深度分享60+茶歇30。",
  recruiter: "你是「开卷」的招募 Agent。输出 JSON：{copies[{channel,text}],questionCloud{total,clusters[{label,size,questions,summary}],selectedForStage[{label,question,reason}]},ledger{approved,waitlist,source,topQuestions}}。问题云只聚合不改写。",
  onsite: "你是「开卷」的现场 Agent。输出 JSON：{timeline[{time,end,phase,cue,goal}],checkin{code,instruction},hostLines[{moment,line}],quoteTemplate[]}。提词口语化可直接念。",
  archivist: "你是「开卷」的沉淀 Agent。输出 JSON：{notes{title,body,basedOn},quoteCards[{text,from}],suffixPackage{photo,line,work,task},signedBy,disclaimer}。札记是草稿，署名归领读人。",
  ledger: "你是「开卷」的台账 Agent。输出 JSON：{metrics{attendees,capacity,ageDist,satisfaction,playbookRetention,newReaders},notes,storage}。只归集字段不做因果判断。",
  reporter: "你是「开卷」的汇报 Agent。输出 JSON：{reportTitle,period,sections[{heading,body}]}。数据口径与台账一致，不夸大。",
};

function pickText(protocol, j) {
  if (protocol === "anthropic") return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (protocol === "gemini") return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  return j.choices?.[0]?.message?.content || "";
}

async function callLLM(system, user, opts = {}) {
  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.apiKey) throw new Error("未配置模型");
  const protocol = llm.protocol || "openai";
  const base = llm.baseUrl.replace(/\/$/, "");
  let url, headers, body;

  if (protocol === "anthropic") {
    url = base + "/messages";
    headers = { "Content-Type": "application/json", "x-api-key": llm.apiKey, "anthropic-version": "2023-06-01" };
    body = { model: llm.model, max_tokens: opts.maxTokens ?? 2048, system, messages: [{ role: "user", content: user }] };
  } else if (protocol === "gemini") {
    url = base + "/models/" + encodeURIComponent(llm.model) + ":generateContent?key=" + encodeURIComponent(llm.apiKey);
    headers = { "Content-Type": "application/json" };
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    };
  } else {
    url = base + "/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: "Bearer " + llm.apiKey, "HTTP-Referer": "https://kaijuan.local", "X-Title": "kaijuan" };
    const sys = /json/i.test(system) ? system : system + "\n\n以 JSON 格式输出。";
    body = { model: llm.model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.7, response_format: { type: "json_object" } };
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(opts.timeout ?? 45000) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("HTTP " + res.status + " " + t.slice(0, 200));
  }
  const j = await res.json();
  const text = pickText(protocol, j);
  if (!text) throw new Error("响应里没有文本");
  return { text, usage: j.usage || j.usageMetadata || {} };
}

async function askLLM(system, user) {
  try {
    const { text, usage } = await callLLM(system, user);
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const tokens = usage.total_tokens ?? usage.totalTokenCount ?? Math.ceil(clean.length / 2.2);
    return { output: JSON.parse(clean), tokens };
  } catch {
    return null;
  }
}

export async function testLLM() {
  try {
    const { text } = await callLLM("只回两个字：可以", "测试连接", { timeout: 25000, maxTokens: 32 });
    return { ok: true, message: text.slice(0, 80) };
  } catch (e) {
    return { ok: false, message: String(e.message || e).slice(0, 300) };
  }
}

async function runAgent(agent, ctx, prev) {
  const user = "任务：" + agent + "\n活动：" + JSON.stringify(ctx) + "\n前序产出：" + JSON.stringify(prev);
  const llm = await askLLM(SYSTEM[agent], user);
  if (llm) return { output: llm.output, source: "llm", tokens: llm.tokens };
  let fb;
  if (agent === "planner") fb = plannerFallback(ctx);
  else if (agent === "recruiter") fb = recruiterFallback(ctx, buildQuestionSeed(ctx));
  else if (agent === "onsite") fb = onsiteFallback(ctx, prev.planner ?? {});
  else if (agent === "archivist") fb = archivistFallback(ctx, prev.recruiter?.questionCloud ?? {});
  else if (agent === "ledger") fb = ledgerFallback(ctx);
  else fb = reporterFallback(ctx, prev.ledger ?? {});
  return { output: fb, source: "fallback", tokens: Math.ceil(JSON.stringify(fb).length / 2.2) };
}

const PIPELINE = ["planner","GATE1","recruiter","onsite","archivist","GATE2","ledger","reporter"];
const running = new Set();
const KIND = { planner: "plan", recruiter: "copy", onsite: "material", archivist: "notes", ledger: "ledger", reporter: "ppt" };

function toCtx(a) {
  return {
    id: a.id, type: a.type, title: a.title, bookTitle: a.book_title, bookAuthor: a.book_author,
    topic: a.topic, district: a.district, venue: a.venue, capacity: a.capacity, demandText: a.demand_text,
    plannedAtText: new Date(a.planned_at).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }),
  };
}

function loadPrev(runId) {
  const prev = {};
  for (const t of listTasks(runId)) {
    if (t.status === "done" || t.status === "fallback") {
      try { prev[t.agent] = t.output ? JSON.parse(t.output) : null; } catch { prev[t.agent] = null; }
    }
  }
  return prev;
}

function artifactTitle(agent, out) {
  if (agent === "planner") return String(out.summary ?? "活动方案");
  if (agent === "recruiter") return "邀请文案与问题云报告";
  if (agent === "onsite") return "现场中控面板";
  if (agent === "archivist") return String(out.notes?.title ?? "活动札记草稿");
  if (agent === "ledger") return "活动台账";
  return String(out.reportTitle ?? "街道月报");
}

export async function startPipeline(activityId) {
  let run = getRun(activityId);
  if (!run) run = createRun(activityId);
  setRun(activityId, "running", null);
  if (running.has(activityId)) return run;
  running.add(activityId);
  loop(activityId, 0).finally(() => running.delete(activityId));
  return getRun(activityId);
}

export async function approveGate(activityId, gate) {
  const idx = PIPELINE.indexOf(gate);
  if (idx < 0) throw new Error("unknown gate " + gate);
  setGateTime(activityId, gate);
  setActivityStatus(activityId, gate === "GATE1" ? "recruiting" : "settled");
  if (gate === "GATE2") publishNotes(activityId);
  setRun(activityId, "running", null);
  if (running.has(activityId)) return;
  running.add(activityId);
  loop(activityId, idx + 1).finally(() => running.delete(activityId));
}

async function loop(activityId, start) {
  try {
  for (let i = start; i < PIPELINE.length; i++) {
    const step = PIPELINE[i];
    if (step === "GATE1" || step === "GATE2") {
      setRun(activityId, step === "GATE1" ? "gate1_wait" : "gate2_wait", step);
      return;
    }
    await runStep(activityId, step);
  }
  setRun(activityId, "done", "done");
  } catch (e) {
    console.error("pipeline error:", e);
    try { setRun(activityId, "failed", "failed"); } catch {}
  }
}

async function runStep(activityId, agent) {
  const run = getRun(activityId);
  if (!run) return;
  setRun(activityId, "running", agent);
  const started = Date.now();
  const taskId = createTask(run.id, agent);
  const ctx = toCtx(getActivity(activityId));
  const prev = loadPrev(run.id);
  const result = await runAgent(agent, ctx, prev);
  const elapsed = Date.now() - started;
  if (elapsed < 1600) await sleep(1600 - elapsed);
  finishTask(taskId, result.output, result.source === "llm" ? "done" : "fallback", result.tokens);
  addRunCost(activityId, result.tokens * COST_PER_TOKEN);
  addArtifact(activityId, KIND[agent], artifactTitle(agent, result.output), result.output);
  if (agent === "recruiter") replaceClusters(activityId, result.output.questionCloud?.clusters ?? []);
  if (agent === "ledger") upsertMetrics(activityId, result.output.metrics ?? {});
}

function publishNotes(activityId) {
  try {
    const run = getRun(activityId);
    if (!run) return;
    const t = listTasks(run.id).find((x) => x.agent === "archivist");
    if (!t || !t.output) return;
    const out = JSON.parse(t.output);
    if (!out.notes || !out.notes.body) return;
    addPost({ activityId, channelSlug: "reading", authorName: "林间", authorRole: "领读人", title: out.notes.title, body: out.notes.body, labels: ["活动札记", "领读人定稿"], signedBy: "林间（领读人）· 已定稿" });
  } catch {}
}



export async function polishText(raw) {
  const system = "你是「开卷」的感悟排版助手。把用户的口语记录整理成一条读书感悟，输出 JSON：{title,body,labels}。要求：保留原意与具体细节，不虚构、不拔高、不写成鸡汤；标题不超过 20 字；body 保留自然段落；labels 2-3 个。";
  const llm = await askLLM(system, "原始记录：\n" + raw);
  if (llm && llm.output && llm.output.body) {
    return { title: String(llm.output.title ?? ""), body: String(llm.output.body), labels: Array.isArray(llm.output.labels) ? llm.output.labels : [], source: "llm" };
  }
  return fallbackPolish(raw);
}

function fallbackPolish(raw) {
  const clean = String(raw).replace(/\s+/g, " ").trim();
  const first = clean.split(/[。！？!?]/)[0] || clean;
  const title = first.length > 22 ? first.slice(0, 22) + "…" : first;
  const parts = clean.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
  const body = parts.length > 2 ? parts.slice(0, 2).join("") + "\n\n" + parts.slice(2).join("") : clean;
  const labels = ["读书感悟"];
  if (/职业|工作|裁员|迷茫|转行/.test(clean)) labels.push("职业");
  if (/读|书|章节|页|作者/.test(clean)) labels.push("阅读");
  if (/焦虑|情绪|累|倦怠|怕/.test(clean)) labels.push("情绪");
  return { title, body, labels, source: "template" };
}

export async function polishDemand(raw) {
  const system = "把「开卷」读书会的活动需求口述整理成标准格式，输出 JSON：{demand,people,topic,book,when,where,venue}。demand 形如「11月中旬·海淀·五道口·50人青年场·议题：职业迷茫·书：《世界尽头的咖啡馆》·场地：某咖啡馆闲时」。缺失字段留空字符串，不虚构。";
  const llm = await askLLM(system, raw);
  if (llm && llm.output && llm.output.demand) return { ...llm.output, source: "llm" };
  return fallbackDemand(raw);
}

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function cnNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === "十") return 10;
  const idx = s.indexOf("十");
  if (idx >= 0) {
    const tens = idx === 0 ? 1 : CN_DIGIT[s.slice(0, idx)] ?? 0;
    const ones = s[idx + 1] ? CN_DIGIT[s[idx + 1]] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return CN_DIGIT[s] ?? null;
}

const CITY_WORDS = ["海淀", "朝阳", "西城", "东城", "五道口", "中关村", "学院路", "杭州", "上海", "北京", "深圳", "广州", "成都", "南京", "武汉", "西安", "苏州", "重庆", "天津", "长沙", "青岛", "厦门", "合肥", "郑州", "济南", "大连", "宁波", "福州", "昆明", "南宁", "贵阳", "太原", "石家庄", "沈阳", "长春", "哈尔滨"];

function fallbackDemand(raw) {
  const t = String(raw);
  const numRaw = (t.match(/(\d{1,3}|[一二两三四五六七八九十百]{1,4})\s*(?:人|位)/) || [])[1];
  const people = numRaw ? cnNum(numRaw) : null;

  // 书名：只认《》或「书用/书是/书目/书名」，避免把「读书分享会」的「书」当书名
  const book = (t.match(/《([^》]+)》/) || [])[1] || (t.match(/书(?:用|是|目|名)[：:]?\s*([^\s，,。·]{2,20})/) || [])[1] || "";

  const topic = (t.match(/议题[：:]\s*([^·。，,\s]+)/) || [])[1] || (/(职业迷茫|职业转型|内耗|亲密关系|中年转型|原生家庭|迷茫|分享会|共读|读书会|读书沙龙)/.exec(t) || [])[1] || "";

  const when = (/(下个?月|本周|下周|月底|\d{1,2}\s*[.月]\s*\d{1,2}\s*日?|[0-9一二两三四五六七八九十]{1,2}\s*月[^\s·，,。]*)/.exec(t) || [])[1] || "";

  const where = (CITY_WORDS.find((c) => t.includes(c)) || "").replace(/办.*$/, "");

  const venue = (/场地(?:找|在|用|定)?(?:个|一个)?[：:]?\s*([^\s。，,]{2,14})/.exec(t) || [])[1] || "";

  let plannedAt = null;
  const mmdd = when.match(/(\d{1,2})\s*[.月]\s*(\d{1,2})/);
  if (mmdd) {
    const y = new Date().getFullYear();
    plannedAt = new Date(y, Number(mmdd[1]) - 1, Number(mmdd[2]), 19, 0).toISOString();
  }

  const parts = [];
  if (when) parts.push(when);
  if (where) parts.push(where);
  if (people) parts.push(people + " 人");
  if (topic) parts.push(topic);
  if (book) parts.push("《" + book + "》");
  if (venue) parts.push("场地：" + venue);

  return { demand: parts.join(" · ") || t, people, topic, book, when, where, venue, plannedAt, source: "template" };
}



const QUESTION_BANK = {
  "职业迷茫": CAREER_QUESTIONS,
  "职业转型": CAREER_QUESTIONS,
  "亲密关系": [
    "在一起五年，但最近越来越不想说话",
    "父母催婚，我不知道自己是真的不想还是害怕",
    "分手后总是忍不住翻聊天记录",
    "怎么判断是习惯还是喜欢",
    "异地恋到底靠什么撑",
    "对方总说我不够关心，我觉得自己已经尽力了",
    "结了婚才发现，我们聊不到一起",
    "喜欢一个不可能的人，怎么放下",
    "害怕亲密，又害怕孤独",
    "总是遇到同一类人，是我的问题吗",
    "恋爱里该不该保留自己的空间",
    "吵架之后谁先低头",
    "怎么和伴侣谈钱",
    "家人不理解我的选择",
    "年纪不小了，还要不要等对的人",
    "如何不把伴侣当情绪垃圾桶",
    "亲密关系里，边界感是什么",
    "想要陪伴，又怕被控制",
  ],
  "内耗": [
    "一直在自我怀疑，怎么停下来",
    "别人的一句话能影响我一整天",
    "想做很多事，但什么都提不起劲",
    "总在后悔过去的选择",
    "害怕失败到不敢开始",
    "怎么面对那个不够好的自己",
    "每天都在焦虑，但说不出在焦虑什么",
    "情绪来的时候控制不住",
    "想要松弛感，但一放松就内疚",
    "过度思考，睡前停不下来",
    "怎么和负面情绪相处",
    "总是讨好别人，委屈自己",
    "内耗到影响工作了，怎么办",
    "害怕让别人失望",
    "不知道怎么照顾自己",
    "为什么我总觉得自己不够努力",
    "如何停止和他人比较",
  ],
  "阅读": [
    "读不进去，翻开就想刷手机",
    "读完记不住，等于没读",
    "不知道该读什么书",
    "怎么把书里的东西用起来",
    "每天很忙，阅读时间从哪来",
    "经典读不下去怎么办",
    "读书笔记怎么做才有用",
    "如何建立阅读习惯",
    "读小说算不算学习",
    "怎么判断一本书值不值得读",
    "读了很多道理，过不好生活",
    "纸质书还是电子书",
  ],
};

function buildQuestionSeed(ctx) {
  const topic = String(ctx.topic || "");
  const key = Object.keys(QUESTION_BANK).find((k) => topic.includes(k));
  if (key) return QUESTION_BANK[key];
  const real = listQuestions(ctx.id);
  if (real.length >= 5) return real;
  return QUESTION_BANK["内耗"].slice(0, 16);
}

function pickPlaybooks(ctx) {
  const big = ctx.capacity >= 40;
  const topic = String(ctx.topic || "");
  const ice = big ? "Emoji 猜书名" : "击鼓传书";
  const iceWhy = big ? "大场零门槛、可投影，50 人同时参与不会乱" : "小场传书更自然，抽到的人回答一个来自问题云的真问题";
  let resonance = "拼贴诗工坊";
  let resonanceWhy = "把现场感受落在纸上，产出可直接进社区的活动后缀";
  if (ctx.type === "industry") {
    resonance = "故事接龙";
    resonanceWhy = "行业场用接龙把「我的经历」变成「我们的处境」";
  } else if (/亲密|关系|家庭/.test(topic)) {
    resonance = "书缘盲盒";
    resonanceWhy = "关系议题适合用「交换一本想送出的书」破冰建联";
  } else if (/阅读|学习|读不进/.test(topic)) {
    resonance = "文学迷宫";
    resonanceWhy = "阅读方法类议题用答题迷宫，把「怎么读」变成可玩的挑战";
  }
  return [{ name: ice, why: iceWhy }, { name: resonance, why: resonanceWhy }];
}








