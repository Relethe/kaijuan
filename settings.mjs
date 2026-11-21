import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "data", "settings.json");

const DEFAULTS = {
  llm: { protocol: "openai", baseUrl: "", apiKey: "", model: "glm-4-flash" },
  stt: { provider: "auto", baseUrl: "", apiKey: "", model: "whisper-1" },
};

export const PRESETS = [
  { id: "ark", name: "火山方舟", protocol: "openai", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-250615" },
  { id: "siliconflow", name: "硅基流动", protocol: "openai", baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct" },
  { id: "zhipu", name: "智谱 GLM", protocol: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "deepseek", name: "DeepSeek", protocol: "openai", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "dashscope", name: "阿里云百炼", protocol: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "moonshot", name: "Moonshot", protocol: "openai", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "openai", name: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "openrouter", name: "OpenRouter", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "anthropic", name: "Anthropic", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5" },
  { id: "gemini", name: "Google Gemini", protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
];

let cache = null;

export function getSettings() {
  if (cache) return cache;
  let stored = {};
  try { stored = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  cache = {
    llm: { ...DEFAULTS.llm, ...(stored.llm || {}) },
    stt: { ...DEFAULTS.stt, ...(stored.stt || {}) },
  };
  if (!cache.llm.baseUrl && process.env.LLM_BASE_URL) cache.llm.baseUrl = process.env.LLM_BASE_URL;
  if (!cache.llm.apiKey && process.env.LLM_API_KEY) cache.llm.apiKey = process.env.LLM_API_KEY;
  if (process.env.LLM_MODEL) cache.llm.model = cache.llm.model || process.env.LLM_MODEL;
  return cache;
}

export function saveSettings(next) {
  const cur = getSettings();
  const merged = {
    llm: { ...cur.llm, ...((next && next.llm) || {}) },
    stt: { ...cur.stt, ...((next && next.stt) || {}) },
  };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2), "utf8");
  cache = merged;
  return merged;
}

export function isLlmEnabled() {
  const s = getSettings();
  return Boolean(s.llm.baseUrl && s.llm.apiKey);
}

