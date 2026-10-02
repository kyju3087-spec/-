import { testGeminiConnection } from '../server/geminiService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await testGeminiConnection();
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || '연결 확인 실패',
    });
  }
}
