import { EmotionType, AiEncouragement } from '../firebase';

export interface RequestEncouragementParams {
  date: string;
  emotion: EmotionType;
  title: string;
  content: string;
}

export function getUserApiKey(): string {
  try {
    return localStorage.getItem('user_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
}

export function saveUserApiKey(key: string): void {
  try {
    localStorage.setItem('user_gemini_api_key', key.trim());
  } catch (err) {
    console.warn('Failed to save API key to localStorage', err);
  }
}

export function clearUserApiKey(): void {
  try {
    localStorage.removeItem('user_gemini_api_key');
  } catch (err) {
    console.warn('Failed to clear API key', err);
  }
}

export async function checkApiHealth(): Promise<{
  ok: boolean;
  model: string;
  latencyMs: number;
  message: string;
  error?: string;
  isClientKey?: boolean;
}> {
  const localKey = getUserApiKey();

  // 1. Try backend /api/health
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        return data;
      }
    }
  } catch {
    // Continue to check local key
  }

  // 2. If backend failed or lacks key, check client-side key
  if (localKey && localKey.length > 10 && localKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    const startTime = Date.now();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${localKey}`;
      const pingRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: '안녕' }] }] }),
      });

      if (pingRes.ok) {
        return {
          ok: true,
          model: 'gemini-3.1-flash-lite (브라우저 직접 연동)',
          latencyMs: Date.now() - startTime,
          message: 'Google Gemini API와 성공적으로 연결되었습니다!',
          isClientKey: true,
        };
      }

      const errText = await pingRes.text();
      return {
        ok: false,
        model: 'gemini-3.1-flash-lite',
        latencyMs: Date.now() - startTime,
        message: '입력하신 Gemini API 키가 올바르지 않습니다.',
        error: errText,
        isClientKey: true,
      };
    } catch (e: any) {
      return {
        ok: false,
        model: 'unknown',
        latencyMs: 0,
        message: '직접 연결 테스트 중 통신 오류가 발생했습니다.',
        error: e?.message,
      };
    }
  }

  return {
    ok: false,
    model: 'none',
    latencyMs: 0,
    message: 'GEMINI_API_KEY가 등록되지 않았습니다.',
    error: 'Vercel 환경 변수에 키를 등록하거나, 화면의 [API 키 직접 입력]을 이용해주세요.',
  };
}

export async function requestAiEncouragement(
  params: RequestEncouragementParams
): Promise<AiEncouragement> {
  const localKey = getUserApiKey();

  // 1. First try backend /api/encourage
  try {
    const response = await fetch('/api/encourage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localKey ? { 'x-gemini-api-key': localKey } : {}),
      },
      body: JSON.stringify({
        ...params,
        ...(localKey ? { apiKey: localKey } : {}),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data as AiEncouragement;
    }
  } catch {
    // If backend route has an issue or network error, fallback to direct REST
  }

  // 2. Client-side direct REST API fallback using gemini-3.1-flash-lite
  if (localKey && localKey.length > 10 && localKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      const result = await callGeminiRestApiDirect(params, localKey);
      result.modelUsed = 'gemini-3.1-flash-lite (직접 연동)';
      return result;
    } catch (restErr: any) {
      console.warn('Direct REST call failed:', restErr);
      throw new Error(`Gemini API 직접 호출 오류: ${restErr?.message || 'API 키를 다시 확인해주세요.'}`);
    }
  }

  // 3. If neither works, ask user to supply key
  throw new Error(
    'GEMINI_API_KEY가 서버에 등록되지 않았습니다. 상단 [연동 상태 확인]을 눌러 본인의 Gemini API 키를 입력해주시면 즉시 동작합니다!'
  );
}

async function callGeminiRestApiDirect(
  params: RequestEncouragementParams,
  apiKey: string
): Promise<AiEncouragement> {
  // Use gemini-3.1-flash-lite (super stable, fast, empathetic)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `당신은 지친 마음을 포근하게 감싸주고 좋은 날엔 함께 기뻐해주는 세상에서 가장 다정한 '마음 우체부 AI 비서'입니다.
한국어로 정중하면서도 부드러운 해요체(~해요, ~했어요, ~일 거예요)로 말해주세요.
상투적이거나 기계적인 조언 대신, 일기 속 사용자의 구체적인 상황과 감정을 짚으며 깊이 공감해주세요.

오늘의 일기:
- 날짜: ${params.date}
- 사용자의 감정: ${params.emotion}
- 제목: ${params.title || '무제'}
- 내용:
"""
${params.content}
"""

반드시 아래 JSON 형식으로만 답해주세요:
{
  "comfortMessage": "사용자의 감정과 일기에 대한 다정하고 따뜻한 위로와 공감의 메시지 (2~3단락, 약 200~350자)",
  "tomorrowAction": "내일을 위한 구체적이고 부담 없는 긍정적인 작은 행동 1가지",
  "actionReason": "이 행동을 추천하는 이유와 따뜻한 조언",
  "cheeringQuote": "마음을 토닥여주는 따뜻한 한 줄 응원 문구",
  "moodSummary": "오늘 하루에 붙여주는 감성적인 한마디 요약",
  "comfortEmoji": "오늘을 상징하는 따뜻한 이모지 1~2개"
}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Direct API Error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini 응답 텍스트가 비어 있습니다.');
  }

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();

  return JSON.parse(cleaned);
}
