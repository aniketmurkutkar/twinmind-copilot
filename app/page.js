'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { SettingsModal } from './components/SettingsModal';
import { loadSettings } from './lib/settingsStorage';
import { sliceTranscriptByWords, applyTemplate } from './lib/defaultSettings';

function isoNow() {
  return new Date().toISOString();
}

export default function TwinMindDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [transcriptChunks, setTranscriptChunks] = useState([]);
  const [suggestionBatches, setSuggestionBatches] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  const transcriptEndRef = useRef(null);
  const settingsRef = useRef(settings);
  const transcriptTextRef = useRef('');
  const chatHistoryRef = useRef([]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    transcriptTextRef.current = transcriptChunks.map((c) => c.text).join(' ').trim();
  }, [transcriptChunks]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptChunks]);

  const fetchSuggestions = useCallback(async (textOverride) => {
    const text = (textOverride ?? transcriptTextRef.current).trim();
    if (!text) {
      setErrorBanner('Nothing to suggest on yet—start the mic or wait for transcript.');
      return;
    }

    const s = settingsRef.current;
    const contextWindow = sliceTranscriptByWords(text, s.liveSuggestionContextWords);
    setSuggestionsLoading(true);
    setErrorBanner('');

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextText: contextWindow,
          systemPrompt: s.liveSuggestionPrompt,
          temperature: s.suggestionTemperature,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Suggest failed');
      }

      if (data.suggestions?.length) {
        setSuggestionBatches((prev) => [
          { id: crypto.randomUUID?.() || String(Date.now()), receivedAt: isoNow(), items: data.suggestions },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error(err);
      setErrorBanner(err.message || 'Suggestions request failed');
    } finally {
      setSuggestionsLoading(false);
    }
  }, [apiKey]);

  const handleChunkReady = useCallback(
    async (audioFile) => {
      if (!apiKey) return;

      const formData = new FormData();
      formData.append('file', audioFile);

      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText || 'Transcribe failed');

        if (data.text?.trim()) {
          const piece = data.text.trim();
          setTranscriptChunks((prev) => {
            const next = [...prev, { text: piece, receivedAt: isoNow() }];
            const full = next.map((c) => c.text).join(' ').trim();
            queueMicrotask(() => {
              transcriptTextRef.current = full;
              void fetchSuggestions(full);
            });
            return next;
          });
        }
      } catch (err) {
        console.error(err);
        setErrorBanner(err.message || 'Transcription failed');
      }
    },
    [apiKey, fetchSuggestions]
  );

  const { isRecording, startRecording, stopRecording, flushChunk } = useAudioRecorder(handleChunkReady);

  const streamChatResponse = useCallback(
    async (systemPrompt, messagesForApi) => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          messages: messagesForApi,
          temperature: settingsRef.current.chatTemperature,
        }),
      });

      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        throw new Error(t || res.statusText || 'Chat failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = { role: 'assistant', content: '', ts: isoNow() };

      setChatHistory((prev) => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMsg = {
          ...assistantMsg,
          content: assistantMsg.content + decoder.decode(value, { stream: true }),
        };
        setChatHistory((prev) => [...prev.slice(0, -1), { ...assistantMsg }]);
      }
    },
    [apiKey]
  );

  const sendChatMessage = useCallback(
    async (messageText, { mode = 'chat', suggestion } = {}) => {
      const trimmed = messageText.trim();
      if (!trimmed || isChatLoading) return;

      const s = settingsRef.current;
      const fullTranscript = transcriptTextRef.current;
      const userMsg = {
        role: 'user',
        content: trimmed,
        ts: isoNow(),
      };

      setChatHistory((prev) => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);
      setErrorBanner('');

      const prior = [...chatHistoryRef.current, userMsg];
      const messagesForApi = prior.map(({ role, content }) => ({ role, content }));

      try {
        let systemPrompt;
        if (mode === 'detail' && suggestion) {
          const ctx = sliceTranscriptByWords(fullTranscript, s.detailContextWords);
          systemPrompt = applyTemplate(s.detailAnswerPrompt, {
            TRANSCRIPT: ctx,
            SUGGESTION_TYPE: suggestion.type || '',
            SUGGESTION_PREVIEW: suggestion.preview || '',
            COACH_NOTES: suggestion.internal_context || '',
          });
        } else {
          const ctx = sliceTranscriptByWords(fullTranscript, s.chatContextWords);
          systemPrompt = applyTemplate(s.chatPrompt, { TRANSCRIPT: ctx });
        }

        await streamChatResponse(systemPrompt, messagesForApi);
      } catch (err) {
        console.error(err);
        setErrorBanner(err.message || 'Chat failed');
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: `_(Error: ${err.message})_`, ts: isoNow() },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [isChatLoading, streamChatResponse]
  );

  const handleSuggestionClick = (suggestion) => {
    const line = `[${suggestion.type}] ${suggestion.preview}`;
    sendChatMessage(line, { mode: 'detail', suggestion });
  };

  const handleManualRefresh = async () => {
    setErrorBanner('');
    setRefreshBusy(true);
    try {
      if (isRecording) {
        await flushChunk();
      }
      await fetchSuggestions();
    } finally {
      setRefreshBusy(false);
    }
  };

  const handleExport = () => {
    const payload = {
      exportedAt: isoNow(),
      transcriptChunks,
      suggestionBatches,
      chatHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isKeySet) {
    return (
      <>
        <div className="flex h-screen items-center justify-center bg-slate-100">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">TwinMind Copilot</h1>
            <p className="mt-2 text-sm text-slate-600">
              Paste your Groq API key to run Whisper Large V3 transcription and GPT-OSS 120B suggestions
              locally in your browser session.
            </p>
            <label className="mt-6 block text-sm font-medium text-slate-800">Groq API key</label>
            <input
              type="password"
              placeholder="gsk_…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-blue-500 focus:ring-2"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={!apiKey.trim()}
              onClick={() => setIsKeySet(true)}
              className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="mt-3 w-full text-center text-sm text-blue-600 hover:underline"
            >
              Edit default prompts &amp; context windows first
            </button>
          </div>
        </div>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          onSaved={() => setSettings(loadSettings())}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
      {errorBanner ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          {errorBanner}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-1/3 min-w-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Transcript</h2>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRecording ? 'Stop mic' : 'Start mic'}
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed">
            {transcriptChunks.length === 0 ? (
              <p className="text-slate-400">Start the mic. New lines appear about every 30 seconds.</p>
            ) : (
              transcriptChunks.map((c, i) => (
                <div key={`${c.receivedAt}-${i}`} className="border-l-2 border-blue-200 pl-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {c.receivedAt}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{c.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        <div className="flex w-1/3 min-w-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Live suggestions</h2>
            <div className="flex items-center gap-2">
              {suggestionsLoading ? (
                <span className="text-xs text-slate-500">Updating…</span>
              ) : null}
              <button
                type="button"
                disabled={refreshBusy || suggestionsLoading}
                onClick={handleManualRefresh}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                {refreshBusy ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-8 overflow-y-auto p-4">
            {suggestionBatches.length === 0 ? (
              <p className="text-sm text-slate-400">Batches of 3 suggestions stack here (newest on top).</p>
            ) : (
              suggestionBatches.map((batch, index) => (
                <div key={batch.id} className={index === 0 ? '' : 'opacity-75'}>
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {batch.receivedAt}
                  </div>
                  <div className="space-y-2">
                    {batch.items.map((suggestion, i) => (
                      <button
                        type="button"
                        key={`${batch.id}-${i}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                          {suggestion.type?.replace(/_/g, ' ')}
                        </span>
                        <p className="mt-1 text-sm text-slate-800">{suggestion.preview}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex w-1/3 min-w-0 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Chat</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Export session
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Settings
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chatHistory.length === 0 ? (
              <p className="text-sm text-slate-400">Tap a suggestion or type a question.</p>
            ) : (
              chatHistory.map((msg, i) => (
                <div
                  key={`${msg.ts || i}-${i}`}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'mr-auto bg-slate-100 text-slate-900'
                  }`}
                >
                  {msg.ts ? (
                    <div
                      className={`mb-1 text-[10px] uppercase tracking-wide ${
                        msg.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {msg.ts}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            {isChatLoading ? <p className="text-xs text-slate-400">Streaming…</p> : null}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <input
              type="text"
              placeholder="Ask the copilot…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage(chatInput);
                }
              }}
            />
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onSaved={() => setSettings(loadSettings())}
      />
    </div>
  );
}
