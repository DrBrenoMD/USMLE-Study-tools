export type ExamConfig = {
  id: string;
  name: string;
  totalQuestions: number;
  margin: number;
  difficulty: number;
  calculate: (incorrects: number, percent: number, difficulty: number) => number;
};

const step1Calc = (i: number, p: number, d: number) => {
  const baseScore = 196 + ((p - 60) * 2.5);
  // Influência suavizada e limitada a um máximo de ±5 pontos
  const diffImpact = Math.max(-5, Math.min(5, (d - 3.7) * 4.5)); 
  return baseScore + diffImpact;
};

export const STEP1_EXAMS: ExamConfig[] = [
  // NBMEs (Mais novos para mais antigos)
  { id: 'nbme33', name: 'NBME 33', totalQuestions: 200, margin: 5, difficulty: 3.9, calculate: step1Calc },
  { id: 'nbme32', name: 'NBME 32', totalQuestions: 200, margin: 5, difficulty: 3.8, calculate: step1Calc },
  { id: 'nbme31', name: 'NBME 31', totalQuestions: 200, margin: 5, difficulty: 3.9, calculate: step1Calc },
  { id: 'nbme30', name: 'NBME 30', totalQuestions: 200, margin: 5, difficulty: 3.6, calculate: step1Calc },
  { id: 'nbme29', name: 'NBME 29', totalQuestions: 200, margin: 5, difficulty: 3.3, calculate: step1Calc },
  { id: 'nbme28', name: 'NBME 28', totalQuestions: 200, margin: 5, difficulty: 4.0, calculate: step1Calc },
  { id: 'nbme27', name: 'NBME 27', totalQuestions: 200, margin: 5, difficulty: 3.7, calculate: step1Calc },
  { id: 'nbme26', name: 'NBME 26', totalQuestions: 200, margin: 5, difficulty: 3.5, calculate: step1Calc },
  { id: 'nbme25', name: 'NBME 25', totalQuestions: 200, margin: 5, difficulty: 4.3, calculate: step1Calc },
  
  // Free 120
  { id: 'free120', name: 'Free 120 (Step 1)', totalQuestions: 120, margin: 8, difficulty: 3.0, calculate: step1Calc },
  
  // UWSA
  { id: 'uwsa3', name: 'UWSA 3 (Step 1)', totalQuestions: 160, margin: 10, difficulty: 4.4, calculate: step1Calc },
  { id: 'uwsa2', name: 'UWSA 2 (Step 1)', totalQuestions: 160, margin: 10, difficulty: 3.8, calculate: step1Calc },
  { id: 'uwsa1', name: 'UWSA 1 (Step 1)', totalQuestions: 160, margin: 10, difficulty: 3.5, calculate: step1Calc },
  
  // Amboss SA
  { id: 'ambosssa', name: 'Amboss SA (Step 1)', totalQuestions: 160, margin: 10, difficulty: 4.0, calculate: step1Calc },
];

const step2Calc = (i: number, p: number, d: number) => {
  const baseScore = 256 + ((p - 80) * 2.2);
  // Influência suavizada e limitada a um máximo de ±5 pontos
  const diffImpact = Math.max(-5, Math.min(5, (d - 3.8) * 4.5));
  return baseScore + diffImpact;
};

export const STEP2_EXAMS: ExamConfig[] = [
  // NBMEs (Mais novos para mais antigos)
  { id: 'nbme15', name: 'NBME 15', totalQuestions: 200, margin: 5, difficulty: 4.1, calculate: step2Calc },
  { id: 'nbme14', name: 'NBME 14', totalQuestions: 200, margin: 5, difficulty: 3.9, calculate: step2Calc },
  { id: 'nbme13', name: 'NBME 13', totalQuestions: 200, margin: 5, difficulty: 4.0, calculate: step2Calc },
  { id: 'nbme12', name: 'NBME 12', totalQuestions: 200, margin: 5, difficulty: 4.3, calculate: step2Calc },
  { id: 'nbme11', name: 'NBME 11', totalQuestions: 200, margin: 5, difficulty: 3.4, calculate: step2Calc },
  { id: 'nbme10', name: 'NBME 10', totalQuestions: 200, margin: 5, difficulty: 3.2, calculate: step2Calc },
  { id: 'nbme9', name: 'NBME 9', totalQuestions: 200, margin: 5, difficulty: 4.1, calculate: step2Calc },
  
  // Free 120
  { id: 'free120', name: 'Free 120 (Step 2)', totalQuestions: 120, margin: 8, difficulty: 3.1, calculate: step2Calc },
  
  // UWSA
  { id: 'uwsa3', name: 'UWSA 3 (Step 2)', totalQuestions: 160, margin: 10, difficulty: 4.5, calculate: step2Calc },
  { id: 'uwsa2', name: 'UWSA 2 (Step 2)', totalQuestions: 160, margin: 10, difficulty: 3.6, calculate: step2Calc },
  { id: 'uwsa1', name: 'UWSA 1 (Step 2)', totalQuestions: 160, margin: 10, difficulty: 4.0, calculate: step2Calc },
  
  // Amboss SA
  { id: 'ambosssa', name: 'Amboss SA (Step 2)', totalQuestions: 160, margin: 10, difficulty: 4.2, calculate: step2Calc },
];

export const getStep1PassProb = (percent: number) => {
  if (percent < 55) return null; 
  if (percent <= 59) return 20 + ((percent - 50) / 9) * 55;
  if (percent <= 68) return 75 + ((percent - 59) / 9) * 20;
  if (percent <= 69) return 95 + ((percent - 68) / 1) * 1; 
  if (percent <= 70) return 96 + ((percent - 69) / 1) * 1; 
  if (percent <= 72) return 97 + ((percent - 70) / 2) * 1; 
  if (percent <= 79) return 98 + ((percent - 72) / 7) * 1; 
  return 99 + ((percent - 79) / 21) * 1;
};
