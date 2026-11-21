import fs from "node:fs";
import path from "node:path";
const raw = fs.readFileSync(path.join(process.env.USERPROFILE, ".dsh", ".credentials.yaml"), "utf8");
const get = (k) => { const m = raw.match(new RegExp(k + "\\s*:\\s*(\\S+)")); return m ? m[1].trim().replace(/^["']|["']$/g, "") : ""; };
const tests = [
  { name: "zhipu", base: "https://open.bigmodel.cn/api/paas/v4", key: get("ZHIPU_API_KEY"), model: "glm-4-flash" },
  { name: "deepseek", base: "https://api.deepseek.com/v1", key: get("DEEPSEEK_API_KEY"), model: "deepseek-chat" },
  { name: "ark", base: "https://ark.cn-beijing.volces.com/api/v3", key: get("ARK_API_KEY"), model: "doubao-seed-1-6-250615" },
];
for (const t of tests) {
  if (!t.key) { console.log(t.name, "NO KEY"); continue; }
  try {
    const res = await fetch(t.base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t.key },
      body: JSON.stringify({ model: t.model, messages: [{ role: "user", content: "只回两个字：可以" }], max_tokens: 16 }),
      signal: AbortSignal.timeout(25000),
    });
    const txt = await res.text();
    console.log(t.name, "->", res.status, txt.slice(0, 180).replace(/\s+/g, " "));
  } catch (e) {
    console.log(t.name, "-> ERR", String(e).slice(0, 120));
  }
}
