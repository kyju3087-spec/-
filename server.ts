import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { generateEncouragement, testGeminiConnection } from './server/geminiService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await testGeminiConnection();
    res.status(result.ok ? 200 : 500).json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Health check error' });
  }
});

// API route for diary encouragement
app.post(['/api/encourage', '/api/gemini/encourage'], async (req, res) => {
  try {
    const { date, emotion, title, content } = req.body;
    if (!content || !emotion) {
      return res.status(400).json({ error: '일기 내용과 감정을 모두 입력해주세요.' });
    }

    const result = await generateEncouragement({ date, emotion, title, content });
    res.json(result);
  } catch (error: any) {
    console.error('Server Gemini Error:', error);
    res.status(500).json({ error: error.message || 'Gemini 응답 생성 중 오류가 발생했습니다.' });
  }
});

// Serve frontend dist if exists
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
