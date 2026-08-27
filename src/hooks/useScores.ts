import { useState, useEffect } from 'react';

export interface SavedScore {
  id: string;
  date: string; // ISO date string
  examName: string;
  step: 'Step 1' | 'Step 2';
  totalQuestions: number;
  incorrects: number;
  percentCorrect: number;
  estimatedScore?: number;
  passProbability?: number;
}

export function useScores() {
  const [scores, setScores] = useState<SavedScore[]>(() => {
    const saved = localStorage.getItem('usmle_scores_v1');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('usmle_scores_v1', JSON.stringify(scores));
  }, [scores]);

  const addScore = (score: Omit<SavedScore, 'id'>) => {
    const newScore = {
      ...score,
      id: 'score-' + Math.random().toString(36).substr(2, 9)
    };
    setScores(prev => [...prev, newScore].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    return newScore;
  };

  const removeScore = (id: string) => {
    setScores(prev => prev.filter(s => s.id !== id));
  };

  return { scores, addScore, removeScore };
}
