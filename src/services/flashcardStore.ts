import localforage from 'localforage';

export interface IOCard {
  front: string;
  back: string;
}

export interface FlashcardQuestion {
  id: number;
  tema?: string;
  subtema?: string;
  motivo_erro?: string;
  front?: string;
  back?: string;
  result?: 1 | 0; // 1 = certo, 0 = errado
  io_cards?: IOCard[];
}

export type SimuladoData = Record<number, FlashcardQuestion>;

const store = localforage.createInstance({
  name: 'UsmleFlashcards'
});

export const flashcardStore = {
  async getSimuladosList(): Promise<string[]> {
    const keys = await store.keys();
    return keys.filter(k => k.startsWith('sim_')).map(k => k.replace('sim_', '')).sort((a, b) => b.localeCompare(a));
  },
  
  async getSimulado(name: string): Promise<SimuladoData> {
    const data = await store.getItem<SimuladoData>(`sim_${name}`);
    return data || {};
  },
  
  async saveSimulado(name: string, data: SimuladoData): Promise<void> {
    await store.setItem(`sim_${name}`, data);
  },

  async saveQuestion(name: string, question: FlashcardQuestion): Promise<void> {
    const data = await this.getSimulado(name);
    data[question.id] = question;
    await this.saveSimulado(name, data);
  }
};
