const AGENTS = [
  { id: "planner", name: "策划 Agent", role: "方案 · 玩法 · 物料 · 预算" },
  { id: "GATE1", gate: true, name: "Gate 1", role: "人工确认方案" },
  { id: "recruiter", name: "招募 Agent", role: "邀请文案 · 问题云" },
  { id: "onsite", name: "现场 Agent", role: "环节卡 · 主持提词" },
  { id: "archivist", name: "沉淀 Agent", role: "札记草稿 · 后缀包" },
  { id: "GATE2", gate: true, name: "Gate 2", role: "人工复盘发布" },
  { id: "ledger", name: "台账 Agent", role: "结构化入库" },
  { id: "reporter", name: "汇报 Agent", role: "街道月报" },
];
let state = null;
let activityId = null;
const prevStatus = {};
const ui = { collapsed: new Set(), expanded: new Set(), expandedSeg: new Set(), materials: [], stageQuestions: new Set(), playbook: {}, extraPlaybooks: [], budgetItems: [], cardDone: new Set() };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "待定";
const LABEL = { pending: "等待", running: "执行中", done: "完成", fallback: "模板兜底", gate: "等待审批" };

function taskOf(agent) { return (state?.tasks || []).find((t) => t.agent === agent); }
function nodeState(a) {
  if (a.gate) {
    if (state?.run?.status === (a.id === "GATE1" ? "gate1_wait" : "gate2_wait")) return "gate";
    if (a.id === "GATE1" && state?.run?.gate1At) return "done";
    if (a.id === "GATE2" && state?.run?.gate2At) return "done";
    return "pending";
  }
  return taskOf(a.id)?.status ?? "pending";
}
function renderFlow() {
  $("flow").innerHTML = AGENTS.map((a) => {
    const st = nodeState(a);
    return '<div class="node" data-status="' + st + '"><div class="n-name"><span class="dot"></span>' + esc(a.name) + '</div><div class="n-role">' + esc(a.role) + "</div><div class=\"n-state\">" + (LABEL[st] ?? st) + "</div></div>";
  }).join('<div class="sep"></div>');
}

function cyclePlaybook(i) {
  const list = state?.playbooks || [];
  if (!list.length) return;
  const taken = new Set(Object.entries(ui.playbook).filter(([k]) => Number(k) !== i).map(([, v]) => v));
  const cur = ui.playbook[i] ?? (taskOf("planner")?.output?.playbooks?.[i]?.name);
  const idx = cur ? list.findIndex((p) => p.name === cur) : -1;
  for (let step = 1; step <= list.length; step++) {
    const cand = list[(idx + step) % list.length];
    if (!taken.has(cand.name)) { ui.playbook[i] = cand.name; return; }
  }
}
function editCount() {
  return Object.keys(ui.playbook).length + ui.materials.filter((m) => Number(m.price) > 0).length + ui.stageQuestions.size;
}
function collectEdits() {
  return { playbookOverrides: ui.playbook, extraPlaybooks: ui.extraPlaybooks, materials: ui.materials, budgetItems: ui.budgetItems, stageQuestions: [...ui.stageQuestions], timelineDone: [...ui.cardDone] };
}

function renderPlan(p) {
  const collapsed = ui.collapsed.has("planner");
  const agenda = (p.agenda || []).map((s) => "<li><b>" + esc(s.phase) + "</b> " + s.minutes + " 分钟 — " + esc(s.detail || s.content || "") + "</li>").join("");
  const pbs = (p.playbooks || []).map((pb, i) => {
    const name = ui.playbook[i] ?? pb.name;
    return '<span class="chip chip-btn ' + (ui.playbook[i] ? "chip-on" : "") + '" data-cycle="' + i + '">' + esc(name) + " ⇄</span>";
  }).concat((ui.extraPlaybooks || []).map((name, j) => '<span class="chip chip-btn" data-cycle-extra="' + j + '">' + esc(name) + " ⇄</span>")).join(" ") + ' <span class="chip chip-btn" data-pbadd="1">+ 添加玩法</span>';
  const mats = renderMaterials(p);
  const budget = renderBudget(p);
  return '<div class="out"><div class="out-head" data-toggle="planner"><h4>策划 Agent · ' + esc(p.summary) + '</h4><span class="chev">' + (collapsed ? "展开" : "收起") + "</span></div>" +
    (collapsed ? "" : '<div class="out-body"><ul>' + agenda + "</ul>" +
      '<p style="margin-top:10px"><b>玩法选配</b><br>' + pbs + "</p>" +
      "<p style=\"margin-top:10px\"><b>物料清单</b><br>" + mats + "</p>" +
      '<p style="margin-top:10px"><b>预算</b></p><div>' + budget + "</div>" +
      '<p class="muted" style="margin-top:8px">' + esc(p.guardrail) + "</p></div>") + "</div>";
}

function renderCloud(r) {
  const c = r.questionCloud;
  if (!c) return "";
  const clusters = (c.clusters || []).map((cl) => {
    const open = ui.expanded.has(cl.label);
    const picked = ui.stageQuestions.has(cl.label);
    return '<div class="cluster"><div class="cluster-head"><b>' + esc(cl.label) + '</b><span class="badge">' + cl.size + ' 人</span><span class="cluster-actions">' +
      '<button class="mini" data-expand="' + esc(cl.label) + '">' + (open ? "收起" : "全部 " + cl.size + " 条") + "</button>" +
      '<button class="mini ' + (picked ? "mini-on" : "") + '" data-stage="' + esc(cl.label) + '">' + (picked ? "已选为现场题" : "设为现场题") + "</button></span></div>" +
      (open ? (cl.questions || []).map((q) => '<div class="q">· ' + esc(q) + "</div>").join("") : '<div class="muted" style="font-size:12px;margin-top:2px;line-height:1.6">' + esc(cl.summary) + "</div>") +
      "</div>";
  }).join("");
  return '<div class="out"><div class="out-head" data-toggle="recruiter"><h4>招募 Agent · 问题云（' + c.total + " 条 → " + (c.clusters || []).length + ' 簇）</h4><span class="chev">' + (ui.collapsed.has("recruiter") ? "展开" : "收起") + "</span></div>" +
    (ui.collapsed.has("recruiter") ? "" : '<div class="out-body">' + clusters + '<p class="muted" style="font-size:11px;margin-top:6px">勾「设为现场题」的簇会成为本场讨论题，最多选 2 个。</p></div>') + "</div>";
}

function toMin(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function fmtMin(m) {
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function segColor(phase) {
  if (/布场|签到|散场|收尾/.test(phase)) return "var(--border)";
  if (/破冰|开场/.test(phase)) return "var(--accent)";
  if (/茶歇/.test(phase)) return "var(--ok)";
  return "var(--primary)";
}
function renderOnsite(o) {
  const raw = o.timeline || [];
  const items = raw.map((t, i) => {
    const s = toMin(t.time);
    let e = toMin(t.end);
    if (e === null && raw[i + 1]) e = toMin(raw[i + 1].time);
    return { ...t, i, s, e, minutes: Math.max((e ?? (s ?? 0) + 10) - (s ?? 0), 1) };
  }).filter((x) => x.s !== null);
  if (!items.length) return '<div class="out"><h4>现场 Agent · 中控面板</h4></div>';

  const min = Math.min(...items.map((x) => x.s));
  const max = Math.max(...items.map((x) => x.e));
  const total = Math.max(max - min, 1);
  const ticks = [];
  const step = total > 180 ? 60 : 30;
  for (let m = Math.ceil(min / step) * step; m <= max; m += step) ticks.push(m);

  const tickHtml = ticks.map((m) => '<span class="ax-tick" style="left:' + (((m - min) / total) * 100) + '%"><i></i><b>' + fmtMin(m) + "</b></span>").join("");
  const shortName = (ph) => String(ph || "").split(/[｜|]/)[0].slice(0, 6);
  const events = items.map((it, idx) => {
    const on = ui.expandedSeg && ui.expandedSeg.has(it.i);
    const left = ((it.s - min) / total) * 100;
    const width = Math.max(((it.e - it.s) / total) * 100, 3);
    const row = idx % 2;
    return '<div class="ax-ev' + (on ? " on" : "") + '" style="left:' + left + "%;width:" + width + "%;--row:" + row + ";--c:" + segColor(it.phase) + '" data-seg="' + it.i + '" title="' + esc(it.phase) + " " + fmtMin(it.s) + "–" + fmtMin(it.e) + '"><i class="ax-dot"></i><span class="ax-name">' + esc(shortName(it.phase)) + "</span></div>";
  }).join("");

  const detail = items.filter((it) => ui.expandedSeg && ui.expandedSeg.has(it.i)).map((it) =>
    '<div class="tl-detail"><div class="tl-detail-head">' + esc(it.phase) + ' <span class="muted">' + fmtMin(it.s) + "–" + fmtMin(it.e) + " · " + it.minutes + " 分钟</span></div><p>" + esc(it.cue || "") + "</p>" + (it.goal ? '<p class="muted" style="margin-top:4px">目标：' + esc(it.goal) + "</p>" : "") + "</div>"
  ).join("");

  return '<div class="out"><div class="out-head" data-toggle="onsite"><h4>现场 Agent · 中控面板</h4><span class="chev">' + (ui.collapsed.has("onsite") ? "展开" : "收起") + "</span></div>" +
    (ui.collapsed.has("onsite") ? "" :
      '<div class="out-body"><div class="axis"><div class="axis-events">' + events + '</div><div class="axis-line">' + tickHtml + '</div><div class="axis-brace"><span>' + esc(state.activity?.title || "本场活动") + " · " + total + " 分钟</span></div></div>" +
      detail + '<p class="muted" style="margin-top:8px">点时间轴上的事件看环节内容 · 签到码 ' + esc(o.checkin?.code || "") + "</p></div>") + "</div>";
}

function renderNotes(a) {
  const q = (a.quoteCards || []).map((c) => '<span class="chip">' + esc(c.text) + "</span>").join("");
  return '<div class="out"><div class="out-head" data-toggle="archivist"><h4>沉淀 Agent · 札记草稿</h4><span class="chev">' + (ui.collapsed.has("archivist") ? "展开" : "收起") + "</span></div>" +
    (ui.collapsed.has("archivist") ? "" : '<div class="out-body"><p style="font-family:var(--font-serif);font-size:15px;margin-bottom:6px">' + esc(a.notes?.title) + '</p><p style="white-space:pre-line">' + esc(a.notes?.body) + "</p><p style=\"margin-top:8px\">" + q + '</p><p class="muted" style="margin-top:8px">' + esc(a.signedBy) + "<br>" + esc(a.disclaimer) + "</p></div>") + "</div>";
}

function renderLedger(l) {
  const m = l.metrics || {};
  return '<div class="out"><div class="out-head" data-toggle="ledger"><h4>台账 Agent · 结构化入库</h4><span class="chev">' + (ui.collapsed.has("ledger") ? "展开" : "收起") + "</span></div>" +
    (ui.collapsed.has("ledger") ? "" : '<div class="out-body"><div class="kv" style="grid-template-columns:auto auto auto auto"><span>到场</span><span>' + (m.attendees ?? "-") + '</span><span>满意度</span><span>' + (m.satisfaction ?? "-") + '</span><span>新读者</span><span>' + (m.newReaders ?? "-") + '</span><span>玩法留存</span><span>' + Math.round((m.playbookRetention ?? 0) * 100) + '%</span></div><p class="muted" style="margin-top:8px">' + esc(l.notes) + "</p></div>") + "</div>";
}

function renderReport(r) {
  return '<div class="out"><div class="out-head" data-toggle="reporter"><h4>汇报 Agent · ' + esc(r.reportTitle) + '</h4><span class="chev">' + (ui.collapsed.has("reporter") ? "展开" : "收起") + "</span></div>" +
    (ui.collapsed.has("reporter") ? "" : '<div class="out-body">' + (r.sections || []).map((s) => '<p style="margin-top:8px"><b>' + esc(s.heading) + "</b><br>" + esc(s.body) + "</p>").join("") + '<p style="margin-top:10px"><a class="btn" href="/api/report" target="_blank" style="text-decoration:none;display:inline-block">打开月报（可打印 PDF）</a></p></div>') + "</div>";
}

function toggle(set, key) { if (set.has(key)) set.delete(key); else set.add(key); }

const STATUS_LABEL = { draft: "策划中", recruiting: "预热中", live: "进行中", settled: "已沉淀", archived: "已归档" };
function statusLabel(s) { return STATUS_LABEL[s] ?? s; }

function renderGate() {
  const st = state?.run?.status;
  const n = editCount();
  const extra = n ? '<span class="edits">改了 ' + n + " 处（玩法 / 物料 / 现场题）</span>" : "";
  if (st === "gate1_wait") {
    $("gate-bar").innerHTML = '<div class="gate-bar"><strong>Gate 1 · 方案确认</strong><span>改了再确认' + extra + '</span><button class="btn btn-primary" data-gate="GATE1">确认方案' + (n ? " · " + n : "") + "</button></div>";
  } else if (st === "gate2_wait") {
    $("gate-bar").innerHTML = '<div class="gate-bar"><strong>Gate 2 · 复盘发布</strong><span>确认后发布到 #读书感悟</span><button class="btn btn-primary" data-gate="GATE2">确认发布</button></div>';
  } else if (st === "running") {
    $("gate-bar").innerHTML = '<div class="gate-bar"><span>流水线执行中…</span></div>';
  } else {
    $("gate-bar").innerHTML = "";
  }
}

function renderClusters() {
  const list = state?.clusters || [];
  if (!list.length) { $("clusters").textContent = "招募 Agent 完成后出现"; return; }
  $("clusters").innerHTML = list.map((c) => '<div style="margin-bottom:10px"><b style="font-size:12px">' + esc(c.label) + '</b> <span class="badge">' + c.size + ' 人</span><div class="muted" style="font-size:11px;margin-top:2px">' + esc(c.summary) + "</div></div>").join("");
}

function renderOutputs() {
  const parts = [];
  const p = taskOf("planner")?.output; if (p) parts.push(renderPlan(p));
  const r = taskOf("recruiter")?.output; if (r) parts.push(renderCloud(r));
  const o = taskOf("onsite")?.output; if (o) parts.push(renderOnsite(o));
  const a = taskOf("archivist")?.output; if (a) parts.push(renderNotes(a));
  const l = taskOf("ledger")?.output; if (l) parts.push(renderLedger(l));
  const rep = taskOf("reporter")?.output; if (rep) parts.push(renderReport(rep));
  $("outputs").innerHTML = parts.join("");
}

function addLog(html) {
  const log = $("log");
  const d = document.createElement("div");
  d.innerHTML = html;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function logDiff() {
  for (const t of state?.tasks || []) {
    const old = prevStatus[t.agent];
    if (old !== t.status) {
      const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      if (t.status === "running") addLog('<span class="t">' + time + "</span> " + esc(t.agent) + " 开始执行");
      else if (t.status === "done") addLog('<span class="t">' + time + '</span> <span class="o">' + esc(t.agent) + " 完成 · " + (t.tokens ?? 0) + " tok</span>");
      else if (t.status === "fallback") addLog('<span class="t">' + time + '</span> <span class="muted">' + esc(t.agent) + " 完成 · 模板兜底 · " + (t.tokens ?? 0) + " tok</span>");
      prevStatus[t.agent] = t.status;
    }
  }
}

function render() {
  if (!state) return;
  const mEl = document.querySelector(".main"), sEl = document.querySelector(".side");
  const my = mEl ? mEl.scrollTop : 0, sy = sEl ? sEl.scrollTop : 0;
  const a = state.activity;
  activityId = a?.id ?? null;
  if (a) {
    if (!$("demand").value) $("demand").value = a.demand_text ?? "";
    $("activity-info").innerHTML = [
      ["场次", esc(a.title)], ["状态", statusLabel(a.status)], ["时间", fmtTime(a.planned_at)],
      ["地点", esc(a.venue)], ["容量", a.capacity + " 人"], ["报名", (state.enrollments || []).length + " 人已提交门槛"],
    ].map(([k, v]) => "<span>" + k + "</span><span>" + v + "</span>").join("");
  }
  $("cost").textContent = "¥" + (state.run?.cost ?? 0).toFixed(2);
  $("llm-badge").textContent = state.llmEnabled ? "模型在线" : "离线演示模式";
  renderFlow(); renderGate(); renderClusters(); renderOutputs(); logDiff();
  if (mEl) mEl.scrollTop = my;
  if (sEl) sEl.scrollTop = sy;
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

$("start-btn").addEventListener("click", async () => {
  $("start-btn").disabled = true;
  $("log").innerHTML = "";
  try { state = await post("/api/pipeline/start", { activityId, demandText: $("demand").value.trim() }); render(); } finally { $("start-btn").disabled = false; }
});
$("demand-voice").addEventListener("click", () => Voice.toggle($("demand-voice"), () => $("demand")));
$("demand-polish").addEventListener("click", async () => {
  const raw = $("demand").value.trim();
  if (!raw) return alert("先说或写一段需求");
  const btn = $("demand-polish");
  btn.disabled = true; btn.textContent = "排版中…";
  try {
    const res = await fetch("/api/demand/polish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: raw }) });
    const data = await res.json();
    const p = data.polished;
    if (p && p.demand) {
      $("demand").value = p.demand;
      const bits = [p.people ? p.people + " 人" : "", p.topic ? "议题 " + p.topic : "", p.book ? "书《" + p.book + "》" : "", p.venue ? "场地 " + p.venue : ""].filter(Boolean);
      $("demand-note").textContent = bits.length ? bits.join(" · ") : "";
    }
  } finally { btn.disabled = false; btn.textContent = "AI 排版"; }
});$("reset-btn").addEventListener("click", async () => {
  if (!confirm("重置演示：清空流水线、问题云与本次札记，回到「策划中」状态？")) return;
  state = await post("/api/reset", {});
  for (const k of Object.keys(prevStatus)) delete prevStatus[k];
  ui.collapsed.clear(); ui.expanded.clear(); ui.expandedSeg.clear(); ui.materials = []; ui.stageQuestions.clear(); ui.playbook = {}; ui.extraPlaybooks = []; ui.budgetItems = []; ui.cardDone.clear();
  $("log").innerHTML = "";
  render();
});

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.toggle) { toggle(ui.collapsed, t.dataset.toggle); render(); return; }
  if (t.dataset.expand) { toggle(ui.expanded, t.dataset.expand); render(); return; }
  if (t.dataset.stage) { toggle(ui.stageQuestions, t.dataset.stage); render(); return; }
  if (t.dataset.cycle !== undefined) {
    const i = Number(t.dataset.cycle);
    const cur = ui.playbook[i] ?? taskOf("planner")?.output?.playbooks?.[i]?.name ?? "";
    const name = prompt("玩法名（留空恢复默认）", cur);
    if (name !== null) { if (name.trim()) ui.playbook[i] = name.trim(); else delete ui.playbook[i]; render(); }
    return;
  }
  if (t.dataset.cycleExtra !== undefined) {
    const j = Number(t.dataset.cycleExtra);
    const name = prompt("玩法名（留空删除）", (ui.extraPlaybooks || [])[j] || "");
    if (name !== null) { ui.extraPlaybooks = (ui.extraPlaybooks || []); if (name.trim()) ui.extraPlaybooks[j] = name.trim(); else ui.extraPlaybooks.splice(j, 1); render(); }
    return;
  }
  if (t.dataset.seg !== undefined) { toggle(ui.expandedSeg, Number(t.dataset.seg)); render(); return; }
  if (t.dataset.pbadd) { ui.extraPlaybooks = (ui.extraPlaybooks || []); ui.extraPlaybooks.push("新玩法"); render(); return; }
  if (t.dataset.mdel !== undefined) { ui.materials.splice(Number(t.dataset.mdel), 1); render(); return; }
  if (t.dataset.madd) { ui.materials.push({ name: "", price: 0 }); render(); return; }
  if (t.dataset.bdel !== undefined) { ui.budgetItems.splice(Number(t.dataset.bdel), 1); render(); return; }
  if (t.dataset.badd) { ui.budgetItems.push({ name: "新预算项", amount: 0 }); render(); return; }
  if (t.dataset.gate) {
    t.disabled = true;
    state = await post("/api/pipeline/gate", { activityId, gate: t.dataset.gate, edits: collectEdits() });
    render();
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.card !== undefined) { const i = Number(t.dataset.card); t.checked ? ui.cardDone.add(i) : ui.cardDone.delete(i); }
});

fetch("/api/state").then((r) => r.json()).then((s) => { state = s; render(); });
const es = new EventSource("/api/stream");
es.onmessage = (e) => { try { if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return; state = JSON.parse(e.data); render(); } catch {} };







function renderMaterials(p) {
  if (!ui.materials.length && p && p.materials && p.materials.length) {
    ui.materials = p.materials.map((m) => ({ name: m, price: 0 }));
  }
  const rows = ui.materials.map((m, i) =>
    '<div class="mat-row"><input class="mat-name" data-mname="' + i + '" placeholder="物料名" value="' + esc(m.name) + '"><input class="mat-price" data-mprice="' + i + '" type="number" min="0" placeholder="0" value="' + (Number(m.price) || "") + '"><span class="mat-unit">元</span><button class="mini" data-mdel="' + i + '">×</button></div>'
  ).join("");
  return rows + '<button class="mini" data-madd="1" style="margin-top:4px">+ 添加物料</button>';
}

function renderBudget(p) {
  if (!ui.budgetItems.length && p && p.budget) {
    ui.budgetItems = p.budget.filter((b) => b.item !== "物料").map((b) => ({ name: b.item, amount: Number(b.amount) || 0 }));
  }
  const matTotal = ui.materials.reduce((s, m) => s + (Number(m.price) || 0), 0);
  const rows = ui.budgetItems.map((b, i) =>
    '<div class="mat-row"><input class="mat-name" data-bname="' + i + '" placeholder="预算项" value="' + esc(b.name) + '"><input class="mat-price" data-bamount="' + i + '" type="number" min="0" placeholder="0" value="' + (Number(b.amount) || "") + '"><span class="mat-unit">元</span><button class="mini" data-bdel="' + i + '">×</button></div>'
  ).join("");
  const otherTotal = ui.budgetItems.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  return '<div class="mat-row"><span class="mat-label">物料合计</span><b class="budget-sum">¥' + matTotal + '</b></div>' + rows + '<button class="mini" data-badd="1" style="margin-top:4px">+ 添加预算项</button><div class="mat-row" style="margin-top:8px"><span class="mat-label">合计</span><b class="budget-sum">¥' + (matTotal + otherTotal) + '</b></div>';
}

function updateBudgetTotals() {
  const matTotal = ui.materials.reduce((s, m) => s + (Number(m.price) || 0), 0);
  const otherTotal = ui.budgetItems.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const sums = document.querySelectorAll(".budget-sum");
  if (sums[0]) sums[0].textContent = "¥" + matTotal;
  if (sums[1]) sums[1].textContent = "¥" + (matTotal + otherTotal);
}

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.mname !== undefined) ui.materials[Number(t.dataset.mname)].name = t.value;
  if (t.dataset.mprice !== undefined) { ui.materials[Number(t.dataset.mprice)].price = Number(t.value) || 0; updateBudgetTotals(); }
  if (t.dataset.bname !== undefined) ui.budgetItems[Number(t.dataset.bname)].name = t.value;
  if (t.dataset.bamount !== undefined) { ui.budgetItems[Number(t.dataset.bamount)].amount = Number(t.value) || 0; updateBudgetTotals(); }
});





let settingsPresets = [];
async function openSettings() {
  $("settings-mask").hidden = false;
  const s = await fetch("/api/settings").then((r) => r.json()).catch(() => null);
  if (!s) { $("settings-note").textContent = "读取设置失败"; return; }
  settingsPresets = s.presets || [];
  $("preset-grid").innerHTML = settingsPresets.map((p) => '<button class="preset" data-preset="' + p.id + '">' + esc(p.name) + "</button>").join("");
  $("llm-protocol").value = s.llm.protocol || "openai";
  $("llm-base").value = s.llm.baseUrl || "";
  $("llm-model").value = s.llm.model || "";
  $("llm-key").value = "";
  $("llm-key").placeholder = s.llm.hasKey ? "已保存，留空不改" : "sk-...";
  $("settings-note").textContent = s.llmEnabled ? "当前：模型在线" : "当前：离线演示，所有 Agent 走模板";
}

function closeSettings() { $("settings-mask").hidden = true; }

async function saveSettingsQuiet() {
  const llm = { protocol: $("llm-protocol").value, baseUrl: $("llm-base").value.trim(), model: $("llm-model").value.trim() };
  const key = $("llm-key").value.trim();
  if (key) llm.apiKey = key;
  const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ llm }) });
  return r.json();
}

$("settings-btn").addEventListener("click", openSettings);
$("settings-close").addEventListener("click", closeSettings);
$("settings-mask").addEventListener("click", (e) => { if (e.target.id === "settings-mask") closeSettings(); });
$("preset-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-preset]");
  if (!btn) return;
  const p = settingsPresets.find((x) => x.id === btn.dataset.preset);
  if (!p) return;
  $("llm-protocol").value = p.protocol || "openai";
  $("llm-base").value = p.baseUrl;
  $("llm-model").value = p.model;
  document.querySelectorAll(".preset").forEach((el) => el.classList.remove("on"));
  btn.classList.add("on");
});
$("settings-save").addEventListener("click", async () => {
  const data = await saveSettingsQuiet();
  $("settings-note").textContent = data.llmEnabled ? "已保存，模型在线" : "已保存，但还缺 Base URL 或 Key";
  setTimeout(closeSettings, 900);
});
$("settings-test").addEventListener("click", async () => {
  $("settings-note").textContent = "保存并测试中…";
  await saveSettingsQuiet();
  try {
    const r = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await r.json();
    $("settings-note").textContent = data.ok ? "连接成功：" + data.message : "连接失败：" + (data.message || data.error || "未知错误");
  } catch (e) {
    $("settings-note").textContent = "测试失败：" + String(e).slice(0, 120);
  }
});


let progressTimer = null;
function startProgressClock(since) {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  if (!since) return;
  const tick = () => {
    const el = document.getElementById("prog-text");
    if (!el || !state || !state.progress) { clearInterval(progressTimer); progressTimer = null; return; }
    const sec = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000));
    const p = state.progress;
    const name = (AGENTS.find((a) => a.id === p.current) || {}).name || p.current || "";
    el.textContent = "执行中 " + p.step + "/" + p.total + " · " + name + " · 已 " + sec + "s";
    const bar = document.getElementById("prog-bar");
    if (bar) bar.style.width = Math.round(((p.step - 1) / p.total) * 100) + "%";
  };
  tick();
  progressTimer = setInterval(tick, 1000);
}


