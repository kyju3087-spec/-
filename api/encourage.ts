import { generateEncouragement, DiaryEncourageRequest } from '../server/geminiService';

async function parseRequestBody(req: any): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body: DiaryEncourageRequest = await parseRequestBody(req);

    if (!body || !body.content || !body.emotion) {
      return res.status(400).json({
        error: '일기 내용(content)과 감정(emotion: 기쁨, 지침, 설렘, 불안)을 전달해주세요.',
      });
    }

    const result = await generateEncouragement(body);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error generating encouragement:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini API 처리 중 오류가 발생했습니다.',
    });
  }
}
