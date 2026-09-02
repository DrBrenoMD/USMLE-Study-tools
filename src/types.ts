import {
  BookOpen,
  CheckSquare,
  Video,
  Layers,
  Award,
  Folder,
  LucideIcon
} from 'lucide-react';

export type StudyMode = 'by_date' | 'by_pace';

export type ResourceType = 'qbank' | 'book' | 'video' | 'flashcard' | 'nbme' | 'other';

export const getCategoryIcon = (type: ResourceType): LucideIcon => {
  switch (type) {
    case 'qbank':
      return CheckSquare;
    case 'book':
      return BookOpen;
    case 'video':
      return Video;
    case 'flashcard':
      return Layers;
    case 'nbme':
      return Award;
    default:
      return Folder;
  }
};

export type AllocationMode = 'item_target' | 'fixed_time'; // por quantidade vs tempo reservado por dia

export type FrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'sporadic';

export interface ResourceCategoryMeta {
  type: ResourceType;
  label: string;
  defaultUnit: string;
  defaultMinutesPerItem: number;
  defaultAllocationMode: AllocationMode;
  defaultFrequency: FrequencyType;
  defaultFixedDailyMinutes?: number;
  defaultExclusiveStudyDay?: boolean;
  defaultReviewDaysPerItem?: number;
  description: string;
}

export const RESOURCE_CATEGORIES: Record<ResourceType, ResourceCategoryMeta> = {
  qbank: {
    type: 'qbank',
    label: 'Banco de Questões (QBank)',
    defaultUnit: 'questões',
    defaultMinutesPerItem: 2.0, // resolução + revisão
    defaultAllocationMode: 'item_target',
    defaultFrequency: 'daily',
    defaultExclusiveStudyDay: false,
    defaultReviewDaysPerItem: 0,
    description: 'UWorld, Amboss, USMLE-Rx, etc.',
  },
  book: {
    type: 'book',
    label: 'Livro / Leitura',
    defaultUnit: 'páginas',
    defaultMinutesPerItem: 3.5, // leitura atenta
    defaultAllocationMode: 'item_target',
    defaultFrequency: 'daily',
    defaultExclusiveStudyDay: false,
    defaultReviewDaysPerItem: 0,
    description: 'First Aid, Pathoma (texto), Robbins, etc.',
  },
  video: {
    type: 'video',
    label: 'Vídeos / Videoaulas',
    defaultUnit: 'horas',
    defaultMinutesPerItem: 60, // 1 hora de aula
    defaultAllocationMode: 'item_target',
    defaultFrequency: 'daily',
    defaultExclusiveStudyDay: false,
    defaultReviewDaysPerItem: 0,
    description: 'Boards & Beyond, Sketchy, Ninja Nerd, etc.',
  },
  flashcard: {
    type: 'flashcard',
    label: 'Flashcards (Anki)',
    defaultUnit: 'cards',
    defaultMinutesPerItem: 0.35,
    defaultAllocationMode: 'fixed_time',
    defaultFrequency: 'daily',
    defaultFixedDailyMinutes: 60, // 1h diária reservada
    defaultExclusiveStudyDay: false,
    defaultReviewDaysPerItem: 0,
    description: 'AnKing, decks personalizados, etc.',
  },
  nbme: {
    type: 'nbme',
    label: 'Simulados & NBMEs',
    defaultUnit: 'exames',
    defaultMinutesPerItem: 300, // ~5 horas por exame
    defaultAllocationMode: 'item_target',
    defaultFrequency: 'weekly',
    defaultExclusiveStudyDay: true, // Dia exclusivo dedicado ao simulado
    defaultReviewDaysPerItem: 1, // 1 dia adicional reservado para correção
    description: 'NBME Forms 25-31, Free 120, UWSA 1-3, etc.',
  },
  other: {
    type: 'other',
    label: 'Outro / Personalizado',
    defaultUnit: 'itens',
    defaultMinutesPerItem: 15,
    defaultAllocationMode: 'item_target',
    defaultFrequency: 'daily',
    defaultExclusiveStudyDay: false,
    defaultReviewDaysPerItem: 0,
    description: 'Revisões, podcasts, casos clínicos, etc.',
  },
};

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  total: number;
  completed: number;
  unit: string;
  minutesPerItem: number; 
  targetDailyPace: number; // Usado no modo 'by_pace' para item_target
  
  // Recursos avançados:
  allocationMode: AllocationMode; // 'item_target' ou 'fixed_time'
  fixedDailyMinutes: number; // Minutos reservados por dia (ex: 60 min Anki)
  
  frequency: FrequencyType; // 'daily', 'weekly', 'biweekly', 'monthly', 'sporadic'
  preferredDayOfWeek?: number; // 0..6 para semanais (ex: 6 = Sábado para simulados)
  fixedGlobalVolume?: number | null; // Volume fixo para todos os dias
  fixedVolumeByDayOfWeek?: Record<number, number | null>; // {0: 20, 1: null, ...} 0=Dom
  
  dependsOnId?: string | null; // ID do material que precisa ser concluído antes
  targetEndDate?: string | null; // Data limite individual
  targetStartDate?: string | null; // Data de início individual

  // Exclusividade e Correção para NBME/Simulados
  exclusiveStudyDay?: boolean; // Se verdadeiro, no dia do simulado não se estuda mais nada diário
  reviewDaysPerItem?: number; // Dias adicionais de revisão/correção por exame (ex: 1 dia para fazer + 1 dia para corrigir)
}

export interface ResourceScheduleCalculation {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  allocationMode: AllocationMode;
  frequency: FrequencyType;
  dependsOnId?: string | null;
  dependsOnName?: string;
  
  // Datas e fases
  startDate: Date;
  endDate: Date;
  scheduledDates?: Date[];

  activeNow: boolean; // Se já está em andamento agora ou aguardando dependência
  isCompleted?: boolean; // Se o material já foi 100% concluído
  waitingFor?: string; // Nome do recurso pré-requisito
  phaseOrder?: number;
  
  // Métricas
  remainingItems: number;
  availableStudyDays: number;
  dailyAmount: number;
  unit: string;
  dailyMinutes: number;

  // Carga projetada quando a fase iniciar (para itens queued)
  projectedDailyAmount?: number;
  projectedDailyMinutes?: number;
  
  // Para periódicos / NBMEs
  totalSessions?: number;
  sessionDurationMinutes?: number;
  exclusiveDaysReserved?: number;
  reviewDaysPerSession?: number;
  scheduleNote?: string;
  calculationBreakdown?: string[];
}

export interface DailySchedule {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  amount: number;
  unit: string;
  estimatedMinutes: number;
  isTimebox: boolean;
  frequency: FrequencyType;
  phaseStatus: 'active' | 'queued' | 'completed';
  isCompleted?: boolean;
  startDate?: Date;
  endDate?: Date;
  availableStudyDays?: number;
  projectedDailyAmount?: number;
  projectedDailyMinutes?: number;
  note?: string;
  isExclusive?: boolean;
  reviewDays?: number;
  calculationBreakdown?: string[];
}

export interface StudyPlan {
  totalDays: number;
  studyDays: number;
  effectiveDailyStudyDays: number; // Dias úteis para matérias diárias após dedução de dias de simulados + correção
  totalExclusiveDays: number; // Total de dias reservados exclusivamente para simulados e correções
  estimatedEndDate: Date | null;
  targetFinishDate?: Date | null;
  examDate?: Date | null;
  bufferDays: number;
  daysRemainingAfterFinish?: number;
  
  // Desmembramento detalhado
  resourcesSchedule: ResourceScheduleCalculation[];
  dailyTasks: DailySchedule[];
  
  totalDailyMinutes: number; // Média diária nos dias normais de estudo ativo
  fixedTimeboxMinutes: number; // Tempo fixo diário (Anki, revisões)
  variableContentMinutes: number; // QBanks, Livros, Vídeos
  
  isValid: boolean;
  message?: string;
}

// ==========================================
// REGISTRO DIÁRIO DE ESTUDO & HEATMAP
// ==========================================
export interface StudyLogEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  amount: number;
  unit: string;
  minutesSpent: number;
  scorePercent?: number; // e.g. 74% de acerto no QBank
  notes?: string;
  createdAt: number;
}

export interface HeatmapDayData {
  date: string; // 'YYYY-MM-DD'
  dateObj: Date;
  dayOfWeek: number; // 0..6
  totalMinutes: number;
  totalItems: number;
  logs: StudyLogEntry[];
  intensity: 0 | 1 | 2 | 3 | 4;
}

