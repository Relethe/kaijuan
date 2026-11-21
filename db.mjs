import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { READERS, QUESTIONS, PLAYBOOKS, MAIN_ACTIVITY, HISTORY_ACTIVITIES, HISTORY_POSTS, METRICS, AGE_DIST } from "./lib/seed-data.mjs";

const DB_PATH = process.env.DB_PATH || fileURLToPath(new URL("./data.db", import.meta.url));
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
export const nowIso = () => new Date().toISOString();
export const uid = () => randomUUID();

db.exec(`
CREATE TABLE IF NOT EXISTS readers (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, type TEXT, title TEXT, book_title TEXT, book_author TEXT, topic TEXT, district TEXT, venue TEXT, planned_at TEXT, capacity INTEGER, status TEXT, demand_text TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS enrollments (id TEXT PRIMARY KEY, activity_id TEXT, reader_id TEXT, question_text TEXT, excerpt TEXT, story TEXT, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS pipeline_runs (id TEXT PRIMARY KEY, activity_id TEXT UNIQUE, status TEXT, current TEXT, gate1_at TEXT, gate2_at TEXT, llm_cost REAL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS agent_tasks (id TEXT PRIMARY KEY, run_id TEXT, agent TEXT, seq INTEGER, output TEXT, tokens INTEGER DEFAULT 0, status TEXT, started_at TEXT, finished_at TEXT);
CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, activity_id TEXT, kind TEXT, title TEXT, content TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS playbooks (id TEXT PRIMARY KEY, name TEXT, category TEXT, duration_min INTEGER, materials TEXT, rules_json TEXT, suitable_crowd TEXT, source TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS question_clusters (id TEXT PRIMARY KEY, activity_id TEXT, label TEXT, questions TEXT, summary TEXT, size INTEGER);
CREATE TABLE IF NOT EXISTS metrics (activity_id TEXT PRIMARY KEY, attendees INTEGER, age_dist_json TEXT, satisfaction REAL, playbook_retention REAL);
CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, activity_id TEXT, channel_slug TEXT, author_name TEXT, author_role TEXT, title TEXT, body TEXT, image_url TEXT, labels TEXT, signed_by TEXT, created_at TEXT);
`);
export function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) c FROM activities").get().c;
  if (n > 0) return false;
  const now = Date.now(), DAY = 86400000;
  const insReader = db.prepare("INSERT INTO readers (id,nickname,created_at) VALUES (?,?,?)");
  const readers = READERS.map((nick) => { const id = uid(); insReader.run(id, nick, nowIso()); return id; });
  const insPb = db.prepare("INSERT INTO playbooks (id,name,category,duration_min,materials,rules_json,suitable_crowd,source,status) VALUES (?,?,?,?,?,?,?,?,?)");
  for (const p of PLAYBOOKS) insPb.run(uid(), p.name, p.category, p.durationMin, p.materials, JSON.stringify({ rules: p.rules }), p.suitableCrowd, p.source, "seed");
  const insAct = db.prepare("INSERT INTO activities (id,type,title,book_title,book_author,topic,district,venue,planned_at,capacity,status,demand_text,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const histIds = [];
  for (const a of HISTORY_ACTIVITIES) {
    const id = uid(); histIds.push(id);
    insAct.run(id, a.type, a.title, a.bookTitle, a.bookAuthor, a.topic, a.district, a.venue, new Date(now - a.daysAgo * DAY).toISOString(), a.capacity, a.status, null, nowIso());
  }
  const insMetric = db.prepare("INSERT INTO metrics (activity_id,attendees,age_dist_json,satisfaction,playbook_retention) VALUES (?,?,?,?,?)");
  for (const m of METRICS) insMetric.run(histIds[m.activityIndex], m.attendees, JSON.stringify(AGE_DIST), m.satisfaction, m.playbookRetention);
  const insPost = db.prepare("INSERT INTO posts (id,activity_id,channel_slug,author_name,author_role,title,body,image_url,labels,signed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  for (const q of HISTORY_POSTS) insPost.run(uid(), histIds[q.activityIndex], q.channelSlug, q.authorName, q.authorRole, q.title, q.body, null, JSON.stringify(q.labels), q.authorName, new Date(now - 5 * DAY).toISOString());
  const mainId = uid();
  insAct.run(mainId, MAIN_ACTIVITY.type, MAIN_ACTIVITY.title, MAIN_ACTIVITY.bookTitle, MAIN_ACTIVITY.bookAuthor, MAIN_ACTIVITY.topic, MAIN_ACTIVITY.district, MAIN_ACTIVITY.venue, new Date(now + MAIN_ACTIVITY.plannedInDays * DAY).toISOString(), MAIN_ACTIVITY.capacity, MAIN_ACTIVITY.status, MAIN_ACTIVITY.demandText, nowIso());
  const insEnr = db.prepare("INSERT INTO enrollments (id,activity_id,reader_id,question_text,excerpt,story,status,created_at) VALUES (?,?,?,?,?,?,?,?)");
  QUESTIONS.forEach((q, i) => insEnr.run(uid(), mainId, readers[i % readers.length], q, null, null, "approved", new Date(now - (7 - (i % 7)) * DAY).toISOString()));
  return true;
}

export const getMainActivity = () => db.prepare("SELECT * FROM activities WHERE status IN ('draft','recruiting') ORDER BY created_at DESC LIMIT 1").get();
export const listActivities = () => db.prepare("SELECT * FROM activities ORDER BY planned_at ASC").all();
export const getActivity = (id) => db.prepare("SELECT * FROM activities WHERE id = ?").get(id);
export const setActivityStatus = (id, status) => db.prepare("UPDATE activities SET status = ? WHERE id = ?").run(status, id);

export const listPlaybooks = () => db.prepare("SELECT * FROM playbooks ORDER BY category, name").all();
export const listPosts = (channelSlug) => db.prepare("SELECT * FROM posts WHERE channel_slug = ? ORDER BY created_at DESC").all(channelSlug);
export const addPost = (p) => db.prepare("INSERT INTO posts (id,activity_id,channel_slug,author_name,author_role,title,body,image_url,labels,signed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(uid(), p.activityId, p.channelSlug, p.authorName, p.authorRole, p.title, p.body, p.imageUrl ?? null, JSON.stringify(p.labels ?? []), p.signedBy, nowIso());

export const listQuestions = (activityId) => db.prepare("SELECT question_text FROM enrollments WHERE activity_id = ? AND question_text IS NOT NULL ORDER BY created_at ASC").all(activityId).map((r) => r.question_text);
export const addEnrollment = (e) => db.prepare("INSERT INTO enrollments (id,activity_id,reader_id,question_text,excerpt,story,status,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid(), e.activityId, e.readerId, e.questionText ?? null, e.excerpt ?? null, e.story ?? null, "approved", nowIso());
export const listEnrollments = (activityId) => db.prepare("SELECT * FROM enrollments WHERE activity_id = ? ORDER BY created_at DESC").all(activityId);
export const getRun = (activityId) => db.prepare("SELECT * FROM pipeline_runs WHERE activity_id = ?").get(activityId);
export const createRun = (activityId) => { const id = uid(); db.prepare("INSERT INTO pipeline_runs (id,activity_id,status,current,llm_cost,created_at) VALUES (?,?,?,?,?,?)").run(id, activityId, "idle", null, 0, nowIso()); return getRun(activityId); };
export const setRun = (activityId, status, current) => db.prepare("UPDATE pipeline_runs SET status=?, current=? WHERE activity_id=?").run(status, current, activityId);
export const setGateTime = (activityId, gate) => db.prepare("UPDATE pipeline_runs SET " + (gate === "GATE1" ? "gate1_at" : "gate2_at") + "=? WHERE activity_id=?").run(nowIso(), activityId);
export const addRunCost = (activityId, delta) => db.prepare("UPDATE pipeline_runs SET llm_cost = llm_cost + ? WHERE activity_id = ?").run(delta, activityId);

export const createTask = (runId, agent) => { const id = uid(); db.prepare("INSERT INTO agent_tasks (id,run_id,agent,seq,status,started_at) VALUES (?,?,?,?,?,?)").run(id, runId, agent, Date.now(), "running", nowIso()); return id; };
export const finishTask = (id, output, status, tokens) => db.prepare("UPDATE agent_tasks SET output=?, status=?, tokens=?, finished_at=? WHERE id=?").run(JSON.stringify(output), status, tokens, nowIso(), id);
export const listTasks = (runId) => db.prepare("SELECT * FROM agent_tasks WHERE run_id=? ORDER BY seq ASC").all(runId);

export const addArtifact = (activityId, kind, title, content) => db.prepare("INSERT INTO artifacts (id,activity_id,kind,title,content,created_at) VALUES (?,?,?,?,?,?)").run(uid(), activityId, kind, title, JSON.stringify(content), nowIso());
export const listArtifacts = (activityId) => db.prepare("SELECT * FROM artifacts WHERE activity_id=? ORDER BY created_at ASC").all(activityId);

export const replaceClusters = (activityId, clusters) => {
  db.prepare("DELETE FROM question_clusters WHERE activity_id=?").run(activityId);
  const st = db.prepare("INSERT INTO question_clusters (id,activity_id,label,questions,summary,size) VALUES (?,?,?,?,?,?)");
  for (const c of clusters) st.run(uid(), activityId, c.label, JSON.stringify(c.questions ?? []), c.summary ?? "", c.size ?? 0);
};
export const listClusters = (activityId) => db.prepare("SELECT * FROM question_clusters WHERE activity_id=? ORDER BY size DESC").all(activityId);

export const upsertMetrics = (activityId, m) => db.prepare("INSERT INTO metrics (activity_id,attendees,age_dist_json,satisfaction,playbook_retention) VALUES (?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET attendees=excluded.attendees, age_dist_json=excluded.age_dist_json, satisfaction=excluded.satisfaction, playbook_retention=excluded.playbook_retention").run(activityId, m.attendees ?? 0, JSON.stringify(m.ageDist ?? {}), m.satisfaction ?? 0, m.playbookRetention ?? 0);
export const getMetrics = (activityId) => db.prepare("SELECT * FROM metrics WHERE activity_id=?").get(activityId);


export function resetPipeline(activityId) {
  const run = getRun(activityId);
  if (run) {
    db.prepare("DELETE FROM agent_tasks WHERE run_id=?").run(run.id);
    db.prepare("DELETE FROM pipeline_runs WHERE id=?").run(run.id);
  }
  db.prepare("DELETE FROM artifacts WHERE activity_id=?").run(activityId);
  db.prepare("DELETE FROM question_clusters WHERE activity_id=?").run(activityId);
  db.prepare("DELETE FROM metrics WHERE activity_id=?").run(activityId);
  db.prepare("DELETE FROM posts WHERE activity_id=?").run(activityId);
  setActivityStatus(activityId, "draft");
}

export function updateActivity(activityId, fields) {
  const allowed = ["title", "topic", "book_title", "book_author", "capacity", "venue", "district", "demand_text", "type", "planned_at"];
  const sets = [], vals = [];
  for (const k of allowed) {
    if (fields[k] !== undefined && fields[k] !== null) { sets.push(k + " = ?"); vals.push(fields[k]); }
  }
  if (!sets.length) return;
  vals.push(activityId);
  db.prepare("UPDATE activities SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
}

