# 따뜻한 하루 일기 & AI 응원 웹앱 (Warm Daily Diary)

오늘의 일기와 감정(기쁨, 지침, 설렘, 불안)을 기록하면 **Google Gemini AI** 비서가 다정한 위로의 편지와 내일을 위한 긍정 행동 1가지를 답장해주는 감성 힐링 다이어리 웹 애플리케이션입니다.

---

## 🚀 GitHub 업로드 및 Vercel 배포 가이드

### 1단계: GitHub 저장소에 코드 올리기

터미널(프로젝트 루트 폴더)에서 다음 명령어를 차례대로 입력하세요:

```bash
# 1. git 초기화 (이미 되어 있다면 생략 가능)
git init

# 2. 파일 추가 및 첫 커밋
git add .
git commit -m "feat: 따뜻한 하루 일기 및 Gemini AI 응원 웹앱 완성"

# 3. 기본 브랜치 이름을 main으로 설정
git branch -M main

# 4. 내 GitHub 원격 저장소 주소 연결
git remote add origin https://github.com/<내-깃허브-아이디>/<저장소-이름>.git

# 5. GitHub에 푸시
git push -u origin main
```

> **주의:** `.gitignore`에 `.env` 및 `node_modules/`가 등록되어 있으므로, 실제 API 키가 담긴 파일은 깃허브에 올라가지 않고 안전하게 보호됩니다.

---

### 2단계: Vercel에서 배포하기

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인합니다.
2. **Add New...** -> **Project** 버튼을 클릭합니다.
3. 방금 올린 **GitHub 저장소를 선택(Import)**합니다.
4. **Environment Variables (환경 변수)** 설정 열기를 누르고 아래 항목을 추가합니다:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `발급받은 구글 Gemini API 키`
   *(필요한 경우 `VITE_GEMINI_API_KEY`도 동일한 값으로 함께 넣어주셔도 좋습니다)*
5. **Deploy** 버튼을 누르면 1분 내로 배포가 완료되고 나만의 웹 사이트 주소(`https://<프로젝트이름>.vercel.app`)가 생성됩니다!

---

## 🛠️ 기술 스택 및 구조

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons
- **AI Core**: Google Gemini 3-Series (`gemini-3.1-flash-lite` & `gemini-3.8-flash`, `@google/genai` SDK)
  - Vercel Serverless Function (`api/encourage.ts` & `api/health.ts`)
  - 실시간 API 연동 진단 기능 내장 (`/api/health`)
  - 503 과부하 방어 및 1.2초 초고속 실시간 응답 적용
- **Database**: Firebase Firestore (`visit-3ec6b`) & LocalStorage 오프라인 자동 백업
- **Speech**: 브라우저 Web Speech API (다정한 음성으로 편지 읽기)

---

## 💻 로컬에서 개발 및 테스트하기

```bash
# 의존성 패키지 설치
npm install

# .env 파일 생성 및 API 키 입력
cp .env.example .env
# .env 파일을 열어 GEMINI_API_KEY="내_키" 입력

# 개발 서버 실행 (포트 3000)
npm run dev
```
