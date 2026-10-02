/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId } from 'react';
import {
  Sparkles,
  Heart,
  BookOpen,
  PenLine,
  Calendar,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Trash2,
  Smile,
  CloudRain,
  Flower2,
  CloudAlert,
  Sun,
  Send,
  RefreshCw,
  Quote,
  Feather,
  Cloud,
  CheckCircle2,
  Compass,
  ChevronDown,
  ChevronUp,
  Search,
  Filter
} from 'lucide-react';
import {
  EmotionType,
  DiaryEntry,
  AiEncouragement,
  saveDiaryToDb,
  fetchDiariesFromDb,
  deleteDiaryFromDb
} from './firebase';
import { requestAiEncouragement, checkApiHealth } from './services/geminiApi';

// Emotion definitions with aesthetic color schemes & descriptions
interface EmotionOption {
  type: EmotionType;
  label: string;
  icon: React.ReactNode;
  tagline: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  cardActiveBg: string;
  cardActiveBorder: string;
}

const EMOTIONS: EmotionOption[] = [
  {
    type: '기쁨',
    label: '기쁨',
    icon: <Sun className="w-5 h-5 text-amber-500" />,
    tagline: '햇살처럼 환하고 뿌듯했던 순간',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    textColor: 'text-amber-800',
    cardActiveBg: 'bg-amber-50/80',
    cardActiveBorder: 'border-amber-400 ring-2 ring-amber-300/40',
  },
  {
    type: '지침',
    label: '지침',
    icon: <CloudRain className="w-5 h-5 text-slate-500" />,
    tagline: '온 힘을 다해 버텨내어 쉼이 필요한 오늘',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    textColor: 'text-slate-700',
    cardActiveBg: 'bg-slate-50/90',
    cardActiveBorder: 'border-slate-400 ring-2 ring-slate-300/40',
  },
  {
    type: '설렘',
    label: '설렘',
    icon: <Flower2 className="w-5 h-5 text-rose-500" />,
    tagline: '두근거리는 기대와 꽃망울이 핀 오늘',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    textColor: 'text-rose-800',
    cardActiveBg: 'bg-rose-50/80',
    cardActiveBorder: 'border-rose-400 ring-2 ring-rose-300/40',
  },
  {
    type: '불안',
    label: '불안',
    icon: <CloudAlert className="w-5 h-5 text-teal-600" />,
    tagline: '마음이 일렁이고 차분한 위로가 필요한 오늘',
    badgeBg: 'bg-teal-50',
    badgeBorder: 'border-teal-200',
    textColor: 'text-teal-800',
    cardActiveBg: 'bg-teal-50/80',
    cardActiveBorder: 'border-teal-400 ring-2 ring-teal-300/40',
  },
];

const WRITING_PROMPTS = [
  '오늘 나를 가장 미소 짓게 했던 순간은?',
  '마음속에 꼭꼭 숨겨두었던 솔직한 한마디',
  '오늘 하루 열심히 고생한 나에게 하고 싶은 말',
  '내일 나에게 선물해주고 싶은 소소한 쉼',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'write' | 'archive' | 'stats'>('write');
  
  // Diary form states
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType>('기쁨');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Generation & Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentAiResponse, setCurrentAiResponse] = useState<AiEncouragement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Database list & history
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // API Connection Health State
  const [apiHealth, setApiHealth] = useState<{
    checking: boolean;
    checked: boolean;
    ok?: boolean;
    message?: string;
    model?: string;
    latencyMs?: number;
    error?: string;
  }>({ checking: false, checked: false });
  const [showHealthModal, setShowHealthModal] = useState(false);

  const handleCheckApiHealth = async () => {
    setApiHealth((prev) => ({ ...prev, checking: true }));
    setShowHealthModal(true);
    try {
      const res = await checkApiHealth();
      setApiHealth({
        checking: false,
        checked: true,
        ok: res.ok,
        message: res.message,
        model: res.model,
        latencyMs: res.latencyMs,
        error: res.error,
      });
    } catch (err: any) {
      setApiHealth({
        checking: false,
        checked: true,
        ok: false,
        message: '서버 연결 상태 점검 중 오류가 발생했습니다.',
        error: err?.message,
      });
    }
  };

  // Load entries on mount and check API health
  useEffect(() => {
    async function loadData() {
      setIsDbLoading(true);
      try {
        const list = await fetchDiariesFromDb();
        setDiaries(list);
      } catch (err) {
        console.error('Error fetching diaries:', err);
      } finally {
        setIsDbLoading(false);
      }
    }
    loadData();
    // Silent initial check
    checkApiHealth()
      .then((res) => {
        setApiHealth({
          checking: false,
          checked: true,
          ok: res.ok,
          message: res.message,
          model: res.model,
          latencyMs: res.latencyMs,
          error: res.error,
        });
      })
      .catch(() => {});
  }, []);

  // Handle Speech Synthesis (Reading the AI letter)
  const toggleSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('현재 브라우저에서는 음성 읽기 기능을 지원하지 않습니다.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95; // Gentle and calming tempo
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Submit diary to Gemini AI
  const handleSubmitDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMessage('오늘 하루 있었던 일이나 마음속 생각을 적어주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      // 1. Call Gemini API to get encouraging AI reply
      const aiResponse = await requestAiEncouragement({
        date,
        emotion: selectedEmotion,
        title: title.trim(),
        content: content.trim(),
      });

      setCurrentAiResponse(aiResponse);

      // 2. Persist to Firebase Firestore & LocalStorage
      const savedEntry = await saveDiaryToDb({
        date,
        emotion: selectedEmotion,
        title: title.trim(),
        content: content.trim(),
        aiResponse,
      });

      // Update state
      setDiaries((prev) => [savedEntry, ...prev.filter((d) => d.id !== savedEntry.id)]);

      // Scroll smoothly to the letter
      setTimeout(() => {
        const letterElem = document.getElementById('ai-letter-section');
        if (letterElem) {
          letterElem.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Diary submit error:', err);
      setErrorMessage(
        err.message || 'AI 비서와의 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Copy AI letter to clipboard
  const handleCopyLetter = (letterText: string) => {
    navigator.clipboard.writeText(letterText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Reset form for a fresh new entry
  const handleNewDiary = () => {
    setTitle('');
    setContent('');
    setCurrentAiResponse(null);
    setErrorMessage(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    const formElem = document.getElementById('diary-form-section');
    if (formElem) {
      formElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Delete diary entry
  const handleDeleteDiary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 일기를 정말 삭제하시겠어요?')) return;

    try {
      await deleteDiaryFromDb(id);
      setDiaries((prev) => prev.filter((d) => d.id !== id));
      if (expandedEntryId === id) setExpandedEntryId(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Filtered diaries for Archive
  const filteredDiaries = diaries.filter((d) => {
    const matchesEmotion = filterEmotion === 'all' || d.emotion === filterEmotion;
    const matchesKeyword =
      !searchKeyword ||
      d.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      d.content.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (d.aiResponse?.comfortMessage &&
        d.aiResponse.comfortMessage.toLowerCase().includes(searchKeyword.toLowerCase()));
    return matchesEmotion && matchesKeyword;
  });

  // Mood counts for Stats
  const emotionStats = {
    기쁨: diaries.filter((d) => d.emotion === '기쁨').length,
    지침: diaries.filter((d) => d.emotion === '지침').length,
    설렘: diaries.filter((d) => d.emotion === '설렘').length,
    불안: diaries.filter((d) => d.emotion === '불안').length,
  };

  const selectedEmotionObj = EMOTIONS.find((e) => e.type === selectedEmotion) || EMOTIONS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2825]">
      {/* Top Warm Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-stone-200/70">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-sm border border-amber-200/60">
              <Heart className="w-5 h-5 fill-amber-500 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
                따뜻한 하루 일기
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 font-medium">
                  AI 위로 우체부
                </span>
              </h1>
              <p className="text-xs text-stone-500 hidden sm:block">
                당신의 오늘을 감싸주는 다정한 편지와 내일의 작은 행복
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Health Indicator */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckApiHealth}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all bg-white hover:bg-stone-50 border-stone-200 text-stone-700 shadow-2xs"
              title="Google Gemini AI 연결 상태 확인"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiHealth.checking
                    ? 'bg-amber-400 animate-pulse'
                    : apiHealth.ok
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">
                {apiHealth.checking
                  ? '점검 중...'
                  : apiHealth.ok
                  ? 'AI 연동 정상'
                  : '연동 상태 확인'}
              </span>
            </button>

            <nav className="flex items-center gap-1 bg-stone-200/60 p-1 rounded-xl text-xs sm:text-sm font-medium">
              <button
                onClick={() => setActiveTab('write')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'write'
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <PenLine className="w-4 h-4" />
                <span>일기 쓰기</span>
              </button>
              <button
                onClick={() => setActiveTab('archive')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'archive'
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>마음 서랍</span>
                {diaries.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                    {diaries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'stats'
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span className="hidden sm:inline">마음 날씨</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Health Modal / Connection Checker Popup */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-stone-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    apiHealth.checking
                      ? 'bg-amber-400 animate-pulse'
                      : apiHealth.ok
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                  }`}
                />
                <h3 className="text-base font-bold text-stone-900">
                  Google Gemini AI 연동 진단
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div
              className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-2 ${
                apiHealth.checking
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : apiHealth.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {apiHealth.checking ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Google Gemini API 실시간 통신을 점검하고 있습니다...</span>
                </div>
              ) : apiHealth.ok ? (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>연동 상태: 정상 작동 중</span>
                  </div>
                  <p className="mt-1 text-emerald-700">
                    {apiHealth.message}
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px] text-emerald-800">
                    <div>
                      <span className="opacity-70">활성 모델: </span>
                      <strong>{apiHealth.model}</strong>
                    </div>
                    <div>
                      <span className="opacity-70">응답 속도: </span>
                      <strong>{apiHealth.latencyMs}ms</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-rose-800 text-sm flex items-center gap-1.5">
                    <span>연동 상태: 점검 필요</span>
                  </div>
                  <p className="mt-1 text-rose-700">{apiHealth.message}</p>
                  {apiHealth.error && (
                    <div className="mt-2 p-2 rounded-xl bg-white/80 border border-rose-200/80 text-[11px] font-mono text-rose-800 break-all">
                      {apiHealth.error}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-rose-600">
                    💡 Vercel 배포 사이트라면 Vercel Settings ➡️ Environment Variables에{' '}
                    <strong>GEMINI_API_KEY</strong>가 등록되어 있는지 확인해주세요.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCheckApiHealth}
                disabled={apiHealth.checking}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${apiHealth.checking ? 'animate-spin' : ''}`} />
                <span>다시 점검하기</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* TAB 1: WRITE TODAY'S DIARY */}
        {activeTab === 'write' && (
          <div className="space-y-8">
            {/* Encouraging Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-stone-100/60 p-6 sm:p-8 border border-amber-200/50 shadow-sm">
              <div className="relative z-10 max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-amber-200/60 text-xs font-medium text-amber-800">
                  <Feather className="w-3.5 h-3.5 text-amber-600" />
                  <span>오늘 하루도 참 애쓰셨어요</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
                  말하지 못했던 마음을 여기에 살포시 내려놓으세요.
                </h2>
                <p className="text-sm text-stone-600 leading-relaxed">
                  오늘 있었던 일과 감정을 적어주시면, Google Gemini AI 비서가 당신만을 위한 따뜻한
                  위로의 편지와 내일을 기분 좋게 시작할 수 있는 작은 행동 1가지를 답장해 드립니다.
                </p>
              </div>

              {/* Decorative background circle */}
              <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-amber-200/30 blur-2xl pointer-events-none" />
            </div>

            {/* Diary Form */}
            <section
              id="diary-form-section"
              className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm transition-all"
            >
              <form onSubmit={handleSubmitDiary} className="space-y-6">
                {/* 1. Date and Emotion Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                      기록 날짜
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
                      required
                    />
                  </div>

                  {/* Diary Title */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-stone-500" />
                      오늘 하루의 한 줄 제목 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 긴 하루 끝에 찾아온 조용한 저녁, 뿌듯했던 프로젝트 발표..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={60}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* 2. Emotion Selector (기쁨, 지침, 설렘, 불안) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5 text-stone-500" />
                      오늘 나의 지배적인 감정은 어떤 색이었나요?
                    </label>
                    <span className="text-xs text-stone-400">4가지 중 하나를 선택해주세요</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {EMOTIONS.map((emo) => {
                      const isSelected = selectedEmotion === emo.type;
                      return (
                        <button
                          key={emo.type}
                          type="button"
                          onClick={() => setSelectedEmotion(emo.type)}
                          className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? `${emo.cardActiveBg} ${emo.cardActiveBorder} shadow-sm`
                              : 'border-stone-200 bg-stone-50/40 hover:bg-stone-100/60 text-stone-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <span className="p-1 rounded-xl bg-white shadow-xs">
                              {emo.icon}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <span className={`text-sm font-bold ${isSelected ? emo.textColor : 'text-stone-800'}`}>
                            {emo.label}
                          </span>
                          <span className="text-[11px] text-stone-500 mt-0.5 line-clamp-1 leading-tight">
                            {emo.tagline}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Diary Content Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                      <PenLine className="w-3.5 h-3.5 text-stone-500" />
                      오늘 있었던 일과 속마음
                    </label>
                    <span className="text-xs text-stone-400">
                      {content.length}자 작성됨
                    </span>
                  </div>

                  <textarea
                    rows={7}
                    placeholder="오늘 어떤 하루를 보내셨나요? 사소한 순간도, 온전히 털어놓지 못했던 무거운 마음도 괜찮아요. 편안하게 당신의 이야기를 들려주세요."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-stone-200 bg-stone-50/30 text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all resize-y"
                    required
                  />

                  {/* Writing prompts assistance chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-stone-400">생각이 막힐 땐:</span>
                    {WRITING_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setContent((prev) => (prev ? `${prev}\n\n[${prompt}]\n` : `[${prompt}]\n`));
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 hover:bg-amber-100 hover:text-amber-800 text-stone-600 border border-stone-200/60 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-rose-200 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        !
                      </div>
                      <div>
                        <p className="font-semibold">답장 생성 중 확인이 필요합니다</p>
                        <p className="text-rose-700 mt-0.5">{errorMessage}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={handleCheckApiHealth}
                        className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors"
                      >
                        API 연동 진단
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-stone-500 flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5 text-stone-400" />
                    <span>Google Gemini 3.1 Flash / 3.8 Flash 모델 연동</span>
                    <button
                      type="button"
                      onClick={handleCheckApiHealth}
                      className="text-amber-700 hover:text-amber-900 font-medium underline text-[11px] cursor-pointer"
                    >
                      연동 확인
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !content.trim()}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>AI 비서가 일기를 읽고 다정하게 편지를 쓰는 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>AI 비서에게 일기 보여주기</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* AI LETTER SECTION (Response) */}
            {currentAiResponse && (
              <section
                id="ai-letter-section"
                className="relative overflow-hidden rounded-3xl bg-[#FFFDF9] border border-amber-200/90 shadow-lg p-6 sm:p-10 letter-shadow transition-all"
              >
                {/* Decorative letter stamp / seal */}
                <div className="flex items-center justify-between border-b border-amber-100 pb-5 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-2xl shadow-xs">
                      {currentAiResponse.comfortEmoji || '💌'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-stone-900">
                          다정한 마음 우체부 AI의 답장
                        </h3>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {date}의 편지
                        </span>
                        {currentAiResponse.modelUsed && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {currentAiResponse.modelUsed}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {currentAiResponse.moodSummary}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons: Speech & Copy */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSpeech(
                          `${currentAiResponse.comfortMessage}. 내일을 위한 작은 실천입니다. ${currentAiResponse.tomorrowAction}. ${currentAiResponse.actionReason}. ${currentAiResponse.cheeringQuote}`
                        )
                      }
                      title="음성으로 편지 듣기"
                      className={`p-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                        isSpeaking
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-4 h-4 text-amber-600" />
                          <span className="hidden sm:inline">읽기 중단</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4 text-stone-500" />
                          <span className="hidden sm:inline">음성으로 듣기</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyLetter(
                          `[따뜻한 하루 일기 - AI 비서의 답장]\n\n${currentAiResponse.comfortMessage}\n\n🌿 내일을 위한 긍정 행동:\n${currentAiResponse.tomorrowAction}\n(${currentAiResponse.actionReason})\n\n✨ 오늘의 응원:\n"${currentAiResponse.cheeringQuote}"`
                        )
                      }
                      className="p-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="편지 복사하기"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">복사</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 1. Comfort Message (Warm reply) */}
                <div className="space-y-4 text-stone-800 leading-relaxed text-sm sm:text-base font-normal">
                  <div className="p-4 sm:p-6 rounded-2xl bg-amber-50/40 border border-amber-100/70 whitespace-pre-line">
                    {currentAiResponse.comfortMessage}
                  </div>
                </div>

                {/* 2. Tomorrow's Positive Action (Core requirement) */}
                <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-amber-50/40 border border-emerald-200/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase">
                      내일을 위한 긍정 실천 1가지
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-emerald-950">
                    {currentAiResponse.tomorrowAction}
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-800/90 leading-relaxed">
                    💡 {currentAiResponse.actionReason}
                  </p>
                </div>

                {/* 3. Cheering Quote */}
                <div className="mt-5 p-4 rounded-xl bg-stone-100/80 border border-stone-200/60 text-center">
                  <p className="text-xs sm:text-sm font-semibold text-stone-700 italic">
                    "{currentAiResponse.cheeringQuote}"
                  </p>
                </div>

                {/* Bottom actions: New diary / View in archive */}
                <div className="mt-8 pt-5 border-t border-amber-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>이 일기와 답장은 마음 서랍장에 안전하게 저장되었습니다.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('archive')}
                      className="px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors"
                    >
                      서랍장에서 확인
                    </button>
                    <button
                      type="button"
                      onClick={handleNewDiary}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      새 일기 쓰기
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: ARCHIVE (마음 서랍장) */}
        {activeTab === 'archive' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stone-900">마음 서랍장</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  내가 기록한 소중한 하루들과 AI 비서의 다정한 답장 모음
                </p>
              </div>

              <button
                onClick={() => setActiveTab('write')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>새 일기 작성하기</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-xs">
              {/* Emotion Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilterEmotion('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                    filterEmotion === 'all'
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  전체 ({diaries.length})
                </button>
                {EMOTIONS.map((e) => {
                  const count = diaries.filter((d) => d.emotion === e.type).length;
                  return (
                    <button
                      key={e.type}
                      type="button"
                      onClick={() => setFilterEmotion(e.type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                        filterEmotion === e.type
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span>{e.label}</span>
                      <span className="opacity-80 text-[11px]">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Keyword Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="일기 내용 검색..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
            </div>

            {/* List of Diaries */}
            {isDbLoading ? (
              <div className="p-12 text-center text-stone-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                <p className="text-sm">서랍 속 일기를 불러오는 중입니다...</p>
              </div>
            ) : filteredDiaries.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-800">
                  {searchKeyword || filterEmotion !== 'all'
                    ? '조건에 맞는 일기가 없습니다.'
                    : '아직 기록된 일기가 없어요.'}
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  오늘 하루 느꼈던 감정과 작은 일들을 첫 번째 일기로 남겨보세요. AI 비서가 다정하게
                  기다리고 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  첫 일기 작성하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDiaries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const emoMeta = EMOTIONS.find((e) => e.type === entry.emotion) || EMOTIONS[0];

                  return (
                    <article
                      key={entry.id}
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="bg-white rounded-2xl p-5 border border-stone-200/80 hover:border-amber-300/80 shadow-xs hover:shadow-sm transition-all cursor-pointer space-y-3"
                    >
                      {/* Entry Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 ${emoMeta.badgeBg} ${emoMeta.badgeBorder} ${emoMeta.textColor} border`}
                          >
                            {emoMeta.icon}
                            <span>{entry.emotion}</span>
                          </span>
                          <span className="text-xs text-stone-500 font-medium">
                            {entry.date}
                          </span>
                          {entry.isSyncedToCloud && (
                            <span
                              title="Firebase 클라우드 동기화 완료"
                              className="text-[10px] text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="hidden sm:inline">동기화됨</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDiary(entry.id, e)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="일기 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="text-stone-400 p-1">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Entry Title & Snippet */}
                      <div>
                        {entry.title && (
                          <h4 className="text-sm sm:text-base font-bold text-stone-900 mb-1">
                            {entry.title}
                          </h4>
                        )}
                        <p
                          className={`text-xs sm:text-sm text-stone-600 leading-relaxed whitespace-pre-line ${
                            isExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {entry.content}
                        </p>
                      </div>

                      {/* Expanded Section: AI Letter */}
                      {isExpanded && entry.aiResponse && (
                        <div
                          className="mt-4 pt-4 border-t border-stone-100 space-y-4 bg-amber-50/30 -mx-5 -mb-5 p-5 rounded-b-2xl border-t-amber-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {entry.aiResponse.comfortEmoji || '💌'}
                              </span>
                              <span className="text-xs font-bold text-stone-800">
                                AI 비서의 다정한 편지
                              </span>
                              <span className="text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full font-medium">
                                {entry.aiResponse.moodSummary}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                toggleSpeech(
                                  `${entry.aiResponse?.comfortMessage}. 내일을 위한 실천: ${entry.aiResponse?.tomorrowAction}`
                                )
                              }
                              className="text-xs text-stone-600 hover:text-amber-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>듣기</span>
                            </button>
                          </div>

                          <div className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-white/90 p-4 rounded-xl border border-amber-100">
                            {entry.aiResponse.comfortMessage}
                          </div>

                          {/* Action Proposal */}
                          <div className="bg-emerald-50/70 border border-emerald-200/60 p-3.5 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase">
                              내일을 위한 긍정 행동
                            </span>
                            <p className="text-xs sm:text-sm font-semibold text-emerald-950">
                              {entry.aiResponse.tomorrowAction}
                            </p>
                            <p className="text-[11px] text-emerald-700">
                              {entry.aiResponse.actionReason}
                            </p>
                          </div>

                          {/* Quote */}
                          <div className="text-center text-xs text-stone-500 italic">
                            "{entry.aiResponse.cheeringQuote}"
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MOOD STATISTICS (마음 날씨) */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900">나의 마음 날씨</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                지금까지 기록된 감정 분포와 마음의 흐름을 한눈에 살펴보세요
              </p>
            </div>

            {/* Total Count Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {EMOTIONS.map((emo) => {
                const count = emotionStats[emo.type];
                const pct =
                  diaries.length > 0 ? Math.round((count / diaries.length) * 100) : 0;

                return (
                  <div
                    key={emo.type}
                    className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                        {emo.icon}
                        {emo.label}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">{pct}%</span>
                    </div>
                    <div className="text-2xl font-bold text-stone-900">{count}회</div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${
                          emo.type === '기쁨'
                            ? 'bg-amber-400'
                            : emo.type === '지침'
                            ? 'bg-slate-400'
                            : emo.type === '설렘'
                            ? 'bg-rose-400'
                            : 'bg-teal-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reflection card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-500 fill-amber-500" />
                마음 우체부의 짧은 한마디
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                기쁨과 설렘뿐만 아니라 지침과 불안 역시 당신이 하루하루 온 힘을 다해 진심으로 살아가고
                있다는 증거예요. 어떤 날이든 감정을 억누르지 않고 일기장에 솔직하게 털어놓는
                것만으로도 이미 큰 위로와 치유가 시작되고 있답니다.
              </p>
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-xs sm:text-sm text-amber-900 flex items-center justify-between">
                <span>지금까지 총 <strong>{diaries.length}번</strong>의 소중한 하루를 기록하셨어요.</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  오늘 일기 쓰러가기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/60 bg-[#FAF7F2] py-6 text-center text-xs text-stone-400">
        <p>따뜻한 하루 일기 · Powered by Google Gemini AI & Firebase Firestore</p>
      </footer>
    </div>
  );
}
