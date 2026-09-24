// =========================================================================
// Background Service Worker - Assistente Q-Bank & Pacer v2.0
// Gerencia a sincronização automática de questões e reutilização de abas
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 0. Sincronização do Question Pacer em tempo real com abas da aplicação
  if (request.type === 'DISPATCH_PACER_ACTION') {
    const actionPayload = request.action || {};
    chrome.tabs.query({}, (tabs) => {
      const appTabs = tabs.filter(t => {
        if (!t.url) return false;
        const u = t.url.toLowerCase();
        const title = (t.title || '').toLowerCase();
        return (
          u.includes('/pacer') ||
          u.includes('/questions') ||
          u.includes('/questoes') ||
          u.includes('/flashcards') ||
          u.includes('localhost:') ||
          u.includes('.run.app') ||
          u.includes('.web.app') ||
          u.includes('aistudio.google.com') ||
          title.includes('pacer') ||
          title.includes('study tools') ||
          title.includes('banco de questões')
        );
      });

      appTabs.forEach(tab => {
        if (tab.id) {
          try {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (data) => {
                window.postMessage(data, '*');
                window.dispatchEvent(new CustomEvent('pacer_action', { detail: data }));
                try {
                  localStorage.setItem('pacer_action', JSON.stringify(data));
                } catch(e) {}
                try {
                  const bc = new BroadcastChannel('usmle_pacer_sync');
                  bc.postMessage(data);
                  setTimeout(() => bc.close(), 1000);
                } catch(e) {}
              },
              args: [actionPayload]
            }).catch(() => {});
          } catch(e) {}
        }
      });
      sendResponse({ success: true, count: appTabs.length });
    });
    return true;
  }

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
});
