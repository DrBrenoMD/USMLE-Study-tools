// =========================================================================
// Assistente Q-Bank & Pacer - Background Service Worker (Manifest V3)
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'IMPORT_FLASHCARD_TO_APP') {
        const payload = request.payload;
        const isAutoNav = Boolean(request.isAutoNav);

        // Procura por abas já abertas do app (Flashcards Hub, Gerenciar Baralhos ou Criar Card)
        chrome.tabs.query({}, (tabs) => {
            const appTab = tabs.find(t => {
                if (!t.url) return false;
                const url = t.url.toLowerCase();
                return (
                    url.includes('/flashcards') ||
                    url.includes('usmle-study-tools') ||
                    url.includes('localhost:3000') ||
                    url.includes('.run.app')
                );
            });

            if (appTab && appTab.id) {
                // Aba já aberta encontrada!
                // Se NÃO for navegação automática, traz a aba e janela para o foco
                if (!isAutoNav) {
                    chrome.tabs.update(appTab.id, { active: true }, () => {
                        if (appTab.windowId) {
                            chrome.windows.update(appTab.windowId, { focused: true });
                        }
                    });
                }

                // Envia os dados para a aba existente sem abrir uma nova página
                chrome.scripting.executeScript({
                    target: { tabId: appTab.id },
                    func: (cardData, autoNavFlag) => {
                        window.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: autoNavFlag }, '*');
                        window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: { ...cardData, isAutoNav: autoNavFlag } }));
                        try {
                            const bc = new BroadcastChannel('usmle_flashcards_sync');
                            bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: autoNavFlag });
                            setTimeout(() => bc.close(), 1000);
                        } catch (e) {}
                    },
                    args: [payload, isAutoNav]
                }).catch(() => {});

                sendResponse({ success: true, method: 'existing_tab', tabId: appTab.id });
            } else {
                // Se for navegação automática e não houver aba aberta de flashcards, não abre nova aba
                if (isAutoNav) {
                    sendResponse({ success: false, reason: 'no_existing_tab_for_auto_nav' });
                    return;
                }

                // Se o usuário clicou manualmente para gerar flashcard, abre nova aba
                const targetUrl = 'https://usmle-study-tools.vercel.app/flashcards?tab=browse&action=create_card';
                chrome.tabs.create({ url: targetUrl }, (newTab) => {
                    const onUpdatedListener = (tabId, changeInfo) => {
                        if (tabId === newTab.id && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
                            setTimeout(() => {
                                chrome.scripting.executeScript({
                                    target: { tabId: newTab.id },
                                    func: (cardData) => {
                                        window.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: false }, '*');
                                        window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: { ...cardData, isAutoNav: false } }));
                                        try {
                                            const bc = new BroadcastChannel('usmle_flashcards_sync');
                                            bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: false });
                                            setTimeout(() => bc.close(), 1000);
                                        } catch (e) {}
                                    },
                                    args: [payload]
                                }).catch(() => {});
                            }, 800);
                        }
                    };
                    chrome.tabs.onUpdated.addListener(onUpdatedListener);
                });
                sendResponse({ success: true, method: 'new_tab' });
            }
        });

        return true; // Mantém a conexão aberta para resposta assíncrona
    }
});
