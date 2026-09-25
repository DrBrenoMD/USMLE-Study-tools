import { useEffect, useRef } from 'react';
import { useStore, QuestionAlternative } from '../cardblocks/store/useStore';
import { toCompactCardSummary } from '../utils/qbankCardMatcher';

export function useQBankSync() {
  const {
    questionBanks,
    createQuestionBank,
    upsertQuestionFromQBank,
    cards,
    decks,
    activateAndScheduleForToday,
    unsuspendCard,
    scheduleCardForToday,
    associateCardWithQuestion,
  } = useStore();
  const banksRef = useRef(questionBanks);
  banksRef.current = questionBanks;

  // Sincroniza catálogo de cards para a extensão e servidor (com debounce leve)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const decksMap = new Map(decks.map(d => [d.id, d.name]));
        const compactCatalog = cards.map(c => toCompactCardSummary(c, decksMap.get(c.deckId)));

        // 1. Envia para o servidor local
        fetch('/api/cards-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: compactCatalog }),
        }).catch(() => {});

        // 2. BroadcastChannel para abas abertas da extensão
        try {
          const bc = new BroadcastChannel('usmle_flashcards_sync');
          bc.postMessage({ type: 'USMLE_CARDS_CATALOG_SYNC', cards: compactCatalog });
          setTimeout(() => bc.close(), 1000);
        } catch (e) {}

        // 3. chrome.storage.local se a aba estiver no mesmo contexto
        const winChrome = typeof window !== 'undefined' ? (window as any).chrome : undefined;
        if (winChrome && winChrome.storage && winChrome.storage.local) {
          winChrome.storage.local.set({ cardblocks_qbank_cards: compactCatalog });
        }
      } catch (err) {}
    }, 400);

    return () => clearTimeout(timer);
  }, [cards, decks]);

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
    // Helper inteligente para converter texto bruto em alternativas estruturadas
    const parseRawChoices = (raw: string): QuestionAlternative[] => {
      if (!raw || typeof raw !== 'string') return [];
      const rawLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const alts: QuestionAlternative[] = [];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

      // Filtra linhas que sejam apenas porcentagens isoladas como "(8%)" ou "8%"
      const filteredLines = rawLines.filter(l => !/^\(?\d+%\)?$/.test(l));

      // Verifica se as linhas estão intercaladas (Ex: linha 1 = "A.", linha 2 = "Texto", linha 3 = "B.", linha 4 = "Texto")
      const isInterleaved = filteredLines.some((l, idx) => {
        const next = filteredLines[idx + 1];
        return /^[A-H][\.\)]?$/i.test(l) && next && !/^[A-H][\.\)]?$/i.test(next);
      });

      if (isInterleaved) {
        let currentLetter = '';
        let currentText = '';

        for (let i = 0; i < filteredLines.length; i++) {
          const line = filteredLines[i];
          const letterMatch = line.match(/^([A-H])[\.\)]?$/i);
          if (letterMatch) {
            if (currentLetter && currentText) {
              alts.push({
                id: `alt-${alts.length + 1}`,
                letter: currentLetter,
                text: currentText.replace(/\s*\(\d+%\)\s*$/, '').trim(),
                isCorrect: false,
              });
            }
            currentLetter = letterMatch[1].toUpperCase();
            currentText = '';
          } else {
            currentText = currentText ? `${currentText} ${line}` : line;
          }
        }
        if (currentLetter && currentText) {
          alts.push({
            id: `alt-${alts.length + 1}`,
            letter: currentLetter,
            text: currentText.replace(/\s*\(\d+%\)\s*$/, '').trim(),
            isCorrect: false,
          });
        }
      }

      // Se não era intercalado, processa linha por linha normal
      if (alts.length === 0) {
        filteredLines.forEach((line, idx) => {
          let letter = letters[idx] || String.fromCharCode(65 + idx);
          let text = line;
          const match = line.match(/^([A-H])[\.\)]\s*(.*)$/i);
          if (match) {
            letter = match[1].toUpperCase();
            text = match[2].trim();
          }
          // Remove porcentagem no fim da alternativa (ex: "(8%)")
          text = text.replace(/\s*\(\d+%\)\s*$/, '').trim();

          if (text) {
            alts.push({
              id: `alt-${idx + 1}`,
              letter,
              text,
              isCorrect: false,
            });
          }
        });
      }

      return alts;
    };

    // Helper para deduzir a alternativa correta pela explicação
    const deduceCorrectChoice = (alternatives: QuestionAlternative[], explanation: string): QuestionAlternative[] => {
      if (alternatives.some(a => a.isCorrect) || !explanation) return alternatives;

      // 1. Procura match explícito: "The correct answer is C" / "correta é A"
      const matchAnswer = explanation.match(/(?:(?:the\s+)?correct\s+(?:answer|choice|option)|correta\s+[ée])\s*(?:is\s*)?\(?([A-H])\)?/i);
      if (matchAnswer) {
        const correctLetter = matchAnswer[1].toUpperCase();
        return alternatives.map(a => ({
          ...a,
          isCorrect: a.letter.toUpperCase() === correctLetter,
        }));
      }

      // 2. Método de eliminação USMLE: Na explicação, as opções incorretas são listadas como "(Choices A and B)", "(Choice D)", "(Choice E)"
      // A única opção que NÃO aparece na lista de alternativas incorretas é a CORRETA!
      const incorrectChoicesSet = new Set<string>();
      const choiceRegex = /\((?:Choices?|Options?)\s+([A-H](?:\s*(?:and|or|,)\s*[A-H])*)\)/gi;
      let match;
      while ((match = choiceRegex.exec(explanation)) !== null) {
        const lettersFound = match[1].match(/[A-H]/gi);
        if (lettersFound) {
          lettersFound.forEach(l => incorrectChoicesSet.add(l.toUpperCase()));
        }
      }

      if (incorrectChoicesSet.size > 0 && incorrectChoicesSet.size < alternatives.length) {
        const unlisted = alternatives.filter(a => !incorrectChoicesSet.has(a.letter.toUpperCase()));
        if (unlisted.length === 1) {
          const correctLetter = unlisted[0].letter.toUpperCase();
          return alternatives.map(a => ({
            ...a,
            isCorrect: a.letter.toUpperCase() === correctLetter,
          }));
        }
      }

      return alternatives;
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

      // Se gabarito não veio explicitamente nas alternativas, deduz pela explicação
      const explanation = payload.explanation || '';
      alternatives = deduceCorrectChoice(alternatives, explanation);

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

    const handleCardAction = (payload: any) => {
      if (!payload || !payload.cardId || !payload.action) return;
      const { cardId, action, qid } = payload;
      if (action === 'activate_today' || action === 'activate_and_schedule_today') {
        activateAndScheduleForToday(cardId, qid);
      } else if (action === 'unsuspend') {
        unsuspendCard(cardId);
      } else if (action === 'schedule_today') {
        scheduleCardForToday(cardId);
      } else if (action === 'associate' && qid) {
        associateCardWithQuestion(cardId, qid);
      }
    };

    let bcCards: BroadcastChannel | null = null;
    try {
      bcCards = new BroadcastChannel('usmle_flashcards_sync');
      bcCards.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'CARD_ACTION' || event.data.action === 'CARD_ACTION') {
          handleCardAction(event.data.payload || event.data);
        }
      };
    } catch (e) {}

    // 6. Polling no servidor para importações cross-origin via background / extension
    const checkServerQueue = async () => {
      try {
        const res = await fetch('/api/imported-questions');
        if (res && res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.questions) && data.questions.length > 0) {
            for (const item of data.questions) {
              handleIncomingQuestion(item);
            }
            await fetch('/api/imported-questions', { method: 'DELETE' }).catch(() => {});
          }
        }

        const actRes = await fetch('/api/pending-card-actions').catch(() => null);
        if (actRes && actRes.ok) {
          const actData = await actRes.json();
          if (actData && Array.isArray(actData.actions) && actData.actions.length > 0) {
            for (const item of actData.actions) {
              handleCardAction(item);
            }
            await fetch('/api/pending-card-actions', { method: 'DELETE' }).catch(() => {});
          }
        }
      } catch (e) {}
    };

    checkServerQueue();
    const serverInterval = setInterval(checkServerQueue, 2500);

    return () => {
      if (bcQuestions) bcQuestions.close();
      if (bcCards) bcCards.close();
      window.removeEventListener('message', onWindowMessage);
      window.removeEventListener('usmle_import_question', onCustomEvent as EventListener);
      window.removeEventListener('storage', onStorage);
      clearInterval(serverInterval);
    };
  }, [upsertQuestionFromQBank, createQuestionBank, activateAndScheduleForToday, unsuspendCard, scheduleCardForToday, associateCardWithQuestion]);
}
