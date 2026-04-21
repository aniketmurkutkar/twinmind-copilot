import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('file');

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Initialize the SDK with the user's key
    const groq = new Groq({ apiKey });

    // Let the SDK handle the multipart/form-data boundaries automatically
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
    });

    return NextResponse.json({ text: transcription.text });
    
  } catch (error) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}