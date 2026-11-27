import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as chat } from './chat/route';
import { POST as suggest } from './suggest/route';
import { POST as transcribe } from './transcribe/route';

// These tests stub the network so they exercise the real groq-sdk client:
// request URLs and payloads it builds, and how it parses Groq's responses.

const jsonResponse = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const sseResponse = (chunks) => {
  const body =
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
};

const stubFetch = (response) => {
  const fetchMock = vi.fn(async () => response.clone());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const jsonRequest = (path, body) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/chat', () => {
  it('streams the content deltas from Groq as plain text', async () => {
    const fetchMock = stubFetch(
      sseResponse([
        { choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' } }] },
        { choices: [{ index: 0, delta: { content: ', world' } }] },
        { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      ]),
    );

    const res = await chat(
      jsonRequest('/api/chat', {
        systemPrompt: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello, world');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.groq.com/openai/v1/chat/completions');
    const sent = JSON.parse(init.body);
    expect(sent.stream).toBe(true);
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'Be brief.' });
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
  });
});

describe('POST /api/suggest', () => {
  it('requests JSON output and returns normalized suggestions', async () => {
    const content = JSON.stringify({
      suggestions: [
        { type: 'question', preview: 'Ask about budget', internal_context: 'Budget came up.' },
      ],
    });
    const fetchMock = stubFetch(
      jsonResponse({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      }),
    );

    const res = await suggest(
      jsonRequest('/api/suggest', { contextText: 'we need a budget', systemPrompt: 'Suggest.' }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(3);
    expect(data.suggestions[0]).toEqual({
      type: 'question',
      preview: 'Ask about budget',
      internal_context: 'Budget came up.',
    });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.response_format).toEqual({ type: 'json_object' });
  });
});

describe('POST /api/transcribe', () => {
  it('uploads the audio file and returns the transcript text', async () => {
    const fetchMock = stubFetch(jsonResponse({ text: 'hello there' }));

    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'chunk.webm', { type: 'audio/webm' }));
    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      headers: { authorization: 'Bearer test-key' },
      body: form,
    });

    const res = await transcribe(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'hello there' });

    // The SDK probes fetch with a data: URL before its first multipart upload,
    // so pick out the real API call.
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).startsWith('https://'));
    expect(String(url)).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('model')).toBe('whisper-large-v3');
    expect(init.body.get('file').name).toBe('chunk.webm');
  });
});
