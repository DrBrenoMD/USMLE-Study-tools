// =========================================================================
// Background Service Worker - Assistente Q-Bank & Pacer v2.0
// Gerencia a sincronização automática de questões e reutilização de abas
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Sincronização e Importação de Questões
  if (request.type === 'DISPATCH_QUESTION_DATA') {
    const questionData = request.questionData || {};
    const bankName = request.bankName || 'UWorld Step 1';

    // Salva no storage local da extensão
    chrome.storage.local.set({
      pending_question_import: questionData,
      pending_question_timestamp: Date.now()
    });

    // Procura abas abertas da aplicação
    chrome.tabs.query({}, (tabs) => {
      const appTabs = tabs.filter(t => {
        if (!t.url) return false;
        const u = t.url.toLowerCase();
        const title = (t.title || '').toLowerCase();
        return (
          u.includes('/questions') ||
          u.includes('/questoes') ||
          u.includes('/flashcards') ||
          u.includes('localhost:') ||
          u.includes('.run.app') ||
          u.includes('.web.app') ||
          u.includes('aistudio.google.com') ||
          title.includes('study tools') ||
          title.includes('banco de questões')
        );
      });

      // Dispara injeção de script em todas as abas abertas do app
      appTabs.forEach(tab => {
        if (tab.id) {
          try {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (data, targetBank) => {
                const payload = {
                  type: 'QBANK_QUESTION_SYNC',
                  question: data,
                  bankName: targetBank,
                  qid: data.questionId || data.qid,
                  timestamp: Date.now()
                };
                window.postMessage(payload, '*');
                window.dispatchEvent(new CustomEvent('usmle_import_question', { detail: payload }));
                try {
                  const bc = new BroadcastChannel('usmle_qbank_sync');
                  bc.postMessage(payload);
                  setTimeout(() => bc.close(), 1000);
                } catch(e) {}
              },
              args: [questionData, bankName]
            }).catch(() => {});
          } catch(e) {}
        }
      });

      // Tenta enviar para o servidor backend da app caso haja URL salva
      chrome.storage.local.get(['last_connected_app_url'], (store) => {
        if (store.last_connected_app_url) {
          try {
            const origin = new URL(store.last_connected_app_url).origin;
            fetch(`${origin}/api/import-question`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...questionData, bankName })
            }).catch(() => {});
          } catch(e) {}
        }
      });

      sendResponse({ success: true, count: appTabs.length });
    });

    return true;
  }

  // 2. Criação / Disparo de Flashcard
  if (request.type === 'DISPATCH_FLASHCARD_DATA') {
    const cardData = request.cardData || {};

    // Salva nos dados locais da extensão como garantia de persistência
    chrome.storage.local.set({
      pending_flashcard_import: cardData,
      pending_flashcard_timestamp: Date.now()
    });

    chrome.storage.local.get(['last_connected_app_url'], (store) => {
      const fallbackUrl = request.appUrl || 
                          store.last_connected_app_url || 
                          'http://localhost:3000/flashcards?tab=browse&action=create_card';

      // Procura abas abertas para não abrir uma nova caso já exista alguma aberta
      chrome.tabs.query({}, (tabs) => {
        // 1. Prioriza abas que já estão na rota de flashcards ou editor
        let matchedTab = tabs.find(t => {
          if (!t.url) return false;
          const u = t.url.toLowerCase();
          return u.includes('/flashcards') || 
                 u.includes('tab=browse') || 
                 u.includes('action=create_card') ||
                 u.includes('newcard=true');
        });

        // 2. Procura pelo título da aba ou domínio da aplicação
        if (!matchedTab) {
          matchedTab = tabs.find(t => {
            const title = (t.title || '').toLowerCase();
            const u = (t.url || '').toLowerCase();
            const matchTitle = title.includes('study tools') || 
                               title.includes('flashcard') || 
                               title.includes('cardblocks') ||
                               title.includes('uworld assistant');
            const matchDomain = u.includes('localhost:') || 
                                u.includes('.run.app') || 
                                u.includes('.web.app') || 
                                u.includes('aistudio.google.com');
            return matchTitle || matchDomain;
          });
        }

        if (matchedTab && matchedTab.id) {
          // Salva como última URL conectada
          if (matchedTab.url) {
            chrome.storage.local.set({ last_connected_app_url: matchedTab.url });
          }

          // Foca a janela e a aba existente
          if (matchedTab.windowId) {
            chrome.windows.update(matchedTab.windowId, { focused: true }, () => {});
          }
          chrome.tabs.update(matchedTab.id, { active: true }, () => {});

          // Injeção direta e ultra resiliente no contexto da aba via chrome.scripting
          try {
            chrome.scripting.executeScript({
              target: { tabId: matchedTab.id },
              func: (data) => {
                window.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: data }, '*');
                window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: data }));
                try {
                  const bc = new BroadcastChannel('usmle_flashcards_sync');
                  bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: data });
                  setTimeout(() => bc.close(), 1000);
                } catch(e) {}
              },
              args: [cardData]
            }).catch(() => {});
          } catch(e) {}

          // Envia também por sendMessage para o content script se estiver presente
          chrome.tabs.sendMessage(matchedTab.id, {
            type: 'USMLE_GENERATE_FLASHCARD',
            payload: cardData
          }, () => {
            if (chrome.runtime.lastError) {
              // Aba aberta processará via storage e BroadcastChannel
            }
          });

          sendResponse({ success: true, openedNew: false, tabId: matchedTab.id });
        } else {
          // Nenhuma aba aberta encontrada: abre uma nova e injeta os dados assim que carregar
          chrome.tabs.create({ url: fallbackUrl }, (newTab) => {
            if (newTab && newTab.id) {
              const listener = (tabId, info) => {
                if (tabId === newTab.id && info.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(listener);
                  setTimeout(() => {
                    try {
                      chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        func: (data) => {
                          window.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: data }, '*');
                          window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: data }));
                          try {
                            const bc = new BroadcastChannel('usmle_flashcards_sync');
                            bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: data });
                            setTimeout(() => bc.close(), 1000);
                          } catch(e) {}
                        },
                        args: [cardData]
                      }).catch(() => {});
                    } catch(e) {}
                  }, 800);
                }
              };
              chrome.tabs.onUpdated.addListener(listener);
            }
            sendResponse({ success: true, openedNew: true, tabId: newTab?.id });
          });
        }
      });
    });

    return true; // Mantém sendResponse ativo para retorno assíncrono
  }

  // 3. Sincronização do Catálogo de Cards
  if (request.type === 'STORE_CARDS_CATALOG') {
    const cards = request.cards || [];
    const appUrl = request.appUrl;
    const updateObj = { cardblocks_qbank_cards: cards };
    if (appUrl) updateObj.last_connected_app_url = appUrl;
    chrome.storage.local.set(updateObj, () => {
      sendResponse({ success: true, count: cards.length });
    });
    return true;
  }

  // 4. Busca de Cards Correspondentes via Servidor
  if (request.type === 'FETCH_MATCHING_CARDS') {
    const qid = request.qid;
    chrome.storage.local.get(['last_connected_app_url', 'cardblocks_qbank_cards'], async (store) => {
      let matching = [];
      const cleanQid = (qid || '').toString().replace(/^(?:qid|id|q|#)[:\-_]*/i, '').trim();
      const numQid = cleanQid.replace(/^0+/, '') || cleanQid;

      // 1. Tenta buscar no storage local
      const cards = store.cardblocks_qbank_cards || [];
      matching = cards.filter(c => {
        if (!c) return false;
        if (c.qids && Array.isArray(c.qids)) {
          if (c.qids.includes(cleanQid) || c.qids.includes(numQid)) return true;
        }
        if (c.questionId) {
          const cq = c.questionId.toString().replace(/^(?:qid|id|q|#)[:\-_]*/i, '').trim();
          if (cq === cleanQid || cq === numQid) return true;
        }
        if (c.deckName && typeof c.deckName === 'string') {
          const dn = c.deckName.toLowerCase();
          if (dn.includes(cleanQid.toLowerCase()) || dn.includes(numQid.toLowerCase())) return true;
        }
        if (c.tags && Array.isArray(c.tags)) {
          return c.tags.some(t => {
            if (!t) return false;
            const tClean = t.replace(/^(?:qid|id|uworld|amboss|#)[:\-_]*/i, '').trim();
            return tClean === cleanQid || tClean === numQid || t.includes(cleanQid);
          });
        }
        return false;
      });

      // 2. Se vazio e houver backend conectado, busca na API
      if (matching.length === 0 && store.last_connected_app_url) {
        try {
          const origin = new URL(store.last_connected_app_url).origin;
          const res = await fetch(`${origin}/api/qbank-matching-cards?qid=${encodeURIComponent(cleanQid)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.cards)) {
              matching = data.cards;
            }
          }
        } catch (e) {}
      }

      sendResponse({ success: true, cards: matching });
    });
    return true;
  }

  // 5. Execução de Ação de Card (Ativar, Agendar, etc.) com Broadcast Universal
  if (request.type === 'DISPATCH_CARD_ACTION') {
    const { cardId, action, qid } = request.payload || {};
    
    // Atualiza storage local
    chrome.storage.local.get(['cardblocks_qbank_cards', 'last_connected_app_url'], (store) => {
      let cards = store.cardblocks_qbank_cards || [];
      const card = cards.find(c => c.id === cardId);
      if (card) {
        if (action === 'activate_today' || action === 'activate_and_schedule_today') {
          card.isSuspended = false;
          card.nextReviewDate = Date.now() - 1000;
          card.isDue = true;
          if (qid) {
            card.questionId = qid;
            if (!card.qids) card.qids = [];
            if (!card.qids.includes(qid)) card.qids.push(qid);
          }
        } else if (action === 'unsuspend') {
          card.isSuspended = false;
        } else if (action === 'schedule_today') {
          card.nextReviewDate = Date.now() - 1000;
          card.isDue = true;
          card.isSuspended = false;
        }
        chrome.storage.local.set({ cardblocks_qbank_cards: cards });
      }

      // Notifica abas abertas da aplicação via scripting
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id && tab.url && (tab.url.includes('/flashcards') || tab.url.includes('/questions') || tab.url.includes('localhost:') || tab.url.includes('.run.app'))) {
            try {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (actPayload) => {
                  window.postMessage({ type: 'CARD_ACTION', payload: actPayload }, '*');
                  window.dispatchEvent(new CustomEvent('usmle_card_action', { detail: actPayload }));
                  try {
                    const bc = new BroadcastChannel('usmle_flashcards_sync');
                    bc.postMessage({ type: 'CARD_ACTION', payload: actPayload });
                    setTimeout(() => bc.close(), 1000);
                  } catch(e) {}
                },
                args: [{ cardId, action, qid }]
              }).catch(() => {});
            } catch(e) {}
          }
        });
      });

      // Chama API backend se disponível
      if (store.last_connected_app_url) {
        try {
          const origin = new URL(store.last_connected_app_url).origin;
          fetch(`${origin}/api/update-card-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId, action, qid })
          }).catch(() => {});
        } catch(e) {}
      }

      sendResponse({ success: true });
    });
    return true;
  }
});
