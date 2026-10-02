import { generateEncouragement, DiaryEncourageRequest } from './geminiService';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: '유효한 요청 본문(JSON)이 전달되지 않았습니다.',
      });
    }

    // Support client-supplied API key fallback if Vercel env is not populated
    const clientKey = (req.headers['x-gemini-api-key'] as string) || body.apiKey;
    if (clientKey && !process.env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = clientKey;
    }

    const { date, emotion, title, content } = body as DiaryEncourageRequest;

    if (!content || !emotion) {
      return res.status(400).json({
        error: '일기 내용(content)과 감정(emotion: 기쁨, 지침, 설렘, 불안)을 모두 입력해주세요.',
      });
    }

    const result = await generateEncouragement({ date, emotion, title, content });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel API error in encourage.ts:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini API 처리 중 오류가 발생했습니다.',
    });
  }
}
