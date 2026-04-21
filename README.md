Here is the final, complete README.md for your project. I have updated it to reflect all the exact architectural choices, bug fixes, and specific model requirements (openai/gpt-oss-120b) we implemented to ensure you pass the grading criteria flawlessly.

Create a file named README.md in the root of your project and paste this in:

TwinMind Live Suggestions Copilot
A real-time AI meeting copilot that listens to browser audio, transcribes it, and continuously surfaces actionable, context-aware suggestions. Built for the TwinMind full-stack engineering assignment.

🚀 Quick Start
Clone the repository

Bash
git clone <your-repo-url>
cd twinmind-copilot
Install dependencies

Bash
npm install
Run the development server

Bash
npm run dev
Usage: Open http://localhost:3000. Enter your personal Groq API key on the welcome screen (it is stored safely in local React state and never persisted or shipped). Click the Start Mic button to begin the live session.

🏗️ Stack Choices & Architecture
Framework: Next.js 14 (App Router). Chosen to colocate the frontend UI with secure serverless API routes (/api/transcribe, /api/suggest, /api/chat). This prevents CORS issues and keeps the prompt logic hidden from the client.

Audio Capture: Native Browser MediaRecorder API. Instead of complex Web Audio API buffers, I utilized MediaRecorder with a 30-second timeslice. This automatically chunks the audio without blocking the main browser UI thread.

AI SDK: Official groq-sdk. Used on the Node.js server to reliably handle multipart/form-data audio file parsing and streaming chat responses.

Styling: Tailwind CSS for rapid prototyping of the 3-column layout to match the provided prototype.

🧠 Model Selection & Prompt Engineering
As per the assignment requirements, all intelligence runs through Groq.

1. Transcription (whisper-large-v3)

The client records audio chunks and sends a FormData payload to the backend. The Next.js API enforces the whisper-large-v3 model parameter server-side before passing it to the Groq SDK, ensuring high-speed, accurate transcription.

2. Live Suggestions (openai/gpt-oss-120b)

Context Window: Passing the entire meeting history every 30 seconds wastes tokens and degrades latency. The client strictly slices the last ~150 words of the transcript to send to the suggestions endpoint, keeping the AI hyper-focused on the immediate conversational context.

Prompt Strategy: The system prompt forces a strict JSON schema using Groq's json_object response format. It constrains the 120B model to categorize its output into specific actionable types (clarification, talking_point, fact_check, answer).

Safety Net: The backend implements a regex cleaner to strip markdown code blocks (e.g., ```json) if the model hallucinates formatting, preventing JSON.parse() crashes.

3. Detailed Chat (openai/gpt-oss-120b)

Streaming Context: When a suggestion is clicked or a question is typed, the chat route receives the full transcript and the user's chat history. It uses ReadableStream and TextEncoder to stream the model's response back to the UI token-by-token, bringing the perceived latency (Time-to-First-Token) down to milliseconds.

⚖️ Tradeoffs & Technical Decisions
Client-Side vs. Server-Side Audio: I chose to process the audio chunks on the client into Blob/File objects and send them via FormData to the Next.js API. This keeps the client lightweight while allowing the server to handle the API keys securely.

Browser Microphone Lifecycle: A common pitfall in browser audio is leaving the microphone tracks "hot" after stopping. The useAudioRecorder hook explicitly iterates over stream.getTracks() and calls .stop() to ensure user privacy and remove the browser's red recording indicator.

React State Management: Avoided heavy external state managers (Redux/Zustand) in favor of clean, native React hooks (useState, useCallback, useRef) to manage the arrays for transcripts, suggestion batches, and chat history.

🔮 Future Improvements for Production
If scaling this to millions of users, I would implement the following:

WebSockets/gRPC: Replace the 30-second REST API chunking with a continuous WebSocket stream to a backend service for true sub-second real-time transcription.

Vector Database (RAG): Instead of passing the entire transcript to the chat window as it gets infinitely long, I would chunk the historical transcript into a vector store to retrieve only the relevant past moments.

Speaker Diarization: Enhancing the Whisper pipeline to detect "Speaker A" and "Speaker B" would vastly improve the model's ability to suggest counter-arguments and contextual fact-checks.