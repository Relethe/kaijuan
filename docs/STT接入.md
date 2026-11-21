# 语音转写（STT）接入

## 现在的行为

**自动检测**：`.env` 没配云端 → 用浏览器内置识别（零配置）；配了 → 走云端。

`GET /api/stt/config` 返回当前方案，前端 `public/voice.js` 据此选识别路径，不需要改代码。

```json
{ "provider": "browser", "model": "whisper-1", "hasKey": false,
  "note": "自动检测：未配置云端时用浏览器识别" }
```

## 四种方案

### 3. 本机自带（Windows Speech Recognition，离线）

启动时自动探测，不需要配置：

- 检查系统是否装了 **zh-CN 识别器**（`System.Speech.Recognition.SpeechRecognitionEngine`）
- 检查是否装了 **ffmpeg**（把浏览器录的 webm 转 16k mono wav）

都满足时 `/api/stt/config` 返回：

```json
{ "provider": "browser", "candidates": ["browser", "local"],
  "local": { "available": true, "engine": "Windows Speech Recognition (zh-CN)", "note": "本机自带，离线可用" } }
```

实测（本机 2026-10-30）：TTS 合成「今天在五道口办读书会，五十人左右，聊聊职业迷茫」→ 识别为「今天在五道口办读书会50人左右了了职业迷茫」。

- 优点：完全离线、不要 key、不要网络
- 缺点：准确率不如大模型（「聊聊」被识别成「了了」），适合短句兜底
- 触发方式：浏览器识别失败时自动切过去；或手动 `STT_PROVIDER="local"`

### 4. 浏览器内置（默认，零配置）

- 支持：Chrome / Edge（中文可用），Safari 部分版本
- 依赖：网络（Chrome 走 Google，Edge 走 Azure）
- 优点：不装东西、不要 key、演示最稳
- 缺点：国内 Chrome 可能不可用；断网失效；识别质量一般

不需要任何配置，`STT_PROVIDER="auto"` 默认就会选它。

### 2. 云端 STT（OpenAI 兼容 `/audio/transcriptions`）

买 key → 填三个变量 → 重启：

```env
STT_PROVIDER="openai-compatible"
STT_BASE_URL="https://api.openai.com/v1"
STT_API_KEY="sk-..."
STT_MODEL="whisper-1"
```

兼容的厂商（都实现了 `POST /audio/transcriptions`，只是 base 和模型名不同）：

| 厂商 | STT_BASE_URL | 模型 | 备注 |
|---|---|---|---|
| OpenAI Whisper | `https://api.openai.com/v1` | `whisper-1` | 需要海外网络 |
| 硅基流动 SiliconFlow | `https://api.siliconflow.cn/v1` | `FunAudioLLM/SenseVoiceSmall` | 国内可直连，有免费额度 |
| 阿里云百炼（兼容模式） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-audio-asr` | 国内合规 |
| 任何自建兼容服务 | 你的地址 | 你的模型名 | 只要实现该接口 |

### 5. 本地 SenseVoice（赛后）

需要 Python 3.10+、funasr、torch、modelscope，模型 1–2 GB。

**这台机器现在装不了**：网络 20–50 KB/s，光 torch 就下不完，48 小时内不可行。

赛后路径：

```powershell
pip install funasr modelscope torch
python -c "from funasr import AutoModel; m=AutoModel(model='iic/SenseVoiceSmall'); print(m.generate('test.wav'))"
```

再包一个 HTTP 服务暴露 `POST /asr` 返回 `{ "text": "..." }`，把 `STT_BASE_URL` 指向它、`STT_MODEL` 随便填，`STT_PROVIDER="openai-compatible"` 即可复用现有转发逻辑。

## 自动配置逻辑

1. `STT_PROVIDER=auto`（默认）：`STT_BASE_URL` 和 `STT_API_KEY` 都有 → `openai-compatible`；否则 `browser`
2. 手动指定 provider：以指定为准；未实现的厂商回退浏览器并提示
3. 前端不硬编码任何厂商：`voice.js` 只认 `browser` 和 `openai-compatible` 两种协议

## 前端行为

| provider | 行为 |
|---|---|
| `browser` | Web Speech API 实时转写，追加到输入框 |
| `openai-compatible` | MediaRecorder 录音 → base64 → `POST /api/stt` → 服务端转发 → 回填文本 |
| 其他 | 提示「适配未完成」并回退浏览器 |

## 已知限制

- 浏览器识别在 Chrome 国内环境可能不可用（走 Google 服务）；Edge 更稳
- 服务端转发是一次性整段识别，不是流式
- 录音需要 HTTPS 或 localhost（`localhost:3000` 满足）

