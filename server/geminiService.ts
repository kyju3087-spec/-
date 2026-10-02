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

export async function generateEncouragement(
  input: DiaryEncourageRequest
): Promise<DiaryEncourageResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    // If API key is completely missing, return comforting fallback
    return getThoughtfulFallback(input);
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

위 일기를 꼼꼼히 읽고, 일기를 쓴 사용자에게 가슴 깊이 와닿는 따뜻하고 다정한 답장을 작성해주세요.`;

  const config = {
    systemInstruction: `당신은 지친 마음을 포근하게 감싸주고 좋은 날엔 함께 기뻐해주는 세상에서 가장 다정한 '마음 우체부 AI 비서'입니다.
한국어로 정중하면서도 부드러운 해요체(~해요, ~했어요, ~일 거예요)로 말해주세요.
진부하거나 기계적인 조언 대신, 일기 속 사용자의 구체적인 상황과 감정을 짚으며 깊이 공감해주세요.

[필수 요구사항]
1. comfortMessage: 일기 속 상황과 감정(${input.emotion})에 대한 깊은 공감과 위로의 편지 (2~3개 문단, 약 200~350자 내외).
2. tomorrowAction: 내일 사용자가 가볍고 기분 좋게 실행해볼 수 있는 구체적이고 긍정적인 작은 행동 1가지 (예: '점심 후 햇살을 맞으며 10분간 천천히 걷기', '아침에 일어나 따뜻한 물 한 잔 마시며 기지개 켜기' 등 누구나 부담 없이 할 수 있는 실천).
3. actionReason: 이 행동을 추천하는 따뜻한 이유 (이 행동이 마음에 어떤 평온이나 활기를 주는지 설명).
4. cheeringQuote: 하루를 마감하며 침대 맡에서 읽고 위로받을 수 있는 다정한 한 줄 응원 문장.
5. moodSummary: 오늘 하루를 감성적으로 요약해주는 예쁜 표현 (예: "작은 쉼표를 찍은 포근한 밤 🌙").
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

  // Primary model and fallback model list to handle 503 high demand spikes gracefully
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

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
          return parsed;
        }
      }
    } catch (err: any) {
      console.warn(`Model ${model} call failed with:`, err?.message || err);
      // If 503 high demand or temporary unavailable, brief sleep then try next candidate
      if (err?.status === 503 || err?.code === 503 || String(err).includes('503') || String(err).includes('high demand')) {
        await sleep(600);
        continue;
      }
    }
  }

  // If both models temporarily fail due to high demand, provide an emotion-tailored heartfelt reply
  return getThoughtfulFallback(input);
}

// Heartfelt fallback response tailored to user's emotion and diary
function getThoughtfulFallback(input: DiaryEncourageRequest): DiaryEncourageResponse {
  const cleanSnippet = input.content.slice(0, 40).replace(/\n/g, ' ');

  if (input.emotion === '지침') {
    return {
      comfortMessage: `오늘 하루 정말 고생 많으셨어요. "${cleanSnippet}..."라는 이야기를 읽으며, 오늘 하루 당신이 얼마나 무거운 짐을 짊어지고 묵묵히 버텨냈는지 마음 깊이 느껴졌어요.\n\n때로는 아무것도 해내지 않아도, 그저 오늘 하루를 무탈하게 건너온 것만으로도 충분히 칭찬받아 마땅해요. 지금 이 순간만큼은 모든 걱정과 긴장을 털어내고, 오직 당신만을 위한 포근한 쉼을 누리셨으면 좋겠습니다.`,
      tomorrowAction: '내일 아침 일어나 따뜻한 물 한 잔을 마시며 크게 심호흡 3번 하기',
      actionReason: '밤새 굳어있던 몸의 긴장을 풀고, 나에게 다정한 활기를 불어넣어 줄 거예요.',
      cheeringQuote: '오늘 하루를 온전히 버텨낸 당신은 이미 충분히 빛나는 사람입니다.',
      moodSummary: '수고한 나에게 바치는 포근한 쉼표 🌙',
      comfortEmoji: '🌧️',
    };
  }

  if (input.emotion === '불안') {
    return {
      comfortMessage: `마음속에 일렁이는 불안 때문에 밤잠을 설치고 계시진 않나요? "${cleanSnippet}..."라는 생각들이 당신의 마음을 쿡쿡 찔렀을지도 모르겠어요.\n\n불안하다는 것은 그만큼 당신이 스스로의 삶과 내일을 진심으로 아끼고 잘 해내고 싶어 한다는 뜻이기도 해요. 아직 일어나지 않은 내일의 일들은 내일의 당신에게 맡겨두고, 지금은 두 발을 단단히 땅에 딛고 안전하게 쉬어가세요. 다 괜찮아질 거예요.`,
      tomorrowAction: '내일 점심시간에 10분간 스마트폰을 내려놓고 창밖 풍경 바라보기',
      actionReason: '머릿속을 맴돌던 복잡한 생각의 소음을 잠재우고 마음의 시야를 넓혀줍니다.',
      cheeringQuote: '불안은 지나가는 구름일 뿐, 당신이라는 하늘은 늘 푸르고 맑아요.',
      moodSummary: '마음의 닻을 내리는 차분한 저녁 ⚓',
      comfortEmoji: '☁️',
    };
  }

  if (input.emotion === '설렘') {
    return {
      comfortMessage: `일기 너머로 기분 좋은 두근거림이 전해져서 저까지 덩달아 미소가 지어져요! "${cleanSnippet}..."라는 멋진 이야기 속에서 당신의 반짝이는 기대와 생기가 그대로 묻어납니다.\n\n새로운 시작이나 기대감 앞에 서 있는 지금의 설렘은 앞으로 당신이 마주할 멋진 순간들의 다정한 마중물이 되어줄 거예요. 이 설레는 온기를 마음 깊이 간직하세요.`,
      tomorrowAction: '내일 나를 설레게 하는 좋아하는 음악을 들으며 하루를 시작하기',
      actionReason: '두근거리는 좋은 에너지가 하루 종일 기분 좋은 리듬으로 이어질 거예요.',
      cheeringQuote: '기분 좋은 설렘과 함께하는 당신의 내일은 분명 눈부실 거예요.',
      moodSummary: '꽃망울처럼 피어나는 두근거림 🌸',
      comfortEmoji: '✨',
    };
  }

  // 기쁨
  return {
    comfortMessage: `오늘 하루 정말 행복한 순간을 보내셨군요! "${cleanSnippet}..."라는 일기를 읽으며 제 마음까지 따뜻한 온기로 가득 찼어요.\n\n이렇게 작고 큰 기쁨들을 솔직하게 기록하고 기억하는 습관은 앞으로 지친 날들을 버티게 해주는 든든한 마음의 영양제가 되어줍니다. 오늘의 환한 미소를 꼭 기억해주세요!`,
    tomorrowAction: '내일 마주치는 소중한 사람에게 먼저 다정한 인사나 미소 건네기',
    actionReason: '내가 느낀 행복의 온기를 나눌 때, 내 마음의 기쁨도 두 배로 커진답니다.',
    cheeringQuote: '오늘 당신이 품은 미소가 내일의 발걸음도 가볍게 밝혀줄 거예요.',
    moodSummary: '눈부신 햇살처럼 환했던 하루 ☀️',
    comfortEmoji: '💛',
  };
}
