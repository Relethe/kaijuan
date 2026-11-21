// 语音输入适配层：自动选择浏览器识别或云端 STT
const Voice = (() => {
  let cfg = null;
  let rec = null;
  let media = null;
  let chunks = [];
  let active = false;

  async function getConfig(force) {
    if (!cfg || force) cfg = await fetch("/api/stt/config" + (force ? "?refresh=1" : "")).then((r) => r.json()).catch(() => ({ provider: "browser" }));
    return cfg;
  }
  function browserSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  function startBrowser(el, btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = "zh-CN"; r.interimResults = false; r.continuous = true;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) el.value += text;
    };
    r.onerror = async () => { active = false; rec = null; if (btn) btn.textContent = "🎤 语音"; let c = { local: { available: false } }; try { c = await getConfig(true); } catch {} if (c.local && c.local.available) { if (btn) btn.textContent = "转写中…"; await startServer(el, btn, "local"); } else { alert("浏览器识别需要联网。直接打字也行。"); } };
    r.onend = () => { active = false; rec = null; if (btn) btn.textContent = "🎤 语音"; };
    r.start();
    rec = r; active = true;
    if (btn) btn.textContent = "● 停止";
  }
  async function startServer(el, btn, mode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert("浏览器不支持录音，请直接打字"); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!chunks.length) { if (btn) btn.textContent = "🎤 语音"; return; }
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      const b64 = await new Promise((resolve) => { const fr = new FileReader(); fr.onloadend = () => resolve(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(blob); });
      if (btn) btn.textContent = "转写中…";
      const res = await fetch("/api/stt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: b64, mime: blob.type, mode }) });
      const data = await res.json().catch(() => ({}));
      if (data.text) el.value += data.text; else alert(data.error || "转写失败");
      if (btn) btn.textContent = "🎤 语音";
    };
    mr.start();
    media = mr; active = true;
    if (btn) btn.textContent = "● 停止";
  }
  function stop() {
    if (rec) { try { rec.stop(); } catch {} rec = null; }
    if (media && media.state !== "inactive") { try { media.stop(); } catch {} }
    media = null; active = false;
  }
  return {
    async toggle(btn, getEl) {
      if (active) { stop(); if (btn) btn.textContent = "🎤 语音"; return; }
      const el = getEl();
      if (!el) return;
      const c = await getConfig();
      if (c.provider === "browser" || (!browserSupported() && c.provider !== "openai-compatible")) {
        if (!browserSupported()) { alert("浏览器不支持语音识别，请直接打字，或在 .env 配置云端 STT"); return; }
        startBrowser(el, btn);
      } else if (c.provider === "openai-compatible") {
        await startServer(el, btn, "openai-compatible");
      } else if (c.provider === "local") {
        await startServer(el, btn, "local");
      } else {
        alert("当前 STT 方案（" + c.provider + "）适配未完成，回退浏览器识别");
        if (browserSupported()) startBrowser(el, btn); else alert("请直接打字");
      }
    },
    async describe() {
      const c = await getConfig();
      return c;
    },
  };
})();


