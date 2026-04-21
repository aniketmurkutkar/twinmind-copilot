'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/defaultSettings';
import { loadSettings, saveSettings } from '../lib/settingsStorage';

export function SettingsModal({ open, onClose, apiKey, onApiKeyChange, onSaved }) {
  const [form, setForm] = useState(() => ({ ...loadSettings() }));

  useEffect(() => {
    if (open) setForm({ ...loadSettings() });
  }, [open]);

  if (!open) return null;

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    saveSettings(form);
    onSaved?.();
    onClose();
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <p className="text-gray-600">
            Groq API key stays in this browser tab memory unless you save other fields below to
            local storage. Keys are never logged by this app&apos;s code paths.
          </p>

          <label className="block">
            <span className="mb-1 block font-medium text-gray-800">Groq API key</span>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 font-mono text-xs"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="gsk_..."
              autoComplete="off"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-medium text-gray-800">Live suggestion context (words)</span>
              <input
                type="number"
                min={50}
                max={4000}
                className="w-full rounded border px-3 py-2"
                value={form.liveSuggestionContextWords}
                onChange={(e) => update('liveSuggestionContextWords', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-800">Chat transcript context (words)</span>
              <input
                type="number"
                min={200}
                max={8000}
                className="w-full rounded border px-3 py-2"
                value={form.chatContextWords}
                onChange={(e) => update('chatContextWords', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-800">Detail-on-click context (words)</span>
              <input
                type="number"
                min={200}
                max={12000}
                className="w-full rounded border px-3 py-2"
                value={form.detailContextWords}
                onChange={(e) => update('detailContextWords', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-800">Suggestion temperature</span>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                className="w-full rounded border px-3 py-2"
                value={form.suggestionTemperature}
                onChange={(e) => update('suggestionTemperature', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-gray-800">Chat temperature</span>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                className="w-full rounded border px-3 py-2"
                value={form.chatTemperature}
                onChange={(e) => update('chatTemperature', Number(e.target.value))}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block font-medium text-gray-800">Live suggestions — system prompt</span>
            <textarea
              className="h-40 w-full rounded border px-3 py-2 font-mono text-xs"
              value={form.liveSuggestionPrompt}
              onChange={(e) => update('liveSuggestionPrompt', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-medium text-gray-800">Detailed answer (suggestion click) — template</span>
            <span className="mb-1 block text-xs text-gray-500">
              Use {'{{TRANSCRIPT}}'}, {'{{SUGGESTION_TYPE}}'}, {'{{SUGGESTION_PREVIEW}}'}, {'{{COACH_NOTES}}'}
            </span>
            <textarea
              className="h-44 w-full rounded border px-3 py-2 font-mono text-xs"
              value={form.detailAnswerPrompt}
              onChange={(e) => update('detailAnswerPrompt', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-medium text-gray-800">Freeform chat — template</span>
            <span className="mb-1 block text-xs text-gray-500">Use {'{{TRANSCRIPT}}'}</span>
            <textarea
              className="h-36 w-full rounded border px-3 py-2 font-mono text-xs"
              value={form.chatPrompt}
              onChange={(e) => update('chatPrompt', e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t bg-gray-50 px-4 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Reset prompts to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
