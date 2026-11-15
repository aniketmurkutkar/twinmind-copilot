# TwinMind Live Copilot

A real-time meeting copilot. It listens through your microphone, transcribes the conversation in 30-second chunks, and keeps surfacing three context-aware suggestions you can act on mid-meeting. Click any suggestion for a detailed, streamed answer, or ask your own questions in the chat panel.

**[Live demo](https://twinmind-copilot-seven.vercel.app)** · bring your own [Groq API key](https://console.groq.com/keys)

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=flat&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0F172A?style=flat&logo=tailwindcss&logoColor=38BDF8)
![Groq](https://img.shields.io/badge/Groq-F55036?style=flat)

## Features

- **Live transcription:** microphone audio is chunked every 30 seconds and transcribed with Whisper large-v3.
- **Rolling suggestions:** after each chunk, the model returns exactly three complementary cards (`question`, `talking_point`, `answer`, `fact_check` or `clarify`), grounded in the most recent slice of the transcript.
- **Deep dive on click:** clicking a card streams a detailed answer that uses the card's hidden "coach notes" and a longer transcript window.
- **Chat:** ask follow-up questions with the transcript as context. Responses stream token by token.
- **Manual refresh:** flush the in-progress audio chunk early instead of waiting for the 30-second boundary.
- **Editable prompts:** every system prompt, context-window size and temperature can be changed in Settings and is saved in `localStorage`.
- **Session export:** download the transcript, every suggestion batch and the chat history as JSON.

## How it works

```
Browser                                       Next.js API routes            Groq
───────                                       ──────────────────            ────
MediaRecorder (30 s timeslice) ── audio ────▶ /api/transcribe ──────────▶ whisper-large-v3
        │                                            │
        ▼                                            ▼
transcript chunks ── last 200 words ────────▶ /api/suggest ─── JSON ─────▶ openai/gpt-oss-120b
        │                                            │
        ▼                                            ▼
suggestion card / chat ── last 1.4–2.2k words ▶ /api/chat ─── stream ────▶ openai/gpt-oss-120b
```

- **Audio capture** uses the native `MediaRecorder` API with a 30-second timeslice, so chunking happens without blocking the UI thread. Stopping the mic stops every track on the stream, so the browser's recording indicator turns off.
- **Context windows are sized per task.** Suggestions only see the last 200 words, which keeps them fast and focused on what was just said. Chat sees about 1,400 words, and a clicked suggestion sees about 2,200. All three are configurable.
- **Structured output.** `/api/suggest` uses Groq's `json_object` response format, strips stray code fences, and normalizes the result to exactly three cards. If the model returns fewer, it pads with a fallback card, so the UI never breaks.
- **Streaming.** `/api/chat` forwards the model's token stream through a `ReadableStream`, and the client renders it incrementally.
- **State** lives in plain React hooks (`useState`, `useRef`, `useCallback`). No external state library.

## Running locally

Requires Node.js 18+ and a [Groq API key](https://console.groq.com/keys).

```bash
git clone https://github.com/aniketmurkutkar/twinmind-copilot.git
cd twinmind-copilot
npm install
npm run dev
```

Open http://localhost:3000, paste your Groq key, and click **Start Mic**.

### About your API key

The key is held only in React state for the current tab. It is never written to storage and disappears on reload. Each request sends it to this app's own API routes, which forward it to Groq and don't store or log it.

## Project structure

```
app/
├── page.js                  # Dashboard: transcript, suggestions and chat columns
├── api/
│   ├── transcribe/route.js  # Audio chunk → Whisper transcription
│   ├── suggest/route.js     # Transcript slice → 3 JSON suggestions
│   └── chat/route.js        # Streaming chat / deep-dive answers
├── hooks/useAudioRecorder.js  # MediaRecorder lifecycle + early flush
├── components/SettingsModal.js
└── lib/
    ├── defaultSettings.js   # Default prompts, context sizes, temperatures
    └── settingsStorage.js   # localStorage persistence
```

## Limitations and next steps

- **Latency floor:** 30-second REST chunks mean suggestions lag the conversation. Streaming audio over a WebSocket would allow near-real-time transcription.
- **No speaker labels:** adding diarization ("Speaker A / B") would make suggestions such as counter-arguments much sharper.
- **Long meetings:** chat currently sends the most recent window of the transcript. Retrieving relevant earlier moments from a vector index would help in long sessions.

## License

[MIT](LICENSE) © 2026 Aniket Murkutkar
