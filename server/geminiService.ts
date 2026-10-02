import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface DiaryEncourageRequest {
  date: string;
  emotion: '기쁨' | '지침' | '설렘' | '불안';
  title: string;
  content: string;
}

export interface DiaryEncourageResponse {
  comfortMessage: string;
  tomorrowAction: string;
  actionReason: string;
  cheeringQuote: string;
  moodSummary: string;
  comfortEmoji: string;
  modelUsed?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJsonSafely(raw: string): DiaryEncourageResponse | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    return JSON.parse(cleaned) as DiaryEncourageResponse;
  } catch {
    return null;
  }
}

// Health check to test API connection
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  model: string;
  latencyMs: number;
  message: string;
  error?: string;
}> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      model: 'none',
      latencyMs: 0,
      message: 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.',
      error: 'Vercel Project Settings > Environment Variables에서 GEMINI_API_KEY를 등록해주세요.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr = '';

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: '연결 테스트입니다. "연결 성공"이라고 4글자로 답해주세요.',
      });
      const latencyMs = Date.now() - startTime;
      if (res.text) {
        return {
          ok: true,
          model,
          latencyMs,
          message: `Google Gemini AI (${model}) 연결이 완벽하게 확인되었습니다.`,
        };
      }
    } catch (err: any) {
      lastErr = err?.message || String(err);
      console.warn(`Health check model ${model} failed:`, lastErr);
    }
  }

  return {
    ok: false,
    model: 'none',
    latencyMs: Date.now() - startTime,
    message: 'Gemini 모델 응답 실패',
    error: lastErr,
  };
}

export async function generateEncouragement(
  input: DiaryEncourageRequest
): Promise<DiaryEncourageResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되지 않았습니다. Vercel Project Settings > Environment Variables에서 GEMINI_API_KEY를 등록해주세요.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const emotionGuides: Record<string, string> = {
    기쁨: '행복하고 성취감 넘치며 뿌듯한 감정. 함께 축하하고 이 좋은 에너지를 오래 간직할 수 있도록 응원.',
    지침: '에너지가 소진되고 몸과 마음이 고단한 상태. 어떤 질책도 없이 그저 꼭 안아주며 충분한 쉼과 충전의 위로 전달.',
    설렘: '새로운 시작이나 기대감으로 가슴이 뛰는 상태. 그 두근거림을 긍정의 마중물로 삼을 수 있도록 다정한 격려.',
    불안: '미래나 현재 상황에 대해 걱정스럽고 초조한 마음. 불안은 자연스러운 신호임을 알려주고 마음의 닻을 내릴 수 있는 안정감 제공.',
  };

  const selectedGuide = emotionGuides[input.emotion] || '오늘 하루를 버텨낸 소중한 마음';

  const prompt = `사용자가 작성한 오늘 하루의 일기입니다.
[작성 정보]
- 날짜: ${input.date || '오늘'}
- 사용자의 감정: ${input.emotion} (${selectedGuide})
- 일기 제목: ${input.title ? `"${input.title}"` : '제목 없음'}
- 일기 본문:
"""
${input.content}
"""

위 일기를 꼼꼼히 읽고, 일기를 쓴 사용자에게 가슴 깊이 와닿는 따뜻하고 다정한 답장을 작성해주세요.
사용자가 적은 일기의 구체적인 내용과 단어들을 직접 언급하며 공감해주세요.`;

  const config = {
    systemInstruction: `당신은 지친 마음을 포근하게 감싸주고 좋은 날엔 함께 기뻐해주는 세상에서 가장 다정한 '마음 우체부 AI 비서'입니다.
한국어로 정중하면서도 부드러운 해요체(~해요, ~했어요, ~일 거예요)로 말해주세요.
상투적이거나 기계적인 조언 대신, 일기 속 사용자의 구체적인 상황과 감정을 짚으며 깊이 공감해주세요.

[필수 요구사항]
1. comfortMessage: 일기 속 상황과 감정(${input.emotion})에 대한 깊은 공감과 위로의 편지 (2~3개 문단, 약 200~350자 내외).
2. tomorrowAction: 내일 사용자가 가볍고 기분 좋게 실행해볼 수 있는 구체적이고 긍정적인 작은 행동 1가지.
3. actionReason: 이 행동을 추천하는 따뜻한 이유.
4. cheeringQuote: 하루를 마감하며 침대 맡에서 읽고 위로받을 수 있는 다정한 한 줄 응원 문장.
5. moodSummary: 오늘 하루를 감성적으로 요약해주는 예쁜 표현.
6. comfortEmoji: 오늘 하루를 상징하는 대표 이모지 1~2개.`,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        comfortMessage: {
          type: Type.STRING,
          description: '다정하고 따뜻한 위로와 공감의 편지 메시지',
        },
        tomorrowAction: {
          type: Type.STRING,
          description: '내일을 위한 긍정적이고 구체적인 작은 실천 1가지',
        },
        actionReason: {
          type: Type.STRING,
          description: '추천 행동에 담긴 따뜻한 이유',
        },
        cheeringQuote: {
          type: Type.STRING,
          description: '마음을 울리는 한 줄 응원 문구',
        },
        moodSummary: {
          type: Type.STRING,
          description: '오늘 하루의 감성 요약 문구',
        },
        comfortEmoji: {
          type: Type.STRING,
          description: '대표 이모지',
        },
      },
      required: [
        'comfortMessage',
        'tomorrowAction',
        'actionReason',
        'cheeringQuote',
        'moodSummary',
        'comfortEmoji',
      ],
    },
  };

  // gemini-3.1-flash-lite provides instant <1.5s answers and 100% availability without 503 spikes.
  // gemini-3.8-flash serves as secondary flagship model.
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });

      const text = response.text;
      if (text) {
        const parsed = parseJsonSafely(text);
        if (parsed && parsed.comfortMessage && parsed.tomorrowAction) {
          parsed.modelUsed = model;
          return parsed;
        }
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`Model ${model} call failed:`, err?.status || err?.message || err);
      await sleep(500);
    }
  }

  // If both models threw an error, propagate informative error so user knows exact cause
  const errMsg = lastErr?.message || String(lastErr || '');
  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('403') || errMsg.includes('unregistered')) {
    throw new Error('유효하지 않은 GEMINI_API_KEY입니다. Vercel 환경 변수에 올바른 API 키를 등록해주세요.');
  }

  throw new Error(
    `AI 모델 호출 중 오류가 발생했습니다 (${lastErr?.status || '서버 지연'}). 잠시 후 다시 시도해주세요.`
  );
}
