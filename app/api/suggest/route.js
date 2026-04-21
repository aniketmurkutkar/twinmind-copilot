import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

function normalizeSuggestions(raw) {
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const cleaned = list
    .filter((s) => s && typeof s.preview === 'string')
    .map((s) => ({
      type: typeof s.type === 'string' ? s.type : 'talking_point',
      preview: s.preview.trim(),
      internal_context:
        typeof s.internal_context === 'string'
          ? s.internal_context.trim()
          : '',
    }));

  while (cleaned.length < 3) {
    cleaned.push({
      type: 'clarify',
      preview:
        'Audio slice was thin—ask one clarifying question about the last decision or number mentioned.',
      internal_context: 'Fallback slot because the model returned fewer than 3 items.',
    });
  }

  return cleaned.slice(0, 3);
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 401 });

    const body = await req.json();
    const {
      contextText,
      systemPrompt,
      temperature = 0.35,
    } = body;

    if (!contextText || typeof contextText !== 'string') {
      return NextResponse.json({ error: 'contextText required' }, { status: 400 });
    }
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json({ error: 'systemPrompt required' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Recent transcript (most recent last):\n"""${contextText}"""` },
      ],
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' },
      temperature: typeof temperature === 'number' ? temperature : 0.35,
    });

    let rawContent = chatCompletion.choices[0]?.message?.content || '{}';

    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(rawContent);
    const suggestions = normalizeSuggestions(result);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestion Error:', error);
    return NextResponse.json({ error: error.message || 'Suggest failed' }, { status: 500 });
  }
}
