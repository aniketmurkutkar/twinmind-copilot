import Groq from 'groq-sdk';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    if (!apiKey) return new Response('No API key', { status: 401 });

    const { systemPrompt, messages, temperature = 0.55 } = await req.json();

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return new Response('systemPrompt required', { status: 400 });
    }
    if (!Array.isArray(messages)) {
      return new Response('messages array required', { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const payloadMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    const stream = await groq.chat.completions.create({
      messages: payloadMessages,
      model: 'openai/gpt-oss-120b',
      stream: true,
      temperature: typeof temperature === 'number' ? temperature : 0.55,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) controller.enqueue(new TextEncoder().encode(content));
          }
        } catch (e) {
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Chat Error:', error);
    return new Response(error.message || 'Chat failed', { status: 500 });
  }
}
