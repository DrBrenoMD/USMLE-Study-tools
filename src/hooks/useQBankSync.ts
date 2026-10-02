import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useStore, QuestionAlternative } from '../cardblocks/store/useStore';
import { toCompactCardSummary } from '../utils/qbankCardMatcher';
import { useTimerStore } from '../store/useTimerStore';
import { audioManager } from '../services/audioManager';

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

        // 2. BroadcastChannel para abas abertas no mesmo domínio
        try {
          const bc = new BroadcastChannel('usmle_flashcards_sync');
          bc.postMessage({ type: 'USMLE_CARDS_CATALOG_SYNC', cards: compactCatalog });
          setTimeout(() => bc.close(), 1000);
        } catch (e) {}

        // 3. Comunicação direta via window events para o content script da extensão injetado nesta aba
        window.postMessage({ type: 'USMLE_CARDS_CATALOG_SYNC', cards: compactCatalog }, '*');
        window.dispatchEvent(new CustomEvent('usmle_cards_catalog_sync', { detail: { cards: compactCatalog } }));

        // 4. chrome.storage.local se a aba estiver no mesmo contexto
        const winChrome = typeof window !== 'undefined' ? (window as any).chrome : undefined;
        if (winChrome && winChrome.storage && winChrome.storage.local) {
          winChrome.storage.local.set({ cardblocks_qbank_cards: compactCatalog });
        }
        if (winChrome && winChrome.runtime && winChrome.runtime.sendMessage) {
          try {
            winChrome.runtime.sendMessage({
              type: 'STORE_CARDS_CATALOG',
              cards: compactCatalog,
              appUrl: window.location.origin
            }, () => {});
          } catch(e) {}
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

      let educationalObjective = (payload.educationalObjective || payload.bottomLine || payload.objective || payload.keyPoint || '').trim();
      if (!educationalObjective && explanation) {
        const match = explanation.match(/(?:Bottom\s*[-_]?\s*line|Educational\s*Objective|Key\s*Points?|Take\s*[-_]?\s*home):\s*([\s\S]+?)(?=(?:Subject|System|Q\s*ID|Choice\s+[A-H]:|$))/i);
        if (match && match[1]) {
          educationalObjective = match[1].replace(/<[^>]+>/g, '').trim();
        }
      }
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

      const qCreatedId = upsertQuestionFromQBank({
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
        tags: Array.from(new Set([...(payload.tags || []), `qid:${qid}`, 'origem:extensao', 'extension'])),
        isFromExtension: true,
        source: 'extension',
      });

      // Apenas processa como respondida se de fato tiver resultado de resolução explícito
      const isExplicitlyAnswered = Boolean(
        payload.isAnswered === true ||
        (payload.selectedChoice && payload.selectedChoice.trim().length > 0) ||
        (payload.selectedChoiceId && payload.selectedChoiceId.toString().trim().length > 0) ||
        (payload.isCorrect !== undefined && payload.isAnswered !== false) ||
        (payload.status && payload.status !== 'unused') ||
        (payload.userAnswer && payload.userAnswer.toString().trim().length > 0)
      );

      if (isExplicitlyAnswered) {
        const resolutionTimeSeconds = Math.max(1, Number(payload.resolutionTimeSeconds || payload.solveTime || payload.timeSeconds || 60));
        const reviewTimeSeconds = Math.max(0, Number(payload.reviewTimeSeconds || payload.reviewTime || 0));

        let selectedChoiceId = (payload.selectedChoiceId || payload.selectedChoice || payload.userAnswer || '').toString().trim();
        const foundSelected = alternatives.find(a => 
          a.id === selectedChoiceId || 
          (a.letter && selectedChoiceId && a.letter.toUpperCase() === selectedChoiceId.toUpperCase())
        );
        if (foundSelected) {
          selectedChoiceId = foundSelected.id;
        }

        let correctChoiceId = alternatives.find(a => a.isCorrect)?.id;
        if (!correctChoiceId && (payload.correctChoice || payload.correctAnswer)) {
          const corrStr = (payload.correctChoice || payload.correctAnswer).toString().trim().toUpperCase();
          const foundCorrect = alternatives.find(a => 
            (a.letter && a.letter.toUpperCase() === corrStr) || a.id === corrStr
          );
          if (foundCorrect) {
            correctChoiceId = foundCorrect.id;
            foundCorrect.isCorrect = true;
          }
        }

        // Determinação robusta de isCorrect
        let isCorrect = false;
        if (typeof payload.isCorrect === 'boolean') {
          isCorrect = payload.isCorrect;
        } else if (payload.isCorrect === 'true' || payload.isCorrect === 1 || payload.isCorrect === '1' || payload.isCorrect === 'correct') {
          isCorrect = true;
        } else if (payload.status === 'correct' || payload.result === 'correct' || payload.userResult === 'correct' || payload.correct === true) {
          isCorrect = true;
        } else if (foundSelected && foundSelected.isCorrect) {
          isCorrect = true;
        } else if (selectedChoiceId && correctChoiceId && selectedChoiceId === correctChoiceId) {
          isCorrect = true;
        } else if (payload.selectedChoice && payload.correctChoice && payload.selectedChoice.toString().trim().toUpperCase() === payload.correctChoice.toString().trim().toUpperCase()) {
          isCorrect = true;
        } else if (payload.userAnswer && payload.correctAnswer && payload.userAnswer.toString().trim().toUpperCase() === payload.correctAnswer.toString().trim().toUpperCase()) {
          isCorrect = true;
        }

        const storeState = useStore.getState();
        const existingQ = storeState.questions.find(q => q.qid === qid || q.id === qCreatedId);
        const todayDateStr = format(new Date(), 'yyyy-MM-dd');
        
        // Determina data de resolução (respeita data histórica se informada pela extensão)
        const targetDateStr = payload.answeredAt 
          ? format(new Date(payload.answeredAt), 'yyyy-MM-dd') 
          : (payload.date || payload.testDate || todayDateStr);

        // Identifica se é uma revisão de questão que já foi respondida em data anterior
        const isReviewingPastQuestion = Boolean(
          payload.isReviewOnly === true ||
          payload.testMode === 'review' ||
          (existingQ && existingQ.status && existingQ.status !== 'unused' && existingQ.lastAnsweredAt &&
           format(new Date(existingQ.lastAnsweredAt), 'yyyy-MM-dd') !== todayDateStr &&
           !payload.isNewSubmission)
        );

        // Se o usuário está apenas REVISANDO uma questão de outra data, não altera a data de resolução
        // nem polui o gráfico/heatmap da data presente como se fosse uma nova questão feita hoje
        if (isReviewingPastQuestion) {
          return;
        }

        useStore.getState().recordDeskQuestionAnswer({
          qid,
          questionId: qCreatedId,
          selectedChoiceId,
          correctChoiceId,
          isCorrect,
          resolutionTimeSeconds,
          reviewTimeSeconds,
          subject,
          system,
        });

        // Sincroniza com os logs do Study Tracker (Heatmap e Gráfico de Desempenho)
        // Garante que cada questão única (QID) seja contabilizada apenas UMA vez por dia no amount
        try {
          const savedLogsStr = localStorage.getItem('usmle_study_logs_v4');
          let currentLogs: any[] = [];
          if (savedLogsStr) {
            try { currentLogs = JSON.parse(savedLogsStr); } catch (e) {}
          }
          
          const timeMinutes = Math.max(1, Math.round((resolutionTimeSeconds + reviewTimeSeconds) / 60));
          const existingLogIndex = currentLogs.findIndex(l => l.date === targetDateStr && (l.resourceId === 'qbankly' || l.resourceId === 'uworld' || l.unit === 'questões'));
          
          if (existingLogIndex >= 0) {
            const existingLog = currentLogs[existingLogIndex];
            const qids: string[] = Array.isArray(existingLog.questionIds) ? existingLog.questionIds : [];

            if (!qids.includes(qid)) {
              qids.push(qid);
            }
            existingLog.questionIds = qids;

            // Recalcula scorePercent e volume com precisão
            const stateQ = useStore.getState().questions;
            let answeredQCount = 0;
            let correctQCount = 0;

            qids.forEach(curQid => {
              const matched = stateQ.find(q => q.qid === curQid || q.id === curQid);
              if (matched && (matched.status && matched.status !== 'unused')) {
                answeredQCount++;
                const isMatchCorrect = matched.status === 'correct' || (matched.attempts && matched.attempts.some(a => a.isCorrect)) || (matched as any).isCorrect === true;
                if (isMatchCorrect) correctQCount++;
              } else if (curQid === qid) {
                answeredQCount++;
                if (isCorrect) correctQCount++;
              }
            });

            if (answeredQCount === 0) {
              answeredQCount = qids.length;
              correctQCount = isCorrect ? 1 : 0;
            }

            const newScore = Math.round((correctQCount / Math.max(1, answeredQCount)) * 100);
            existingLog.amount = Math.max(existingLog.amount || 1, qids.length);
            existingLog.scorePercent = newScore;
            existingLog.minutesSpent = Math.max(existingLog.minutesSpent || 0, (existingLog.minutesSpent || 0) + timeMinutes);
          } else {
            currentLogs.unshift({
              id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              date: targetDateStr,
              resourceId: 'qbankly',
              resourceName: 'QBank Externo (QBankly / UWorld)',
              resourceType: 'qbank',
              amount: 1,
              questionIds: [qid],
              unit: 'questões',
              minutesSpent: timeMinutes,
              scorePercent: isCorrect ? 100 : 0,
              notes: `Sincronizado via Extensão (${subject || 'Geral'})`,
              createdAt: Date.now()
            });
          }
          localStorage.setItem('usmle_study_logs_v4', JSON.stringify(currentLogs));
          window.dispatchEvent(new Event('usmle_logs_updated'));
        } catch (err) {}
      }
    };

    // Handler global para criação de Notas a partir de questões vindas da extensão
    const handleIncomingNoteCreation = (rawPayload: any) => {
      if (!rawPayload) return;
      const questionData = rawPayload.question || rawPayload.questionData || rawPayload.payload || rawPayload;
      if (!questionData) return;
      const state = useStore.getState();
      const targetArea = rawPayload.areaId || undefined;
      const noteId = state.createNoteFromQuestion(questionData, targetArea, rawPayload.customTitle);

      // Também sincroniza a questão no repositório de questões
      const qid = (questionData.qid || questionData.questionId || '').toString().trim();
      if (qid) {
        handleIncomingQuestion(questionData);
      }

      try {
        localStorage.setItem('pending_note_focus', noteId);
        window.dispatchEvent(new CustomEvent('usmle_note_created', { detail: { noteId, questionData } }));
      } catch (e) {}

      return noteId;
    };

    // Handler global para criação de Flashcards vindos da extensão
    const handleIncomingFlashcardCreation = (rawPayload: any) => {
      if (!rawPayload) return;
      const cardData = rawPayload.payload || rawPayload.cardData || rawPayload;
      if (!cardData) return;

      if (cardData.qid || cardData.questionId) {
        handleIncomingQuestion(cardData);
      }

      try {
        localStorage.setItem('pending_flashcard_import', JSON.stringify(cardData));
        window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: cardData }));
      } catch (e) {}
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
        } else if (
          type === 'CREATE_NOTE_FROM_QUESTION' ||
          type === 'create_note_from_question' ||
          type === 'DISPATCH_NOTE_DATA'
        ) {
          handleIncomingNoteCreation(event.data);
        } else if (
          type === 'USMLE_GENERATE_FLASHCARD' ||
          type === 'create_card_from_question' ||
          type === 'DISPATCH_FLASHCARD_DATA'
        ) {
          handleIncomingFlashcardCreation(event.data);
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
      } else if (
        type === 'CREATE_NOTE_FROM_QUESTION' ||
        type === 'create_note_from_question' ||
        type === 'DISPATCH_NOTE_DATA'
      ) {
        handleIncomingNoteCreation(event.data);
      } else if (
        type === 'USMLE_GENERATE_FLASHCARD' ||
        type === 'create_card_from_question' ||
        type === 'DISPATCH_FLASHCARD_DATA'
      ) {
        handleIncomingFlashcardCreation(event.data);
      }
    };
    window.addEventListener('message', onWindowMessage);

    // 3. CustomEvent para injeção via script da extensão
    const onCustomEvent = (e: any) => {
      if (e.detail) {
        const type = e.detail.type || e.detail.action;
        if (type === 'CREATE_NOTE_FROM_QUESTION' || type === 'create_note_from_question') {
          handleIncomingNoteCreation(e.detail);
        } else if (type === 'USMLE_GENERATE_FLASHCARD' || type === 'create_card_from_question') {
          handleIncomingFlashcardCreation(e.detail);
        } else {
          handleIncomingQuestion(e.detail);
        }
      }
    };
    window.addEventListener('usmle_import_question', onCustomEvent as EventListener);
    window.addEventListener('usmle_create_note', onCustomEvent as EventListener);

    // 4. Storage event listener (se outra aba salvou pending_question_import ou pending_note_import)
    const onStorage = (e: StorageEvent) => {
      if (
        (e.key === 'pending_question_import' || e.key === 'last_synced_question') &&
        e.newValue
      ) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingQuestion(parsed);
        } catch (err) {}
      } else if (e.key === 'pending_note_import' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingNoteCreation(parsed);
        } catch (err) {}
      } else if (e.key === 'pending_flashcard_import' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingFlashcardCreation(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', onStorage);

    // 5. Checar pendentes no localStorage no carregamento
    try {
      const storedQ = localStorage.getItem('pending_question_import');
      if (storedQ) {
        const parsed = JSON.parse(storedQ);
        if (parsed && (parsed.qid || parsed.questionId)) {
          handleIncomingQuestion(parsed);
          localStorage.removeItem('pending_question_import');
        }
      }
      const storedNote = localStorage.getItem('pending_note_import');
      if (storedNote) {
        const parsed = JSON.parse(storedNote);
        if (parsed) {
          handleIncomingNoteCreation(parsed);
          localStorage.removeItem('pending_note_import');
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

    // Helper para processar ações de navegação do Pacer recebidas da extensão ou outras abas
    let lastGlobalPacerActionId = '';
    let lastGlobalPacerActionTime = 0;

    const handlePacerAction = (rawAction: any) => {
      if (!rawAction) return;
      const data = rawAction.action || rawAction.payload || rawAction;
      const actionTypeStr = data.type || data.action;

      const isPacerEvt =
        actionTypeStr === 'PACER_NEXT' ||
        actionTypeStr === 'PACER_PREV' ||
        actionTypeStr === 'PACER_SUBMIT' ||
        actionTypeStr === 'PACER_BTN_CLICK' ||
        actionTypeStr === 'PACER_SYNC_STATE';

      if (!isPacerEvt) return;

      const actionId = data.actionId || data.id || (data.ts ? `${actionTypeStr}-${data.ts}` : '');
      const now = Date.now();

      if (actionId && lastGlobalPacerActionId === actionId) return;
      if (now - lastGlobalPacerActionTime < 280) return;

      lastGlobalPacerActionId = actionId;
      lastGlobalPacerActionTime = now;

      const timerStore = useTimerStore.getState();

      // Sincroniza total de questões se informado
      if (data.totalQuestions && typeof data.totalQuestions === 'number' && data.totalQuestions > 0) {
        if (data.totalQuestions !== timerStore.pacerTotalQuestions) {
          timerStore.setPacerState({ pacerTotalQuestions: data.totalQuestions });
        }
      }

      // Auto-inicia o Pacer se estiver inativo
      if (!timerStore.pacerIsActive) {
        audioManager.init();
        const settings = timerStore.pacerSoundSettings || { master: true, keepAliveAudio: true };
        if (settings.master && settings.keepAliveAudio !== false) {
          audioManager.startKeepAlive();
        }
        timerStore.setPacerState({
          pacerCurrentQuestionTime: 0,
          pacerCurrentReviewTime: 0,
          pacerCompletedQuestionsTime: [],
          pacerCompletedReviewTimes: [],
          pacerTutoredPhase: 'solve',
          pacerIsActive: true,
        });
        timerStore.setTimerState('running');
      }

      let shouldNext = Boolean(data.isNext || actionTypeStr === 'PACER_NEXT');
      let shouldSubmit = Boolean(data.isSubmit || actionTypeStr === 'PACER_SUBMIT');
      let shouldPrev = Boolean(data.isPrev || actionTypeStr === 'PACER_PREV');

      if (timerStore.pacerQBankMode !== 'tutored' && actionTypeStr === 'PACER_BTN_CLICK') {
        const trigger = timerStore.pacerTriggerButton || 'both';
        shouldNext = (trigger === 'next' && data.isNext) || (trigger === 'submit' && data.isSubmit) || (trigger === 'both' && (data.isNext || data.isSubmit));
        shouldSubmit = false;
      }

      if (timerStore.phase !== 'rest') {
        const actionResult = timerStore.syncPacerQuestion({
          targetQuestion: data.questionIndex,
          targetPhase: data.phase,
          isNext: shouldNext,
          isSubmit: shouldSubmit,
          isPrev: shouldPrev,
          totalQuestions: data.totalQuestions,
        });

        const soundSettings = timerStore.pacerSoundSettings || {
          master: true,
          solveAlarm: true,
          reviewAlarm: true,
          nextQuestion: true,
          submitQuestion: true,
          prevQuestion: true,
          cycleAlarm: true,
          volume: 0.5,
        };
        const vol = soundSettings.volume ?? 0.5;

        if (soundSettings.master) {
          if (actionResult === 'submit' && soundSettings.submitQuestion !== false) {
            audioManager.playActionBeep('submit', vol);
          } else if (actionResult === 'next' && soundSettings.nextQuestion !== false) {
            audioManager.playActionBeep('next', vol);
          } else if (actionResult === 'prev' && soundSettings.prevQuestion !== false) {
            audioManager.playActionBeep('prev', vol);
          }
        }
      }
    };

    let bcPacer: BroadcastChannel | null = null;
    try {
      bcPacer = new BroadcastChannel('usmle_pacer_sync');
      bcPacer.onmessage = (event) => {
        if (event.data) handlePacerAction(event.data);
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

        const pacerRes = await fetch('/api/pending-pacer-actions').catch(() => null);
        if (pacerRes && pacerRes.ok) {
          const pacerData = await pacerRes.json();
          if (pacerData && Array.isArray(pacerData.actions) && pacerData.actions.length > 0) {
            for (const item of pacerData.actions) {
              handlePacerAction(item);
            }
            await fetch('/api/pending-pacer-actions', { method: 'DELETE' }).catch(() => {});
          }
        }
      } catch (e) {}
    };

    checkServerQueue();
    const serverInterval = setInterval(checkServerQueue, 2000);

    const onPacerCustomEvent = (e: any) => {
      if (e.detail) {
        handlePacerAction(e.detail);
      }
    };
    window.addEventListener('pacer_action', onPacerCustomEvent as EventListener);

    return () => {
      if (bcQuestions) bcQuestions.close();
      if (bcCards) bcCards.close();
      if (bcPacer) bcPacer.close();
      window.removeEventListener('message', onWindowMessage);
      window.removeEventListener('usmle_import_question', onCustomEvent as EventListener);
      window.removeEventListener('pacer_action', onPacerCustomEvent as EventListener);
      window.removeEventListener('storage', onStorage);
      clearInterval(serverInterval);
    };
  }, [upsertQuestionFromQBank, createQuestionBank, activateAndScheduleForToday, unsuspendCard, scheduleCardForToday, associateCardWithQuestion]);
}
