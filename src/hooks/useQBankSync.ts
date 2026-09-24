import { useEffect } from 'react';
import { useStore } from '../cardblocks/store/useStore';

export function useQBankSync() {
  const { questionBanks, upsertQuestionFromQBank } = useStore();

  useEffect(() => {
    // 1. Sincroniza lista de bancos de questões disponíveis com a extensão
    const syncBanksToStorage = () => {
      try {
        const banksData = questionBanks.map(b => ({ id: b.id, name: b.name }));
        localStorage.setItem('usmle_available_banks', JSON.stringify(banksData));
        window.postMessage({ type: 'USMLE_AVAILABLE_BANKS', banks: banksData }, '*');
        
        const bc = new BroadcastChannel('usmle_banks_sync');
        bc.postMessage({ type: 'USMLE_AVAILABLE_BANKS', banks: banksData });
        setTimeout(() => bc.close(), 1000);
      } catch (e) {}
    };

    syncBanksToStorage();
  }, [questionBanks]);

  useEffect(() => {
    // Handler para importar questão capturada pela extensão
    const handleIncomingQuestion = (payload: any) => {
      if (!payload) return;
      const qid = payload.qid || payload.questionId;
      if (!qid) return;

      const stem = payload.stem || payload.questionStem || payload.text || '';
      const alternatives = payload.alternatives || [];
      const explanation = payload.explanation || '';
      const educationalObjective = payload.educationalObjective || '';
      const subject = payload.subject || '';
      const system = payload.system || '';
      const images = payload.images || payload.questionImages || [];
      const links = payload.links || [];
      const bankId = payload.targetBankId || payload.bankId;

      upsertQuestionFromQBank({
        qid: qid.toString(),
        bankId,
        stem,
        text: stem,
        alternatives,
        explanation,
        educationalObjective,
        subject,
        system,
        images,
        links,
        tags: payload.tags || [`qid:${qid}`],
      });
    };

    // 1. BroadcastChannel para comunicação de questões em tempo real entre abas
    let bcQuestions: BroadcastChannel | null = null;
    try {
      bcQuestions = new BroadcastChannel('usmle_qbank_sync');
      bcQuestions.onmessage = (event) => {
        if (event.data && (event.data.type === 'USMLE_IMPORT_QUESTION' || event.data.action === 'import_question')) {
          handleIncomingQuestion(event.data.payload || event.data);
        }
      };
    } catch (e) {}

    // 2. window.addEventListener('message')
    const onWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'USMLE_IMPORT_QUESTION' || event.data.action === 'import_question') {
        handleIncomingQuestion(event.data.payload || event.data);
      }
    };
    window.addEventListener('message', onWindowMessage);

    // 3. Storage event listener (se outra aba salvou pending_question_import)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pending_question_import' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingQuestion(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', onStorage);

    // 4. Checar pendente no localStorage no carregamento
    try {
      const stored = localStorage.getItem('pending_question_import');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.qid || parsed.questionId)) {
          handleIncomingQuestion(parsed);
          localStorage.removeItem('pending_question_import');
        }
      }
    } catch (e) {}

    return () => {
      if (bcQuestions) bcQuestions.close();
      window.removeEventListener('message', onWindowMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, [upsertQuestionFromQBank]);
}
