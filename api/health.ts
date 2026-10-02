import { testGeminiConnection } from './geminiService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await testGeminiConnection();
    // Return 200 with result payload so client can inspect status without 500 network error
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      model: 'none',
      latencyMs: 0,
      message: '연결 확인 실패',
      error: error?.message || '알 수 없는 오류',
    });
  }
}
