// =========================================================================
// Background Service Worker - Assistente Q-Bank & Pacer v1.7
// Gerencia a reutilização inteligente de abas abertas da aplicação de Flashcards
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DISPATCH_FLASHCARD_DATA') {
    const cardData = request.cardData || {};
    const fallbackUrl = request.appUrl || 'http://localhost:3000/flashcards?tab=browse&action=create_card';

    // Salva nos dados locais como garantia de sincronização
    chrome.storage.local.set({
      pending_flashcard_import: cardData,
      pending_flashcard_timestamp: Date.now()
    });

    // Procura abas abertas para não abrir uma nova caso já exista alguma aberta
    chrome.tabs.query({}, (tabs) => {
      // 1. Prioriza abas que já estão especificamente na rota de flashcards ou navegador
      let matchedTab = tabs.find(t => {
        if (!t.url) return false;
        const u = t.url.toLowerCase();
        return u.includes('/flashcards') || 
               u.includes('tab=browse') || 
               u.includes('action=create_card') ||
               u.includes('newcard=true');
      });

      // 2. Se não encontrou rota específica, procura qualquer aba aberta do app
      if (!matchedTab) {
        matchedTab = tabs.find(t => {
          if (!t.url) return false;
          const u = t.url.toLowerCase();
          return u.includes('usmle-study-tools') || 
                 (u.includes('localhost:') && (u.includes('3000') || u.includes('5173'))) ||
                 u.includes('.run.app') ||
                 u.includes('aistudio.google.com');
        });
      }

      if (matchedTab && matchedTab.id) {
        // Foca a janela e a aba existente
        if (matchedTab.windowId) {
          chrome.windows.update(matchedTab.windowId, { focused: true }, () => {});
        }
        chrome.tabs.update(matchedTab.id, { active: true }, () => {});

        // Envia mensagem direta para a aba aberta
        chrome.tabs.sendMessage(matchedTab.id, {
          type: 'USMLE_GENERATE_FLASHCARD',
          payload: cardData
        }, (res) => {
          // Se deu erro ou aba não respondeu, tenta atualizar a url com parâmetros se necessário
          if (chrome.runtime.lastError) {
            // A aba está aberta mas sem content script injetado no momento
            console.log('Enviado via storage para aba existente');
          }
        });

        sendResponse({ success: true, openedNew: false, tabId: matchedTab.id });
      } else {
        // Nenhuma aba aberta encontrada: abre uma nova
        chrome.tabs.create({ url: fallbackUrl }, (newTab) => {
          sendResponse({ success: true, openedNew: true, tabId: newTab?.id });
        });
      }
    });

    return true; // Mantém sendResponse ativo para retorno assíncrono
  }
});
