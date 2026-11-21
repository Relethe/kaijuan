import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { seedIfEmpty, resetPipeline, addArtifact, updateActivity, getMainActivity, getActivity, listActivities, getRun, listTasks, listClusters, listPosts, listPlaybooks, getMetrics, listArtifacts, listEnrollments, addEnrollment, listQuestions } from "./db.mjs";
import { startPipeline, approveGate, clusterQuestions, polishText, polishDemand, testLLM } from "./agents.mjs";
import { getSettings, saveSettings, isLlmEnabled, PRESETS } from "./settings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
seedIfEmpty();
process.on("uncaughtException", (e) => console.error("uncaught:", e));
process.on("unhandledRejection", (e) => console.error("unhandled:", e));

const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const STEP_ORDER = ["planner", "GATE1", "recruiter", "onsite", "archivist", "GATE2", "ledger", "reporter"];
function snapshot() {
  const main = getMainActivity() ?? listActivities().at(-1);
  const run = main ? getRun(main.id) : null;
  const tasks = run ? listTasks(run.id) : [];
  return {
    llmEnabled: isLlmEnabled(),
    activity: main ?? null,
    activities: listActivities(),
    run: run ? { id: run.id, status: run.status, current: run.current, cost: run.llm_cost, gate1At: run.gate1_at, gate2At: run.gate2_at } : null,
    tasks: tasks.map((t) => ({ agent: t.agent, status: t.status, tokens: t.tokens, startedAt: t.started_at, output: t.output ? safeParse(t.output) : null })),
    progress: run ? {
      step: STEP_ORDER.indexOf(run.current) + 1,
      total: STEP_ORDER.length,
      current: run.current,
      runningSince: (tasks.find((t) => t.status === "running") || {}).started_at || null,
      gateWaiting: run.status === "gate1_wait" || run.status === "gate2_wait",
    } : null,
    clusters: main ? (listClusters(main.id).length ? listClusters(main.id).map((c) => ({ label: c.label, size: c.size, summary: c.summary, questions: safeParse(c.questions) ?? [] })) : clusterQuestions(listQuestions(main.id), main.topic)) : [],
    posts: listPosts("reading"),
    playbooks: listPlaybooks(),
    metrics: main ? getMetrics(main.id) : null,
    enrollments: main ? listEnrollments(main.id) : [],
    artifacts: main ? listArtifacts(main.id).map((a) => ({ kind: a.kind, title: a.title, at: a.created_at })) : [],
  };
}

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

const readBody = (req) => new Promise((resolve) => {
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 8e6) req.destroy(); });
  req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
});

function artifactOutput(activityId, agent) {
  const run = getRun(activityId);
  if (!run) return null;
  const t = listTasks(run.id).filter((x) => x.agent === agent && (x.status === "done" || x.status === "fallback")).at(-1);
  if (!t || !t.output) return null;
  try { return JSON.parse(t.output); } catch { return null; }
}

function reportHtml(activityId) {
  const rep = artifactOutput(activityId, "reporter") ?? { reportTitle: "海淀 · 阅读活动月报", period: "2026 年 11 月", sections: [] };
  const m = getMetrics(activityId) ?? {};
  const rows = (rep.sections ?? []).map((s) => "<section><h2>" + s.heading + "</h2><p>" + s.body + "</p></section>").join("");
  return "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>" + rep.reportTitle + "</title>" +
    "<style>body{font-family:system-ui,'Microsoft YaHei',sans-serif;max-width:820px;margin:48px auto;padding:0 24px;color:#26221D;background:#FAF7F2;line-height:1.8}" +
    "h1{font-size:26px;border-bottom:2px solid #843C2D;padding-bottom:12px}h2{font-size:18px;margin-top:32px;color:#843C2D}" +
    ".kpi{display:flex;gap:24px;margin:24px 0;padding:20px;background:#FFFDF9;border:1px solid #DDD4C7;border-radius:12px}" +
    ".kpi div{flex:1}.kpi b{display:block;font-size:28px;color:#843C2D}.kpi span{font-size:13px;color:#665F55}" +
    "@media print{body{background:#fff}}</style></head><body>" +
    "<h1>" + rep.reportTitle + "</h1><p style=\"color:#665F55\">" + (rep.period ?? "") + " · 演示数据</p>" +
    "<div class=\"kpi\"><div><b>" + (m.attendees ?? 46) + "</b><span>本场到场</span></div>" +
    "<div><b>" + (m.satisfaction ?? 4.8) + "</b><span>满意度</span></div>" +
    "<div><b>" + Math.round((m.playbook_retention ?? 0.68) * 100) + "%</b><span>玩法留存</span></div></div>" +
    rows + "<p style=\"margin-top:40px;color:#665F55;font-size:13px\">本报表由开卷汇报 Agent 生成 · 可打印为 PDF 归档</p></body></html>";
}

let localStt = { available: false, engine: "", checked: false, note: "未检测" };

function detectLocalStt() {
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.Speech; [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | ForEach-Object { $_.Culture.Name }"], { encoding: "utf8", timeout: 20000 });
    const langs = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    let hasFfmpeg = false;
    try { hasFfmpeg = Boolean(execFileSync("where.exe", ["ffmpeg"], { encoding: "utf8", timeout: 5000 }).trim()); } catch {}
    localStt = langs.includes("zh-CN") && hasFfmpeg
      ? { available: true, engine: "Windows Speech Recognition (zh-CN)", langs, hasFfmpeg, checked: true, note: "本机自带，离线可用" }
      : { available: false, engine: "", langs, hasFfmpeg, checked: true, note: langs.length ? "有识别器但缺 ffmpeg" : "系统未安装中文识别器" };
  } catch (e) {
    const msg = String(e);
    localStt = { available: false, engine: "", checked: true, note: msg.includes("EPERM") ? "当前环境不允许调用系统语音（沙箱），直接在终端运行 node server.mjs 即可" : "检测失败：" + msg.slice(0, 80) };
  }
}
detectLocalStt();

async function localTranscribe(base64, mime) {
  const buf = Buffer.from(base64, "base64");
  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const ext = mime && mime.includes("wav") ? ".wav" : mime && mime.includes("ogg") ? ".ogg" : mime && mime.includes("mp4") ? ".m4a" : ".webm";
  const src = path.join(os.tmpdir(), "kj-" + stamp + ext);
  const wav = path.join(os.tmpdir(), "kj-" + stamp + "-16k.wav");
  try {
    fs.writeFileSync(src, buf);
    execFileSync("ffmpeg", ["-y", "-i", src, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], { timeout: 60000, stdio: "ignore" });
    const script = path.join(__dirname, "tools", "sapi-asr.ps1");
    const text = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], { encoding: "utf8", timeout: 90000, env: { ...process.env, KJ_WAV: wav } }).trim();
    return { text, engine: "sapi-zh-CN" };
  } finally {
    try { fs.unlinkSync(src); } catch {}
    try { fs.unlinkSync(wav); } catch {}
  }
}
const STT_PROVIDER = process.env.STT_PROVIDER || "auto";
const STT_BASE = process.env.STT_BASE_URL || "";
const STT_KEY = process.env.STT_API_KEY || "";
const STT_MODEL = process.env.STT_MODEL || "whisper-1";

function sttConfig() {
  const auto = STT_BASE && STT_KEY ? "openai-compatible" : "browser";
  const candidates = [];
  if (STT_BASE && STT_KEY) candidates.push("openai-compatible");
  candidates.push("browser");
  if (localStt.available) candidates.push("local");
  return {
    provider: STT_PROVIDER === "auto" ? auto : STT_PROVIDER,
    candidates,
    local: { available: localStt.available, engine: localStt.engine, note: localStt.note },
    model: STT_MODEL,
    hasKey: Boolean(STT_KEY),
    note: STT_PROVIDER === "auto" ? "自动检测：云端 > 浏览器 > 本机" : "手动指定",
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  if (p === "/api/state") return json(res, 200, snapshot());

  if (p === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
    let last = "";
    const tick = () => {
      const s = JSON.stringify(snapshot());
      if (s !== last) { last = s; res.write("data: " + s + "\n\n"); }
    };
    tick();
    const timer = setInterval(tick, 500);
    req.on("close", () => clearInterval(timer));
    return;
  }

  if (p === "/api/pipeline/start" && req.method === "POST") {
    const b = await readBody(req);
    const activityId = b.activityId || (getMainActivity() ?? listActivities().at(-1))?.id;
    if (!activityId) return json(res, 400, { error: "no activity" });
    if (b.demandText && String(b.demandText).trim()) {
      const parsed = await polishDemand(String(b.demandText).trim());
      const where = String(parsed.where || "").replace(/办.*$/, "");
      updateActivity(activityId, {
        demand_text: String(b.demandText).trim(),
        topic: parsed.topic || "综合",
        book_title: parsed.book || "",
        capacity: parsed.people || undefined,
        venue: parsed.venue || "",
        district: where || undefined,
        planned_at: parsed.plannedAt || undefined,
        title: [where, parsed.topic].filter(Boolean).join(" · ") || undefined,
      });
    }
    await startPipeline(activityId);
    return json(res, 200, snapshot());
  }

  if (p === "/api/pipeline/gate" && req.method === "POST") {
    const b = await readBody(req);
    const activityId = b.activityId || (getMainActivity() ?? listActivities().at(-1))?.id;
    if (!activityId) return json(res, 400, { error: "no activity" });
    if (b.edits) addArtifact(activityId, "plan_edits", "Gate 1 运营调整记录", b.edits);
    await approveGate(activityId, b.gate);
    return json(res, 200, snapshot());
  }

  if (p === "/api/reset" && req.method === "POST") {
    const id = (getMainActivity() ?? listActivities().at(-1))?.id;
    if (id) resetPipeline(id);
    return json(res, 200, snapshot());
  }

  if (p === "/api/settings" && req.method === "GET") {
    const st = getSettings();
    return json(res, 200, {
      presets: PRESETS,
      llm: { baseUrl: st.llm.baseUrl, model: st.llm.model, protocol: st.llm.protocol, hasKey: Boolean(st.llm.apiKey) },
      stt: { provider: st.stt.provider, baseUrl: st.stt.baseUrl, model: st.stt.model, hasKey: Boolean(st.stt.apiKey) },
      llmEnabled: isLlmEnabled(),
    });
  }

  if (p === "/api/settings" && req.method === "POST") {
    const b = await readBody(req);
    saveSettings({ llm: b.llm, stt: b.stt });
    return json(res, 200, { ok: true, llmEnabled: isLlmEnabled() });
  }

  if (p === "/api/settings/test" && req.method === "POST") {
    const { llm } = getSettings();
    if (!llm.baseUrl || !llm.apiKey) return json(res, 400, { error: "还没填 Base URL 和 Key" });
    return json(res, 200, await testLLM());
  }

  if (p === "/api/stt/config") {
    if (url.searchParams.get("refresh") === "1") detectLocalStt();
    return json(res, 200, sttConfig());
  }

if (p === "/api/stt" && req.method === "POST") {
    const b = await readBody(req);
    if (!b.audio) return json(res, 400, { error: "audio required" });
    const mode = b.mode || sttConfig().provider;
    if (mode === "local") {
      if (!localStt.available) return json(res, 400, { error: "本机未检测到可用语音识别（需要 Windows 中文识别器 + ffmpeg）" });
      try { return json(res, 200, await localTranscribe(b.audio, b.mime)); } catch (e) { return json(res, 502, { error: "本机识别失败：" + String(e).slice(0, 140) }); }
    }
    if (!STT_BASE || !STT_KEY) return json(res, 400, { error: "未配置云端 STT，请用浏览器识别、本机识别或填写 .env" });
    try {
      const fd = new FormData();
      fd.append("file", new Blob([Buffer.from(b.audio, "base64")], { type: b.mime || "audio/webm" }), "audio.webm");
      fd.append("model", STT_MODEL);
      const r2 = await fetch(STT_BASE.replace(/\/$/, "") + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + STT_KEY }, body: fd });
      if (!r2.ok) return json(res, 502, { error: "STT 服务返回 " + r2.status });
      const j = await r2.json();
      return json(res, 200, { text: j.text ?? "" });
    } catch (e) {
      return json(res, 502, { error: "STT 请求失败：" + String(e) });
    }
  }

  if (p === "/api/demand/polish" && req.method === "POST") {
    const b = await readBody(req);
    const raw = String(b.rawText || "").trim();
    if (!raw) return json(res, 400, { error: "rawText required" });
    return json(res, 200, { polished: await polishDemand(raw) });
  }

  if (p === "/api/compose" && req.method === "POST") {
    const b = await readBody(req);
    const raw = String(b.rawText || "").trim();
    if (!raw) return json(res, 400, { error: "rawText required" });
    const polished = await polishText(raw);
    if (b.preview) return json(res, 200, { polished });
    const id = (getMainActivity() ?? listActivities().at(-1))?.id;
    addPost({ activityId: id, channelSlug: b.channelSlug || "reading", authorName: b.authorName || "我", authorRole: "读者", title: String(b.title ?? polished.title), body: String(b.body ?? polished.body), labels: [...(Array.isArray(b.labels) ? b.labels : polished.labels || []), b.visibility === "self" ? "仅自己可见" : "公开"], signedBy: null });
    return json(res, 200, { polished, published: true });
  }

  if (p === "/api/enroll" && req.method === "POST") {
    const b = await readBody(req);
    const activityId = b.activityId || (getMainActivity() ?? listActivities().at(-1))?.id;
    if (!activityId) return json(res, 400, { error: "no activity" });
    addEnrollment({ activityId, readerId: "demo-reader", questionText: b.questionText, excerpt: b.excerpt, story: b.story });
    return json(res, 200, { ok: true });
  }

  if (p === "/api/report") return res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(reportHtml((getMainActivity() ?? listActivities().at(-1))?.id));

  const fileMap = { "/": "index.html", "/console": "console.html", "/h5": "h5.html" };
  const name = fileMap[p] ?? (p.startsWith("/") ? p.slice(1) : "");
  const filePath = path.join(__dirname, "public", name);
  if (name && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
    res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream" });
    return res.end(fs.readFileSync(filePath));
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, () => console.log("开卷 demo → http://localhost:" + PORT));




















