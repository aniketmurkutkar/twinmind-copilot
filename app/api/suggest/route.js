import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { normalizeSuggestions } from '../../lib/suggestions';

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

    const originalContent = chatCompletion.choices[0]?.message?.content || '{}';
    let rawContent = originalContent.trim();

    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let result;
    try {
      result = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('Suggestion JSON parse failed:', parseError.message, '\nRaw output:', originalContent);
      result = {};
    }
    const suggestions = normalizeSuggestions(result);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestion Error:', error);
    return NextResponse.json({ error: error.message || 'Suggest failed' }, { status: 500 });
  }
}
