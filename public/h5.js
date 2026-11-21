let state = null;
let view = { name: "community", channel: "reading", enrollMode: "question" };
let region = "海淀";
let activityId = null;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "待定";
const CHANNELS = [
  { slug: "reading", name: "读书感悟", desc: "感悟与活动记录", unread: true },
  { slug: "questions", name: "阅读困惑", desc: "提问与回应", unread: true },
  { slug: "coread", name: "本周共读", desc: "《世界尽头的咖啡馆》", unread: false },
  { slug: "activities", name: "同城活动", desc: "海淀 · 五道口", unread: true },
  { slug: "play", name: "拼贴诗与轻玩法", desc: "现场作品与 Emoji 猜书名", unread: false },
];
const ACTIVITY_STATUS = {
  draft: { label: "筹备中", tone: "muted", text: "11 月青年场正在策划，频道已有往期沉淀" },
  recruiting: { label: "预热中", tone: "ai", text: "报名开放 · 门槛：带一个问题来" },
  live: { label: "进行中", tone: "ai", text: "现场进行中" },
  settled: { label: "已结束", tone: "ok", text: "札记已发布到 #读书感悟" },
  archived: { label: "已归档", tone: "muted", text: "" },
};
function taskOutput(agent) {
  const t = (state?.tasks || []).filter((x) => x.agent === agent && (x.status === "done" || x.status === "fallback")).at(-1);
  return t?.output ?? null;
}
function postsOf(channel) { return (state?.posts || []).filter((p) => p.channel_slug === channel); }

function renderCommunity() {
  if (region !== "海淀") {
    $("view").innerHTML = '<div class="h5-top"><div><div class="h5-title">开卷 · ' + region + '</div><div class="region">' + region + '</div></div><button class="region-btn" data-view="region">切换地域</button></div><div class="empty">这个区还没有社区</div>';
    return;
  }
  const a = state?.activity;
  const st = a ? (ACTIVITY_STATUS[a.status] ?? ACTIVITY_STATUS.draft) : null;
  const band = a
    ? '<div class="status-band"><span class="badge ' + (st.tone === "ai" ? "badge-ai" : "") + '">' + st.label + "</span><span>" + esc(st.text) + "</span>" + (a.status === "recruiting" ? '<button class="btn btn-primary" style="margin-left:auto;padding:4px 10px;min-height:30px;font-size:12px" data-view="activity">查看</button>' : "") + "</div>"
    : "";
  const chs = CHANNELS.map((c) => '<div class="ch" data-channel="' + c.slug + '"><span class="hash">#</span><div><div>' + esc(c.name) + '</div><div class="sub">' + esc(c.desc) + "</div></div>" + (c.unread ? '<span class="unread"></span>' : "") + "</div>").join("");
  $("view").innerHTML =
    '<div class="h5-top"><div><div class="h5-title">开卷 · ' + region + '</div><div class="region">' + region + ' · 社区成员 186</div></div><button class="region-btn" data-view="region">切换地域</button></div>' +
    band +
    '<div class="section-title">频道</div><div class="channels">' + chs + "</div>" +
    '<div class="empty">还没有感悟。写下第一条。</div>';
}

function renderChannel() {
  const ch = CHANNELS.find((c) => c.slug === view.channel) ?? CHANNELS[0];
  const posts = postsOf(view.channel);
  const list = posts.length
    ? posts.map((p) => {
        const labels = JSON.parse(p.labels ?? "[]");
        return '<article class="post"><div class="meta"><span class="avatar">' + esc((p.author_name || "读")[0]) + "</span><span>" + esc(p.author_name) + "</span><span>·</span><span>" + esc(p.author_role ?? "读者") + "</span><span>·</span><span>" + fmtTime(p.created_at) + "</span></div>" +
          (p.title ? "<h3>" + esc(p.title) + "</h3>" : "") +
          '<div class="body">' + esc(p.body) + "</div>" +
          '<div class="tags">' + labels.map((l) => '<span class="badge">' + esc(l) + "</span>").join("") + (p.signed_by ? '<span class="badge badge-ai">署名：' + esc(p.signed_by) + "</span>" : "") + "</div>" +
          '<div class="foot"><span>共鸣 12</span><span>回应 4</span><span>收藏</span></div></article>';
      }).join("")
    : '<div class="empty">这个频道还没有内容。<br>加入社区后，可查看完整频道并参与讨论。</div>';
  const back = '<div style="padding:16px 18px 0"><button class="back" data-view="community">← 社区</button></div>';
  $("view").innerHTML = back + '<div class="h5-top" style="padding-top:10px"><div><div class="h5-title"># ' + esc(ch.name) + '</div><div class="region">' + esc(ch.desc) + "</div></div></div>" + list + '<div style="height:96px"></div><div class="fixed-cta" style="display:flex;gap:8px"><button class="btn" data-view="compose" style="flex:0 0 auto;width:auto">✎ 写感悟</button><button class="btn btn-primary" data-view="activity" style="flex:1;width:auto">查看本场活动</button></div>';
  $("view").insertAdjacentHTML("beforeend", '<div style="height:96px"></div>');
}

function renderActivity() {
  const a = state?.activity;
  if (!a) { $("view").innerHTML = '<div class="empty">还没有活动。</div>'; return; }
  const plan = taskOutput("planner");
  const st = ACTIVITY_STATUS[a.status] ?? ACTIVITY_STATUS.draft;
  const agenda = (plan?.agenda || []).map((s) => '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><b style="min-width:44px;color:var(--primary)">' + s.minutes + '\'</b><div><div style="font-weight:600">' + esc(s.phase) + '</div><div class="hint">' + esc(s.detail || s.content || s.goal) + "</div></div></div>").join("");
  const clusters = (state.clusters || []).slice(0, 5).map((c) => '<span class="badge">' + esc(c.label) + " · " + c.size + " 人</span>").join("");
  $("view").innerHTML =
    '<div style="padding:16px 18px 0"><button class="back" data-view="community">← 社区</button></div>' +
    '<div class="h5-top" style="padding-top:10px"><div><div class="h5-title">' + esc(a.title) + '</div><div class="region">' + esc(a.district) + " · " + fmtTime(a.planned_at) + "</div></div></div>" +
    '<div style="padding:0 18px"><div class="status-band" style="margin:8px 0"><span class="badge badge-ai">' + st.label + "</span><span>" + esc(a.venue) + " · " + a.capacity + " 人</span></div></div>" +
    '<div style="padding:0 18px"><div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center"><div style="width:46px;height:66px;border-radius:4px;background:var(--surface-muted);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--font-serif);font-size:20px;color:var(--text-secondary)">' + esc((a.book_title || "书")[0]) + '</div><div><div style="font-weight:600;font-family:var(--font-serif);font-size:16px">《' + esc(a.book_title || "待定") + "》</div><div class=\"hint\">" + esc(a.book_author || "") + " · 议题：" + esc(a.topic || "") + "</div></div></div></div>" +
    '<div class="section-title">流程</div><div style="padding:0 18px">' + (agenda || '<div class="hint">方案生成后显示</div>') + "</div>" +
    '<div class="section-title">本场问题云</div><div style="padding:0 18px">' + (clusters || '<div class="hint">招募完成后显示，报名提交的问题会聚类成本场讨论题</div>') + "</div>" +
    '<div style="height:90px"></div>' +
    '<div class="fixed-cta"><button class="btn btn-primary" data-view="enroll">带一个问题来 · 报名</button></div>';
}

function renderEnroll() {
  const mode = view.enrollMode;
  const tabs = [["question", "提一个问题"], ["excerpt", "一段摘录"], ["story", "我的故事"]].map(([k, t]) => '<button class="btn" data-mode="' + k + '" style="flex:1;' + (mode === k ? "background:var(--primary);color:var(--on-primary);border-color:var(--primary)" : "") + '">' + t + "</button>").join("");
  const fields = mode === "question"
    ? '<div class="field"><label>你带来的问题</label><textarea id="f-question" placeholder="例如：35 岁转管理，怕丢了手艺又带不好人"></textarea><div class="hint">会进入本场问题云</div></div>'
    : mode === "excerpt"
      ? '<div class="field"><label>触动你的原文摘录</label><textarea id="f-excerpt" placeholder="粘贴原文"></textarea><div class="hint">再写一句：它为什么触动你。</div></div>'
      : '<div class="field"><label>你自己的相关经历</label><textarea id="f-story" placeholder="一段真实发生的事"></textarea><div class="hint">不需要结论，讲清楚发生了什么就好。</div></div>';
  $("view").innerHTML =
    '<div style="padding:16px 18px 0"><button class="back" data-view="activity">← 活动</button></div>' +
    '<div class="h5-top" style="padding-top:10px"><div><div class="h5-title">带着问题来</div><div class="region">提一个问题，或带一段摘录</div></div></div>' +
    '<div style="padding:4px 18px;display:flex;gap:8px">' + tabs + "</div>" +
    '<div class="form">' + fields + '<p class="hint">提交后确认名额；未提交进候补</p></div>' +
    '<div class="fixed-cta"><button class="btn btn-primary" id="submit-enroll">提交并锁定名额</button></div>';
}

function render() {
  if (!state) return;
  activityId = state.activity?.id ?? null;
  if (view.name === "compose") return;
  if (view.name === "community") renderCommunity();
  else if (view.name === "channel") renderChannel();
  else if (view.name === "activity") renderActivity();
  else if (view.name === "enroll") renderEnroll();
  else if (view.name === "compose") renderCompose();
  else if (view.name === "region") renderRegion();
}

async function submitEnroll() {
  const mode = view.enrollMode;
  const questionText = ($("f-question")?.value || "").trim();
  const excerpt = ($("f-excerpt")?.value || "").trim();
  const story = ($("f-story")?.value || "").trim();
  if (mode === "question" && !questionText) return alert("先写下一个问题");
  if (mode === "excerpt" && !excerpt) return alert("先粘贴一段原文");
  if (mode === "story" && !story) return alert("先写一段你的经历");
  await fetch("/api/enroll", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activityId, questionText: mode === "question" ? questionText : null, excerpt: mode === "excerpt" ? excerpt : null, story: mode === "story" ? story : null }),
  });
  view = { ...view, name: "community" };
  render();
  alert("已提交，进入本场问题云。");
}

$("view").addEventListener("click", (e) => {
  if (e.target.id === "submit-enroll") { submitEnroll(); return; }
  const pick = e.target.closest("[data-pick]")?.dataset.pick;
  if (pick) { region = pick; view = { ...view, name: "community" }; render(); return; }
  const ch = e.target.closest("[data-channel]")?.dataset.channel;
  const v = e.target.closest("[data-view]")?.dataset.view;
  const mode = e.target.closest("[data-mode]")?.dataset.mode;
  if (ch) { view = { ...view, name: "channel", channel: ch }; render(); return; }
  if (mode) { view = { ...view, enrollMode: mode }; render(); return; }
  if (v) { view = { ...view, name: v }; if (v === "compose") { composedRaw = ""; composed = null; renderCompose(); } else render(); }
});

const splash = $("splash");
const hideSplash = () => splash.classList.add("gone");
if (sessionStorage.getItem("kaijuan-splash")) hideSplash();
else { sessionStorage.setItem("kaijuan-splash", "1"); setTimeout(hideSplash, 2800); }
$("skip").addEventListener("click", hideSplash);

fetch("/api/state").then((r) => r.json()).then((s) => { state = s; render(); });
const es = new EventSource("/api/stream");
es.onmessage = (e) => { try { state = JSON.parse(e.data); render(); } catch {} };




let composed = null;
let composedRaw = "";
let rec = null;

function renderCompose() {
  $("view").innerHTML =
    '<div style="padding:16px 18px 0"><button class="back" data-view="channel">← 频道</button></div>' +
    '<div class="h5-top" style="padding-top:10px"><div><div class="h5-title">写感悟</div><div class="region">说一句，或写一段</div></div></div>' +
    '<div class="form">' +
    '<div class="field"><label>原始记录</label>' +
    '<textarea id="compose-raw" style="min-height:130px" placeholder="今天在五道口这场，听到有人说「稳定不是没有情绪，是情绪来了你知道它从哪来」，我突然想起自己上个月为什么辞职。">' + esc(composedRaw) + "</textarea>" +
    '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="voice-btn" style="flex:0 0 auto">🎤 语音</button><button class="btn btn-primary" id="polish-btn" style="flex:1">AI 排版</button></div>' +
    '<div class="hint">语音需要联网；打字也行</div></div>' +
    (composed
      ? '<div class="field" style="margin-top:4px"><label>排版结果（可改）</label><input id="composed-title" value="' + esc(composed.title) + '"><textarea id="composed-body" style="min-height:120px;margin-top:8px">' + esc(composed.body) + "</textarea>" +
        '<div style="margin-top:8px">' + (composed.labels || []).map((l) => '<span class="badge">' + esc(l) + "</span>").join("") + "</div>" +
        '<div class="hint">来源：' + (composed.source === "llm" ? "模型排版" : "本地模板排版（未接模型）") + "。发布前可以再改。</div></div>"
      : "") +
    "</div>" +
    '<div style="height:96px"></div><div class="fixed-cta"><button class="btn btn-primary" id="publish-btn"' + (composed ? "" : " disabled") + ">发布到本社区</button></div>";
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("当前浏览器不支持语音识别，请直接打字"); return; }
  if (rec) { rec.stop(); rec = null; $("voice-btn").textContent = "🎤 语音"; return; }
  try {
    rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) { composedRaw += text; const el = $("compose-raw"); if (el) el.value = composedRaw; }
    };
    rec.onerror = () => { alert("语音识别不可用（可能没联网或浏览器不支持），请直接打字"); rec = null; };
    rec.onend = () => { rec = null; const b = $("voice-btn"); if (b) b.textContent = "🎤 语音"; };
    rec.start();
    $("voice-btn").textContent = "● 停止";
  } catch { alert("语音启动失败，请直接打字"); rec = null; }
}

async function doPolish() {
  composedRaw = ($("compose-raw")?.value || "").trim();
  if (!composedRaw) return alert("先写或说一段");
  const btn = $("polish-btn");
  if (btn) { btn.disabled = true; btn.textContent = "排版中…"; }
  const res = await fetch("/api/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: composedRaw, preview: true }) });
  const data = await res.json();
  composed = data.polished ?? null;
  renderCompose();
}

async function doPublish() {
  const title = $("composed-title")?.value ?? composed?.title ?? "";
  const body = $("composed-body")?.value ?? composed?.body ?? "";
  if (!body.trim()) return alert("正文不能空");
  await fetch("/api/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: composedRaw || body, title, body, labels: composed?.labels ?? [], channelSlug: "reading" }) });
  composed = null; composedRaw = "";
  view = { ...view, name: "channel" };
  render();
  alert("已发布到 #读书感悟");
}

document.addEventListener("click", async (e) => {
  if (e.target.id === "voice-btn") { startVoice(); return; }
  if (e.target.id === "polish-btn") { await doPolish(); return; }
  if (e.target.id === "publish-btn") { await doPublish(); return; }
});






function renderRegion() {
  const list = ["海淀", "朝阳", "西城", "东城"].map((r) => '<div class="ch" data-pick="' + r + '"><span class="hash">◎</span><div><div>' + r + (r === region ? ' <span class="badge">当前</span>' : "") + '</div><div class="sub">' + (r === "海淀" ? "1 个社区" : "暂无社区") + "</div></div></div>").join("");
  $("view").innerHTML = '<div style="padding:16px 18px 0"><button class="back" data-view="community">← 返回</button></div><div class="h5-top" style="padding-top:10px"><div><div class="h5-title">切换地域</div></div></div><div class="channels">' + list + "</div>";
}

