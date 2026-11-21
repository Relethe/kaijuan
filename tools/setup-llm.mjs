import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(process.env.USERPROFILE, ".dsh", ".credentials.yaml"), "utf8");
const key = ((raw.match(/DEEPSEEK_API_KEY\s*:\s*(\S+)/) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
if (!key) { console.log("NO KEY"); process.exit(1); }
const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "settings.json");
fs.writeFileSync(file, JSON.stringify({
  llm: { protocol: "openai", baseUrl: "https://api.deepseek.com/v1", apiKey: key, model: "deepseek-flash" },
  stt: { provider: "auto", baseUrl: "", apiKey: "", model: "whisper-1" },
}, null, 2), "utf8");
console.log("written:", file, "keyLen:", key.length);
