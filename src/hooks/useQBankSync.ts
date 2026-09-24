import { useEffect, useRef } from 'react';
import { useStore, QuestionAlternative } from '../cardblocks/store/useStore';

export function useQBankSync() {
  const { questionBanks, createQuestionBank, upsertQuestionFromQBank } = useStore();
  const banksRef = useRef(questionBanks);
  banksRef.current = questionBanks;

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
    // Helper para converter string de alternativas para array estruturado
    const parseRawChoices = (raw: string): QuestionAlternative[] => {
      if (!raw || typeof raw !== 'string') return [];
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const alts: QuestionAlternative[] = [];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

      lines.forEach((line, idx) => {
        let letter = letters[idx] || String.fromCharCode(65 + idx);
        let text = line;
        const match = line.match(/^([A-H])[\.\)]\s*(.*)$/i);
        if (match) {
          letter = match[1].toUpperCase();
          text = match[2].trim();
        }
        alts.push({
          id: `alt-${idx + 1}`,
          letter,
          text,
          isCorrect: false,
        });
      });
      return alts;
    };

    // Handler para importar questão capturada pela extensão
    const handleIncomingQuestion = (rawPayload: any) => {
      if (!rawPayload) return;
      const payload = rawPayload.payload || rawPayload.question || rawPayload;
      const qid = (payload.qid || payload.questionId || '').toString().trim();
      if (!qid) return;

      const stem = payload.stem || payload.questionStem || payload.text || '';
      let alternatives: QuestionAlternative[] = [];

      if (Array.isArray(payload.alternatives) && payload.alternatives.length > 0) {
        alternatives = payload.alternatives.map((alt: any, idx: number) => ({
          id: alt.id || `alt-${idx + 1}`,
          letter: alt.letter || String.fromCharCode(65 + idx),
          text: alt.text || '',
          isCorrect: Boolean(alt.isCorrect),
          explanation: alt.explanation || '',
        }));
      } else if (payload.questionChoices) {
        alternatives = parseRawChoices(payload.questionChoices);
      }

      // Se gabarito não veio explicitamente nas alternativas, tenta deduzir pela explicação
      const explanation = payload.explanation || '';
      if (!alternatives.some(a => a.isCorrect) && explanation) {
        const matchAnswer = explanation.match(/(?:correct\s+(?:answer|choice|option)|correta\s+[ée])\s*(?:is\s*)?\(?([A-H])\)?/i);
        if (matchAnswer) {
          const correctLetter = matchAnswer[1].toUpperCase();
          alternatives = alternatives.map(a => ({
            ...a,
            isCorrect: a.letter.toUpperCase() === correctLetter,
          }));
        }
      }

      const educationalObjective = payload.educationalObjective || '';
      const subject = payload.subject || payload.subjective || '';
      const system = payload.system || '';
      const images = payload.images || payload.questionImages || [];
      const links = payload.links || [];

      // Determina banco de destino
      const currentBanks = banksRef.current;
      let targetBankId = payload.targetBankId || payload.bankId;

      if (!targetBankId && (payload.bankName || payload.targetBankName)) {
        const bankName = (payload.bankName || payload.targetBankName).trim();
        const found = currentBanks.find(b => b.name.toLowerCase() === bankName.toLowerCase());
        if (found) {
          targetBankId = found.id;
        } else {
          targetBankId = createQuestionBank(bankName, 'Banco criado automaticamente via sincronização');
        }
      }

      if (!targetBankId) {
        targetBankId = currentBanks[0]?.id;
      }

      upsertQuestionFromQBank({
        qid,
        bankId: targetBankId,
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
        if (!event.data) return;
        const type = event.data.type || event.data.action;
        if (
          type === 'USMLE_IMPORT_QUESTION' ||
          type === 'QBANK_QUESTION_SYNC' ||
          type === 'import_question'
        ) {
          handleIncomingQuestion(event.data);
        }
      };
    } catch (e) {}

    // 2. window.addEventListener('message')
    const onWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      const type = event.data.type || event.data.action;
      if (
        type === 'USMLE_IMPORT_QUESTION' ||
        type === 'QBANK_QUESTION_SYNC' ||
        type === 'import_question'
      ) {
        handleIncomingQuestion(event.data);
      }
    };
    window.addEventListener('message', onWindowMessage);

    // 3. CustomEvent para injeção via script da extensão
    const onCustomEvent = (e: any) => {
      if (e.detail) {
        handleIncomingQuestion(e.detail);
      }
    };
    window.addEventListener('usmle_import_question', onCustomEvent as EventListener);

    // 4. Storage event listener (se outra aba salvou pending_question_import)
    const onStorage = (e: StorageEvent) => {
      if (
        (e.key === 'pending_question_import' || e.key === 'last_synced_question') &&
        e.newValue
      ) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingQuestion(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', onStorage);

    // 5. Checar pendente no localStorage no carregamento
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

    // 6. Polling no servidor para importações cross-origin via background / extension
    const checkServerQueue = async () => {
      try {
        const res = await fetch('/api/imported-questions');
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          for (const item of data.questions) {
            handleIncomingQuestion(item);
          }
          await fetch('/api/imported-questions', { method: 'DELETE' }).catch(() => {});
        }
      } catch (e) {}
    };

    checkServerQueue();
    const serverInterval = setInterval(checkServerQueue, 2500);

    return () => {
      if (bcQuestions) bcQuestions.close();
      window.removeEventListener('message', onWindowMessage);
      window.removeEventListener('usmle_import_question', onCustomEvent as EventListener);
      window.removeEventListener('storage', onStorage);
      clearInterval(serverInterval);
    };
  }, [upsertQuestionFromQBank, createQuestionBank]);
}
