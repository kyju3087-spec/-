import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyArYxma556zkAH6RX2AFsKcvZjVmIf-kvk",
  authDomain: "visit-3ec6b.firebaseapp.com",
  projectId: "visit-3ec6b",
  storageBucket: "visit-3ec6b.firebasestorage.app",
  messagingSenderId: "337663305899",
  appId: "1:337663305899:web:d20654a8463f23c5c22fee"
};

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

export type EmotionType = '기쁨' | '지침' | '설렘' | '불안';

export interface AiEncouragement {
  comfortMessage: string;
  tomorrowAction: string;
  actionReason: string;
  cheeringQuote: string;
  moodSummary: string;
  comfortEmoji?: string;
  modelUsed?: string;
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  emotion: EmotionType;
  title: string;
  content: string;
  aiResponse?: AiEncouragement;
  createdAt: number; // Unix timestamp
  isSyncedToCloud?: boolean;
}

const LOCAL_STORAGE_KEY = 'warm_daily_diaries_v1';

// Get local backup
export function getLocalDiaries(): DiaryEntry[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.warn('Failed to load diaries from localStorage:', err);
    return [];
  }
}

// Save local backup
export function saveLocalDiaries(diaries: DiaryEntry[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(diaries));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

// Save a diary entry: Try Firebase first, fallback to LocalStorage
export async function saveDiaryToDb(entry: Omit<DiaryEntry, 'id' | 'createdAt'>): Promise<DiaryEntry> {
  const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = Date.now();
  
  let newEntry: DiaryEntry = {
    ...entry,
    id: localId,
    createdAt: now,
    isSyncedToCloud: false,
  };

  try {
    const diariesCol = collection(db, 'diaries');
    const docRef = await addDoc(diariesCol, {
      date: entry.date,
      emotion: entry.emotion,
      title: entry.title,
      content: entry.content,
      aiResponse: entry.aiResponse || null,
      createdAt: serverTimestamp(),
      clientTimestamp: now,
    });
    newEntry.id = docRef.id;
    newEntry.isSyncedToCloud = true;
  } catch (firestoreErr) {
    console.warn('Firestore write failed, saved locally:', firestoreErr);
    newEntry.isSyncedToCloud = false;
  }

  // Always update local cache
  const localList = getLocalDiaries();
  const updatedList = [newEntry, ...localList.filter(d => d.id !== newEntry.id)];
  saveLocalDiaries(updatedList);

  return newEntry;
}

// Fetch all diaries: Merge Firestore with LocalStorage
export async function fetchDiariesFromDb(): Promise<DiaryEntry[]> {
  const localList = getLocalDiaries();
  
  try {
    const diariesCol = collection(db, 'diaries');
    const q = query(diariesCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const remoteDiaries: DiaryEntry[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let createdTime = Date.now();
      if (data.createdAt instanceof Timestamp) {
        createdTime = data.createdAt.toMillis();
      } else if (data.clientTimestamp) {
        createdTime = Number(data.clientTimestamp);
      }

      return {
        id: docSnap.id,
        date: data.date || new Date().toISOString().split('T')[0],
        emotion: data.emotion as EmotionType,
        title: data.title || '',
        content: data.content || '',
        aiResponse: data.aiResponse || undefined,
        createdAt: createdTime,
        isSyncedToCloud: true,
      };
    });

    // Merge: remote takes precedence for matching IDs; include any local-only entries
    const remoteIds = new Set(remoteDiaries.map(r => r.id));
    const merged = [
      ...remoteDiaries,
      ...localList.filter(l => !remoteIds.has(l.id))
    ];
    merged.sort((a, b) => b.createdAt - a.createdAt);

    saveLocalDiaries(merged);
    return merged;
  } catch (err) {
    console.warn('Could not fetch from Firestore, using local data:', err);
    return localList;
  }
}

// Delete a diary entry
export async function deleteDiaryFromDb(id: string): Promise<void> {
  // Delete from local cache
  const localList = getLocalDiaries();
  const filtered = localList.filter(d => d.id !== id);
  saveLocalDiaries(filtered);

  // If it's a remote firestore ID (doesn't start with local_)
  if (!id.startsWith('local_')) {
    try {
      await deleteDoc(doc(db, 'diaries', id));
    } catch (err) {
      console.warn('Failed to delete from Firestore:', err);
    }
  }
}
