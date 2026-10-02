import { EmotionType, AiEncouragement } from '../firebase';

export interface RequestEncouragementParams {
  date: string;
  emotion: EmotionType;
  title: string;
  content: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestAiEncouragement(
  params: RequestEncouragementParams
): Promise<AiEncouragement> {
  let lastError: any = null;

  // Try calling backend with up to 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch('/api/encourage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const data = await response.json();
        return data as AiEncouragement;
      }

      // Check if 503 or transient error
      if (response.status === 503) {
        if (attempt < 2) {
          await sleep(1000);
          continue;
        }
      }

      // Try fallback route /api/gemini/encourage if 404
      if (response.status === 404) {
        const altResponse = await fetch('/api/gemini/encourage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (altResponse.ok) {
          return (await altResponse.json()) as AiEncouragement;
        }
      }

      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `서버 응답 오류 (상태 코드: ${response.status})`);
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await sleep(800);
      }
    }
  }

  // If server call still failed, try direct client REST API if VITE_GEMINI_API_KEY is configured
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (viteKey && viteKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      return await callGeminiRestApiDirect(params, viteKey);
    } catch (restErr: any) {
      console.warn('Direct REST fallback failed:', restErr);
    }
  }

  // Graceful emotion-tailored fallback so the user experience is never broken
  return generateClientFallback(params);
}

function generateClientFallback(params: RequestEncouragementParams): AiEncouragement {
  const snippet = params.content.slice(0, 40).replace(/\n/g, ' ');

  if (params.emotion === '지침') {
    return {
      comfortMessage: `오늘 하루 정말 수고 많으셨어요. "${snippet}..."라는 이야기를 마주하며 오늘 하루 온 힘을 다해 버텨낸 당신의 무거운 발걸음이 느껴졌어요.\n\n때로는 아무것도 증명하지 않고 그저 오늘을 무사히 버텨낸 것만으로도 충분히 잘한 하루입니다. 지금 이 순간만큼은 모든 걱정을 내려놓고 포근한 밤을 맞이하세요.`,
      tomorrowAction: '내일 아침 일어나 따뜻한 물 한 잔 마시며 가볍게 기지개 켜기',
      actionReason: '굳어있던 몸의 긴장을 풀고 스스로에게 다정한 활기를 선물해 줍니다.',
      cheeringQuote: '오늘 하루를 묵묵히 버텨낸 당신은 이미 충분히 훌륭합니다.',
      moodSummary: '지친 나를 꼭 안아주는 포근한 밤 🌙',
      comfortEmoji: '🌧️',
    };
  }

  if (params.emotion === '불안') {
    return {
      comfortMessage: `마음 한 켠에 불쑥 찾아온 불안 때문에 마음이 많이 시리셨죠? "${snippet}..."라는 고민들은 당신이 그만큼 스스로의 삶을 소중히 여기기 때문에 생겨난 파도일 거예요.\n\n불안은 그저 스쳐 지나가는 구름일 뿐, 당신이라는 하늘은 여전히 맑고 단단합니다. 깊게 숨을 들이쉬고 내쉬며 천천히 마음의 안식처를 찾아보세요.`,
      tomorrowAction: '내일 점심 후 10분 동안 스마트폰 없이 햇볕 쬐며 천천히 걷기',
      actionReason: '복잡한 생각의 소음을 가라앉히고 오롯이 현재의 평온에 집중할 수 있습니다.',
      cheeringQuote: '불안한 마음 너머로 반드시 평온한 내일이 찾아올 거예요.',
      moodSummary: '마음의 닻을 내리는 차분한 쉼표 ⚓',
      comfortEmoji: '☁️',
    };
  }

  if (params.emotion === '설렘') {
    return {
      comfortMessage: `일기 너머로 설레는 두근거림이 고스란히 전해져요! "${snippet}..."라는 이야기 속에서 싹튼 기분 좋은 기대감이 당신의 내일을 더욱 눈부시게 밝혀줄 거예요.\n\n새로운 시작이나 기대감 앞에 서 있는 지금의 두근거림을 있는 힘껏 축복하고 즐겨보세요. 분명 멋진 일이 기다리고 있을 거예요!`,
      tomorrowAction: '내일 나를 가장 기분 좋게 만드는 좋아하는 노래를 들으며 하루 시작하기',
      actionReason: '설레는 좋은 감정이 하루 종일 긍정적인 활력으로 이어집니다.',
      cheeringQuote: '설레는 마음으로 내딛는 당신의 모든 발걸음을 응원합니다.',
      moodSummary: '꽃망울처럼 피어난 두근거림 🌸',
      comfortEmoji: '✨',
    };
  }

  // 기쁨
  return {
    comfortMessage: `오늘 하루 정말 행복하고 뿌듯한 순간을 보내셨군요! "${snippet}..."라는 이야기를 읽으며 저까지 덩달아 가슴 벅찬 미소가 지어졌어요.\n\n이렇게 마음에 남은 예쁜 기쁨들을 일기로 기록해두면, 훗날 지치는 날에도 다시 일어설 수 있는 소중한 보물이 됩니다. 오늘의 행복을 오래도록 간직하세요!`,
    tomorrowAction: '내일 고마운 사람이나 스스로에게 따뜻한 칭찬 한마디 건네기',
    actionReason: '내가 느낀 행복의 온기를 나눌 때, 내 마음의 기쁨도 두 배로 커집니다.',
    cheeringQuote: '오늘 당신이 품은 미소가 내일의 하루도 환하게 밝혀줄 거예요.',
    moodSummary: '황금빛 햇살처럼 환했던 하루 ☀️',
    comfortEmoji: '💛',
  };
}

async function callGeminiRestApiDirect(
  params: RequestEncouragementParams,
  apiKey: string
): Promise<AiEncouragement> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `오늘의 일기:
- 날짜: ${params.date}
- 사용자의 감정: ${params.emotion}
- 제목: ${params.title || '무제'}
- 내용: ${params.content}

당신은 사용자의 지친 마음을 다정하게 위로하고 내일을 위한 긍정 행동 1가지를 제안하는 마음 우체부 AI 비서입니다.
반드시 아래 JSON 형식으로만 답해주세요:
{
  "comfortMessage": "사용자의 감정과 일기에 대한 다정하고 따뜻한 위로와 공감의 메시지 (2~3단락)",
  "tomorrowAction": "내일을 위한 구체적이고 부담 없는 긍정적인 작은 행동 1가지",
  "actionReason": "이 행동을 추천하는 이유와 따뜻한 조언",
  "cheeringQuote": "마음을 토닥여주는 따뜻한 한 줄 응원 문구",
  "moodSummary": "오늘 하루에 붙여주는 감성적인 한마디 요약",
  "comfortEmoji": "오늘을 상징하는 따뜻한 이모지 1개"
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
    throw new Error(`Gemini Direct API Error: ${res.status} - ${errText}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}
