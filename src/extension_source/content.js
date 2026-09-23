// =========================================================================
// Assistente de Questões por Voz + Integração Pacer (Cross-Tab Storage Sync)
// =========================================================================

// --- Configurações Iniciais ---
let configAtual = { 
    cmdLer: 'ler questão, read question', cmdRepEnunciado: 'repetir enunciado, read prompt',
    cmdRepAlt: 'repetir alternativas, read options', cmdProx: 'próxima, next', cmdAnt: 'anterior, previous',
    cmdSubmit: 'enviar, submit', cmdParar: 'parar, stop', cmdSel: 'selecionar, marcar, select',
    cmdExplicacao: 'explicação, explanation', cmdObjetivo: 'objetivo, objective',
    kbLer: 'alt+l', kbRepEnunciado: 'alt+e', kbRepAlt: 'alt+a', kbExp: 'alt+x', kbObj: 'alt+o',
    kbProx: 'alt+n', kbAnt: 'alt+b', kbSubmit: 'alt+enter', kbPlay: 'alt+p', kbStop: 'alt+s',
    kbPrevPhrase: 'alt+arrowleft', kbNextPhrase: 'alt+arrowright',
    vozEscolhida: 'default', velocidadeVoz: 1.1, autoRead: false
};

function aplicarConfiguracoes(result) {
    Object.keys(configAtual).forEach(key => { if (result[key] !== undefined) configAtual[key] = result[key]; });
}
chrome.storage.local.get(Object.keys(configAtual), aplicarConfiguracoes);

// --- Ponte Universal entre Abas (Sincronização com o Pacer) ---
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        for (let [key, { newValue }] of Object.entries(changes)) {
            if (configAtual[key] !== undefined) configAtual[key] = newValue;
        }
        // Se este script estiver rodando na aba onde o Pacer está aberto, ele repassa o evento para a página
        if (changes.pacer_action && changes.pacer_action.newValue) {
            window.postMessage(changes.pacer_action.newValue, "*");
        }
    }
});

let pacerWindow = null;
let pacerLastTrigger = 0;

function notificarPacer(isNext, isSubmit, isPrev) {
    const now = Date.now();
    if (now - pacerLastTrigger > 800) {
        pacerLastTrigger = now;
        const payload = {
            type: "PACER_BTN_CLICK",
            isNext: Boolean(isNext),
            isSubmit: Boolean(isSubmit),
            isPrev: Boolean(isPrev),
            ts: now
        };

        // 1. Canal direto via janela aberta (se o Pacer foi aberto via site / popup window)
        if (pacerWindow && !pacerWindow.closed) {
            pacerWindow.postMessage(payload, "*");
        }

        // 2. Canal Universal via Storage (para o Pacer aberto no site em outra aba)
        chrome.storage.local.set({ pacer_action: payload });

        // 3. Atualizar Pacer embutido da Extensão em segundo plano!
        atualizarPacerEmbutido(isNext, isSubmit, isPrev);
    }
}

function atualizarPacerEmbutido(isNext, isSubmit, isPrev) {
    chrome.storage.local.get(['pacer_state'], function(res) {
        let pState = res.pacer_state;
        if (!pState || !pState.isActive || pState.isPaused) return;

        let shouldAdvance = false;
        let shouldGoBack = false;

        if (pState.triggerMode === 'next' && isNext) shouldAdvance = true;
        else if (pState.triggerMode === 'submit' && isSubmit) shouldAdvance = true;
        else if (pState.triggerMode === 'both' && (isNext || isSubmit)) shouldAdvance = true;

        if (isPrev) shouldGoBack = true;

        if (shouldAdvance) {
            pState.completedQuestionsTime = pState.completedQuestionsTime || [];
            pState.completedQuestionsTime.push(Math.max(1, pState.currentQuestionTime || 1));
            pState.currentQuestionTime = 0;

            if (pState.currentQ < pState.totalQ) {
                pState.currentQ += 1;
                chrome.storage.local.set({ pacer_state: pState });
                if (pState.soundEnabled !== false) {
                    tocarBipPacer(880);
                }
            } else {
                pState.isActive = false;
                pState.isFinished = true;
                chrome.storage.local.set({ pacer_state: pState });
                if (pState.soundEnabled !== false) {
                    tocarBipPacer(1040);
                }
            }
        } else if (shouldGoBack && pState.currentQ > 1) {
            pState.currentQ -= 1;
            if (pState.completedQuestionsTime && pState.completedQuestionsTime.length > 0) {
                pState.currentQuestionTime = pState.completedQuestionsTime.pop();
            } else {
                pState.currentQuestionTime = 0;
            }
            chrome.storage.local.set({ pacer_state: pState });
        }
    });
}

function tocarBipPacer(freq = 880) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } catch(e) {}
}

// --- CSS da Barra Flutuante e Destaques ---
const styleCustom = document.createElement('style');
styleCustom.innerHTML = `
    .voz-highlight { background-color: #facc15 !important; color: #000 !important; border-radius: 2px; box-shadow: 0 0 3px #eab308; transition: background-color 0.05s ease-in-out; }
    #qbankly-tts-launcher {
        position: fixed; bottom: 20px; left: 20px; background: #004976; color: white; width: 45px; height: 45px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; 
        cursor: pointer; z-index: 2147483638; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: 0.2s;
    }
    #qbankly-tts-launcher:hover { transform: scale(1.1); }
    #qbankly-tts-bar {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0, 73, 118, 0.95); color: white; display: none; gap: 15px; padding: 12px 20px;
        border-radius: 50px; z-index: 2147483639; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        align-items: center; justify-content: center; backdrop-filter: blur(5px); border: 1px solid #005f9e;
    }
    #qbankly-tts-bar button { background: none; border: none; color: white; font-size: 20px; cursor: pointer; transition: 0.2s; padding: 0; outline: none; }
    #qbankly-tts-bar button:hover { transform: scale(1.2); text-shadow: 0 0 10px rgba(255,255,255,0.8); }
    #tts-drag-handle { cursor: grab; padding-right: 5px; opacity: 0.7; user-select: none; font-size: 18px; display: flex; align-items: center; }
    #tts-drag-handle:active { cursor: grabbing; }
    #tts-btn-close { font-size: 14px !important; margin-left: 5px; opacity: 0.7; }
    #tts-btn-close:hover { opacity: 1; color: #ff4444 !important; }

    /* --- Botão Flutuante Discreto na Margem Esquerda e Aba Vertical (Flashcards) --- */
    #qbankly-card-launcher {
        position: fixed; top: 45%; left: 0; transform: translateY(-50%);
        background: linear-gradient(180deg, #1d4ed8, #3b82f6); color: white;
        padding: 12px 6px; border-radius: 0 12px 12px 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; font-size: 11px; font-weight: bold;
        cursor: pointer; z-index: 2147483640; box-shadow: 2px 4px 14px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.3); border-left: none; transition: 0.2s; user-select: none;
    }
    #qbankly-card-launcher:hover { padding-right: 9px; background: linear-gradient(180deg, #1e40af, #2563eb); }
    #qbankly-card-launcher .card-icon { font-size: 14px; margin-bottom: 2px; }
    #qbankly-card-launcher .card-label {
        writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 2px;
        text-transform: uppercase; font-size: 9px; font-weight: 800; margin: 3px 0;
    }
    #qbankly-card-launcher .card-badge {
        font-size: 8px; font-family: monospace; background: rgba(255,255,255,0.25);
        padding: 2px 3px; border-radius: 4px;
    }

    #qbankly-card-drawer {
        position: fixed; top: 0; left: 0; width: 330px; height: 100vh;
        background: #0f172a; color: #f8fafc; z-index: 2147483641;
        box-shadow: 6px 0 25px rgba(0,0,0,0.5); border-right: 1px solid #1e293b;
        display: none; flex-direction: column; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-sizing: border-box; text-align: left;
    }
    #qbankly-card-drawer * { box-sizing: border-box; }
    #qbankly-card-drawer.open { display: flex; }
`;
document.head.appendChild(styleCustom);

// --- Criação da Barra Flutuante Arrastável ---
function criarBarraUI() {
    if (document.getElementById('qbankly-tts-bar')) return;

    const launcher = document.createElement('div');
    launcher.id = 'qbankly-tts-launcher';
    launcher.innerHTML = '🔊';
    launcher.title = 'Abrir Leitor';
    launcher.style.display = 'none';
    document.body.appendChild(launcher);

    const bar = document.createElement('div');
    bar.id = 'qbankly-tts-bar';
    bar.innerHTML = `
        <div id="tts-drag-handle" title="Arraste para mover">⠿</div>
        <button id="tts-btn-prev" title="Frase Anterior">⏮️</button>
        <button id="tts-btn-play" title="Play / Pause">⏸️</button>
        <button id="tts-btn-stop" title="Parar Leitura">⏹️</button>
        <button id="tts-btn-next" title="Próxima Frase">⏭️</button>
        <button id="tts-btn-close" title="Minimizar">✖</button>
    `;
    document.body.appendChild(bar);

    launcher.addEventListener('click', () => { launcher.style.display = 'none'; bar.style.display = 'flex'; });
    document.getElementById('tts-btn-close').addEventListener('click', () => { bar.style.display = 'none'; launcher.style.display = 'flex'; });

    const handle = document.getElementById('tts-drag-handle');
    handle.onmousedown = function(event) {
        event.preventDefault();
        let shiftX = event.clientX - bar.getBoundingClientRect().left;
        let shiftY = event.clientY - bar.getBoundingClientRect().top;
        function moveAt(pageX, pageY) {
            bar.style.left = pageX - shiftX + 'px';
            bar.style.top = pageY - shiftY + 'px';
            bar.style.transform = 'none'; bar.style.bottom = 'auto'; bar.style.right = 'auto';
        }
        function onMouseMove(event) { moveAt(event.pageX, event.pageY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = function() { document.removeEventListener('mousemove', onMouseMove); document.onmouseup = null; };
    };
    handle.ondragstart = () => false;

    document.getElementById('tts-btn-prev').addEventListener('click', () => navegarFrase(-1));
    document.getElementById('tts-btn-play').addEventListener('click', () => alternarPlayPause());
    document.getElementById('tts-btn-stop').addEventListener('click', () => pararLeitura());
    document.getElementById('tts-btn-next').addEventListener('click', () => navegarFrase(1));
}

function atualizarBarraUI(estado) {
    const bar = document.getElementById('qbankly-tts-bar');
    const launcher = document.getElementById('qbankly-tts-launcher');
    if (!bar) criarBarraUI();
    if (launcher.style.display !== 'flex') bar.style.display = 'flex';
    document.getElementById('tts-btn-play').innerText = estado === 'pausado' ? '▶️' : '⏸️';
}

function esconderBarraUI() {
    const bar = document.getElementById('qbankly-tts-bar');
    const launcher = document.getElementById('qbankly-tts-launcher');
    if (bar) { bar.style.display = 'none'; launcher.style.display = 'none'; }
}

// =========================================================================
// Módulo de Flashcards Q-Bank: Botão Flutuante e Aba Vertical na Margem Esquerda
// =========================================================================
let flashcardWindowRef = null;
let currentQNumberExt = 1;

function extrairIdQuestaoAtual() {
    let qId = '';
    const idEl = document.querySelector('[id*="question-id"], [class*="question-id"], [class*="q-id"], [data-question-id]');
    if (idEl) {
        const text = idEl.innerText.replace(/[^0-9]/g, '');
        if (text) qId = text;
    }
    if (!qId) {
        const matches = document.body.innerText.match(/(?:Question\s*Id|Item|Quest[aã]o)\s*[:#]?\s*(\d{4,8})/i);
        if (matches) qId = matches[1];
    }
    if (!qId) {
        qId = 'Q-' + currentQNumberExt;
    }
    return qId;
}

function extrairDadosCompletosQuestao() {
    const qId = extrairIdQuestaoAtual();
    const stemArr = extrairEnunciadoParaFila();
    const questionStem = stemArr.map(i => i.text).join('\n\n');
    const choicesArr = extrairAlternativasParaFila();
    const questionChoices = choicesArr.filter(i => i.text !== 'Options:').map(i => i.text).join('\n');
    const expArr = extrairExplicacaoParaFila();
    const explanation = expArr.filter(i => i.text !== 'Explanation not found.').map(i => i.text).join('\n\n');
    const objArr = extrairObjetivoParaFila();
    const educationalObjective = objArr.filter(i => i.text !== 'Educational objective not found.').map(i => i.text).join('\n\n');
    
    // Coleta avançada de imagens: explicação, links ao longo do texto e figuras da questão
    const collectedImageUrls = new Set();
    const searchSelectors = [
        '[class*="explanation"]', '[id*="explanation"]', 
        '[class*="solution"]', '[class*="rationale"]', 
        '[class*="tab-content"]', '.educational-objective', 
        '[class*="objective"]', '.max-w-5xl', 'body'
    ];

    searchSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(container => {
            // 1. Tags <img> normais e lazy-loaded
            container.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-zoom-image');
                if (src && !src.startsWith('data:image/svg') && !src.includes('pixel') && !src.includes('spacer') && !src.includes('icon')) {
                    try {
                        const fullUrl = new URL(src, window.location.href).href;
                        collectedImageUrls.add(fullUrl);
                    } catch(e) {
                        collectedImageUrls.add(src);
                    }
                }
            });

            // 2. Links <a> para figuras/imagens ou exhibits
            container.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href') || '';
                const isImgLink = /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(href) || 
                                  href.includes('/image/') || 
                                  href.includes('/media/') || 
                                  href.includes('/figures/') || 
                                  href.includes('cloudfront.net') || 
                                  href.includes('uworld') || 
                                  href.includes('amboss');
                if (isImgLink) {
                    try {
                        const fullUrl = new URL(href, window.location.href).href;
                        collectedImageUrls.add(fullUrl);
                    } catch(e) {
                        collectedImageUrls.add(href);
                    }
                }
            });

            // 3. Imagens de background em elementos de explicação
            container.querySelectorAll('[style*="background"]').forEach(el => {
                const style = el.getAttribute('style') || '';
                const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
                if (match && match[1] && !match[1].startsWith('data:image/svg')) {
                    try {
                        const fullUrl = new URL(match[1], window.location.href).href;
                        collectedImageUrls.add(fullUrl);
                    } catch(e) {
                        collectedImageUrls.add(match[1]);
                    }
                }
            });
        });
    });

    const questionImages = Array.from(collectedImageUrls);
    const qTag = qId ? `q-${qId}` : '';
    const tags = qTag ? [qTag, 'qbank-sync'] : ['qbank-sync'];

    return {
        questionId: qId,
        questionStem: questionStem || `Questão #${currentQNumberExt}`,
        questionChoices: questionChoices || '',
        explanation: explanation || '',
        educationalObjective: educationalObjective || '',
        questionImages: questionImages,
        front: '', // Não preencher frente com enunciado (apenas em seu próprio campo)
        back: '',  // Não preencher verso com educational objective (apenas em seu próprio campo)
        tags: tags
    };
}

function criarFlashcardUI() {
    if (document.getElementById('qbankly-card-launcher')) return;

    // 1. Botão Flutuante Discreto na Margem Esquerda
    const launcher = document.createElement('div');
    launcher.id = 'qbankly-card-launcher';
    launcher.title = 'Abrir Gerador de Flashcard da Questão (Margem Esquerda)';
    launcher.innerHTML = `
        <span class="card-icon">⚡</span>
        <span class="card-label">Flashcard</span>
        <span class="card-badge" id="qbankly-launcher-badge">Q1</span>
    `;
    document.body.appendChild(launcher);

    // 2. Aba Vertical na Margem Esquerda (Drawer Retrátil)
    const drawer = document.createElement('div');
    drawer.id = 'qbankly-card-drawer';
    drawer.innerHTML = `
        <div style="padding: 14px 16px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; background: #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 16px;">⚡</div>
                <div>
                    <div style="font-weight: 800; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 6px;">
                        <span>Flashcard Q-Bank</span>
                        <span id="drawer-header-qid" style="font-family: monospace; font-size: 10px; background: rgba(59,130,246,0.3); color: #93c5fd; padding: 2px 5px; border-radius: 4px;">Q-1</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">Integração com Questões</div>
                </div>
            </div>
            <button id="qbankly-drawer-close" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
        </div>

        <div id="drawer-feedback" style="display: none; margin: 12px 14px 0 14px; padding: 8px 12px; background: rgba(16,185,129,0.15); border: 1px solid #10b981; border-radius: 8px; color: #6ee7b7; font-size: 11px;"></div>

        <div style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px;">
            <div id="drawer-status-card" style="padding: 14px; border-radius: 12px; background: #1e293b; border: 1px solid #334155;">
                <!-- Preenchido dinamicamente por atualizarStatusCardQuestaoAtual() -->
            </div>

            <div style="padding: 12px; border-radius: 12px; background: rgba(30,41,59,0.5); border: 1px solid #334155; font-size: 11px; color: #94a3b8;">
                <div style="font-weight: 700; color: #cbd5e1; text-transform: uppercase; margin-bottom: 8px; font-size: 10px; letter-spacing: 1px;">Sessões da Questão Exportadas:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Question ID</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Enunciado</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Alternativas</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Explicação</div>
                    <div style="grid-column: span 2; background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Educational Objective & Imagens</div>
                </div>
            </div>
        </div>

        <div style="padding: 12px 14px; border-top: 1px solid #1e293b; background: #1e293b; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <button id="drawer-btn-prev" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">⏮️ Anterior</button>
            <span id="drawer-q-counter" style="font-family: monospace; font-size: 12px; font-weight: bold; color: #94a3b8; padding: 0 4px;">Q1</span>
            <button id="drawer-btn-next" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #2563eb; background: #2563eb; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">Próxima ⏭️</button>
        </div>
    `;
    document.body.appendChild(drawer);

    // Eventos
    launcher.addEventListener('click', () => {
        drawer.classList.add('open');
        launcher.style.display = 'none';
        atualizarStatusCardQuestaoAtual();
    });

    document.getElementById('qbankly-drawer-close').addEventListener('click', () => {
        drawer.classList.remove('open');
        launcher.style.display = 'flex';
    });

    document.getElementById('drawer-btn-prev').addEventListener('click', () => navegarQuestaoDrawer(-1));
    document.getElementById('drawer-btn-next').addEventListener('click', () => navegarQuestaoDrawer(1));

    atualizarStatusCardQuestaoAtual();
}

function mostrarFeedbackDrawer(texto) {
    const fb = document.getElementById('drawer-feedback');
    if (fb) {
        fb.innerText = texto;
        fb.style.display = 'block';
        setTimeout(() => { fb.style.display = 'none'; }, 4000);
    }
}

function atualizarStatusCardQuestaoAtual() {
    const qId = extrairIdQuestaoAtual();
    const badgeLauncher = document.getElementById('qbankly-launcher-badge');
    if (badgeLauncher) badgeLauncher.innerText = 'Q' + currentQNumberExt;

    const headerQid = document.getElementById('drawer-header-qid');
    if (headerQid) headerQid.innerText = qId;

    const counter = document.getElementById('drawer-q-counter');
    if (counter) counter.innerText = 'Q' + currentQNumberExt;

    const statusCard = document.getElementById('drawer-status-card');
    if (!statusCard) return;

    chrome.storage.local.get(['saved_question_cards'], function(res) {
        const cardsMap = res.saved_question_cards || {};
        const cardExistente = cardsMap[qId];

        if (cardExistente) {
            statusCard.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Questão #${currentQNumberExt}</span>
                    <span style="font-size: 10px; font-weight: 700; background: rgba(16,185,129,0.2); color: #34d399; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        ● Flashcard Criado
                    </span>
                </div>
                <div style="font-size: 11px; color: #cbd5e1; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #1e293b; margin-bottom: 10px; max-height: 80px; overflow: hidden; text-overflow: ellipsis;">
                    <b>Frente:</b> ${cardExistente.front.replace(/<[^>]+>/g, '').substring(0, 100)}...
                </div>
                <button id="btn-gerar-card" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(37,99,235,0.4);">
                    ⚡ Abrir / Atualizar no Editor
                </button>
            `;
        } else {
            statusCard.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Questão #${currentQNumberExt}</span>
                    <span style="font-size: 10px; font-weight: 700; background: rgba(148,163,184,0.2); color: #94a3b8; padding: 2px 8px; border-radius: 12px;">
                        Sem Flashcard
                    </span>
                </div>
                <p style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin: 0 0 10px 0;">
                    Nenhum flashcard criado ainda para esta questão.
                </p>
                <button id="btn-gerar-card" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                    ⚡ Gerar Flashcard da Questão
                </button>
                <div style="margin-top: 8px; font-size: 10px; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(251,191,36,0.2);">
                    ℹ️ <b>Proteção:</b> Se uma questão não tiver flashcard criado, <u>nenhum flashcard vazio é salvo</u> ao avançar ou retroceder.
                </div>
            `;
        }

        const btnGerar = document.getElementById('btn-gerar-card');
        if (btnGerar) {
            btnGerar.addEventListener('click', executarGeracaoFlashcard);
        }
    });
}

function executarGeracaoFlashcard(isAutoNav = false) {
    const cardData = extrairDadosCompletosQuestao();
    const qId = cardData.questionId;

    // 1. Notificar BroadcastChannel se suportado
    try {
        const bc = new BroadcastChannel('usmle_flashcards_sync');
        bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: Boolean(isAutoNav) });
        setTimeout(() => bc.close(), 1000);
    } catch(e) {}

    // 2. Verificar abas já abertas do app (gerenciar baralho, criar card, etc) via Background Service Worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'IMPORT_FLASHCARD_TO_APP', payload: cardData, isAutoNav: Boolean(isAutoNav) }, (response) => {
            if (!isAutoNav) {
                if (response && response.method === 'existing_tab') {
                    mostrarFeedbackDrawer('Aba já aberta encontrada! Card carregado sem abrir nova janela.');
                } else if (response && response.method === 'new_tab') {
                    mostrarFeedbackDrawer('Nova aba aberta com o card preenchido!');
                }
            }
        });
        return;
    }

    // 3. Fallback Cross-Window caso service worker não responda
    if (isAutoNav) {
        // Na navegação automática, apenas envia se a janela de flashcards já estiver aberta
        if (flashcardWindowRef && !flashcardWindowRef.closed) {
            flashcardWindowRef.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: true }, '*');
        }
        return;
    }

    let appUrl = 'https://usmle-study-tools.vercel.app/flashcards?tab=browse&action=create_card';
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('run.app') || window.location.hostname.includes('web.app')) {
        appUrl = window.location.origin + '/flashcards?tab=browse&action=create_card';
    }

    if (flashcardWindowRef && !flashcardWindowRef.closed) {
        flashcardWindowRef.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: false }, '*');
        flashcardWindowRef.focus();
        mostrarFeedbackDrawer('Dados copiados para a janela de Flashcards aberta!');
    } else {
        flashcardWindowRef = window.open(appUrl, 'USMLEFlashcardsWindow');
        chrome.storage.local.set({ pending_flashcard_import: cardData });
        mostrarFeedbackDrawer('Abrindo editor de flashcards com os dados...');
        
        let attempts = 0;
        const sendInterval = setInterval(() => {
            attempts++;
            if (flashcardWindowRef && !flashcardWindowRef.closed) {
                flashcardWindowRef.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: false }, '*');
            }
            if (attempts > 5) clearInterval(sendInterval);
        }, 1200);
    }
}

// Handshake e escuta de flashcards salvos pelo app
window.addEventListener('message', (event) => {
    if (!event.data) return;
    if (event.data.type === 'USMLE_FLASHCARD_TAB_READY') {
        if (event.source) {
            flashcardWindowRef = event.source;
            const cardData = extrairDadosCompletosQuestao();
            try {
                event.source.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData, isAutoNav: false }, '*');
                mostrarFeedbackDrawer('Sessão conectada! Dados importados com sucesso.');
            } catch (e) {}
        }
    } else if (event.data.type === 'USMLE_FLASHCARD_SAVED') {
        const savedData = event.data.payload;
        if (savedData && savedData.questionId) {
            chrome.storage.local.get(['saved_question_cards'], function(res) {
                const cardsMap = res.saved_question_cards || {};
                cardsMap[savedData.questionId] = {
                    id: 'card-' + Date.now(),
                    questionId: savedData.questionId,
                    front: savedData.front,
                    back: savedData.back,
                    createdAt: Date.now()
                };
                chrome.storage.local.set({ saved_question_cards: cardsMap }, function() {
                    atualizarStatusCardQuestaoAtual();
                });
            });
        }
    }
});

// BroadcastChannel para sincronização de cards salvos
try {
    const bcSync = new BroadcastChannel('usmle_flashcards_sync');
    bcSync.onmessage = (event) => {
        if (event.data && event.data.type === 'USMLE_FLASHCARD_SAVED') {
            const savedData = event.data.payload;
            if (savedData && savedData.questionId) {
                chrome.storage.local.get(['saved_question_cards'], function(res) {
                    const cardsMap = res.saved_question_cards || {};
                    cardsMap[savedData.questionId] = {
                        id: 'card-' + Date.now(),
                        questionId: savedData.questionId,
                        front: savedData.front,
                        back: savedData.back,
                        createdAt: Date.now()
                    };
                    chrome.storage.local.set({ saved_question_cards: cardsMap }, function() {
                        atualizarStatusCardQuestaoAtual();
                    });
                });
            }
        }
    };
} catch(e) {}

function navegarQuestaoDrawer(direcao) {
    if (direcao > 0) {
        acionarBotao('next');
        currentQNumberExt++;
    } else if (direcao < 0 && currentQNumberExt > 1) {
        acionarBotao('previous');
        currentQNumberExt--;
    }
    // Ao navegar pelas questões, aguarda o DOM carregar e sincroniza automaticamente com o editor
    setTimeout(() => {
        atualizarStatusCardQuestaoAtual();
        executarGeracaoFlashcard(true); // isAutoNav: true
    }, 700);
}

// Monitoramento automático de troca de questão (detecção contínua ao mudar de questão no Q-Bank)
let ultimoQIdSincronizado = '';
function monitorarMudancaQuestao() {
    const atualId = extrairIdQuestaoAtual();
    if (atualId && atualId !== ultimoQIdSincronizado) {
        ultimoQIdSincronizado = atualId;
        atualizarStatusCardQuestaoAtual();
        executarGeracaoFlashcard(true); // isAutoNav: true
    }
}
setInterval(monitorarMudancaQuestao, 1500);

window.addEventListener('DOMContentLoaded', () => {
    criarBarraUI();
    criarFlashcardUI();
});
if (document.body) {
    criarFlashcardUI();
}

// --- Beep Sonoro ---
function playBeep(isActivation) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
        if (isActivation) { osc.frequency.setValueAtTime(500, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); } 
        else { osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1); }
        gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
}

function obterVozesAsync() {
    return new Promise(resolve => {
        let vozes = window.speechSynthesis.getVoices();
        if (vozes.length > 0) resolve(vozes);
        else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    });
}

// --- Player State Machine ---
let filaDeLeitura = [];
let indiceLeitura = 0;
let isPaused = false;
let currentUtterance = null; 
let currentWordSpans = [];

function limparDestaques() { document.querySelectorAll('.voz-highlight').forEach(el => el.classList.remove('voz-highlight')); }

function pararLeitura() {
    window.speechSynthesis.cancel();
    filaDeLeitura = []; indiceLeitura = 0; isPaused = false;
    limparDestaques(); esconderBarraUI();
}

function alternarPlayPause() {
    if (filaDeLeitura.length === 0) return;
    if (isPaused) { window.speechSynthesis.resume(); isPaused = false; atualizarBarraUI('tocando'); } 
    else { window.speechSynthesis.pause(); isPaused = true; atualizarBarraUI('pausado'); }
}

function navegarFrase(direcao) {
    if (filaDeLeitura.length === 0) return;
    window.speechSynthesis.cancel();
    indiceLeitura += direcao;
    if (indiceLeitura < 0) indiceLeitura = 0;
    isPaused = false; tocarAtual();
}

async function tocarAtual() {
    limparDestaques();
    currentWordSpans = [];

    if (indiceLeitura >= filaDeLeitura.length) { pararLeitura(); return; }

    atualizarBarraUI('tocando');
    const item = filaDeLeitura[indiceLeitura];
    let textToSpeak = item.text;
    
    if (item.node) {
        item.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const existingSpans = item.node.querySelectorAll('.palavra-lida');
        existingSpans.forEach(span => {
            const parent = span.parentNode;
            while(span.firstChild) parent.insertBefore(span.firstChild, span);
            parent.removeChild(span);
        });
        
        const walker = document.createTreeWalker(item.node, NodeFilter.SHOW_TEXT, null, false);
        let textNodes = [];
        while(walker.nextNode()) {
            const pTag = walker.currentNode.parentNode.tagName.toLowerCase();
            if (pTag !== 'script' && pTag !== 'style' && walker.currentNode.nodeValue.trim() !== '') textNodes.push(walker.currentNode);
        }

        textToSpeak = "";
        textNodes.forEach(textNode => {
            const parts = textNode.nodeValue.split(/(\s+)/);
            const fragment = document.createDocumentFragment();
            parts.forEach(part => {
                if (part.trim() === '') {
                    fragment.appendChild(document.createTextNode(part)); textToSpeak += part;
                } else {
                    const span = document.createElement('span'); span.textContent = part; span.className = 'palavra-lida';
                    currentWordSpans.push({ span: span, index: textToSpeak.length });
                    textToSpeak += part; fragment.appendChild(span);
                }
            });
            if (!textToSpeak.match(/\s$/)) { textToSpeak += " "; fragment.appendChild(document.createTextNode(" ")); }
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    const vozes = await obterVozesAsync(); 
    currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
    
    let vozEncontrada = false;
    if (configAtual.vozEscolhida && configAtual.vozEscolhida !== 'default') {
        const voz = vozes.find(v => v.name === configAtual.vozEscolhida);
        if (voz) { currentUtterance.voice = voz; vozEncontrada = true; }
    }
    if (!vozEncontrada) {
        const nomesDesejados = ["Ava", "Andrew", "Emma", "Brian"];
        const vozPreferencial = vozes.find(v => nomesDesejados.some(n => v.name.includes(n)) && v.name.includes('Online'));
        if (vozPreferencial) currentUtterance.voice = vozPreferencial; else currentUtterance.lang = 'en-US'; 
    }
    
    currentUtterance.rate = parseFloat(configAtual.velocidadeVoz) || 1.1;

    currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
            limparDestaques();
            let spanAtual = null;
            for (let i = currentWordSpans.length - 1; i >= 0; i--) {
                if (event.charIndex >= currentWordSpans[i].index) { spanAtual = currentWordSpans[i].span; break; }
            }
            if (spanAtual) spanAtual.classList.add('voz-highlight');
        }
    };

    currentUtterance.onend = () => { if(!isPaused) { indiceLeitura++; tocarAtual(); } };
    currentUtterance.onerror = () => { limparDestaques(); };
    window.speechSynthesis.speak(currentUtterance);
}

function iniciarFila(itens) {
    pararLeitura(); 
    if (itens.length === 0) return;
    filaDeLeitura = itens; indiceLeitura = 0; tocarAtual();
}

async function falarFeedback(texto) {
    pararLeitura(); 
    const vozes = await obterVozesAsync();
    const msg = new SpeechSynthesisUtterance(texto);
    const vozPT = vozes.find(v => v.lang.includes('pt-BR') && (v.name.includes('Natural') || v.name.includes('Online')));
    if (vozPT) msg.voice = vozPT; else msg.lang = 'pt-BR';
    msg.rate = parseFloat(configAtual.velocidadeVoz) || 1.1;
    window.speechSynthesis.speak(msg);
}

// --- Funções de Extração Inteligente por Blocos ---
function getBlocosDeTexto(container) {
    const itens = [];
    if (!container) return itens;
    const blocos = container.querySelectorAll('p, li, td, th, h1, h2, h3, h4, h5, h6');
    blocos.forEach(b => {
        const hasBlockChildren = Array.from(b.children).some(child => ['P', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName));
        if (!hasBlockChildren && b.innerText.trim().length > 0) itens.push({ text: b.innerText, node: b });
    });
    if(itens.length === 0 && container.innerText.trim().length > 0) itens.push({ text: container.innerText, node: container });
    return itens;
}

function extrairEnunciadoParaFila() {
    const containerQuestao = document.querySelector('.max-w-5xl div.\\!text-ink');
    const blocos = getBlocosDeTexto(containerQuestao);
    return blocos.length === 0 ? [{ text: "Question text not found.", node: null }] : blocos;
}

function extrairAlternativasParaFila() {
    const itens = [];
    const linhasAlternativas = document.querySelectorAll('tr.cursor-pointer, tr.cursor-default');
    if (linhasAlternativas.length > 0) {
        itens.push({ text: "Options:", node: null });
        linhasAlternativas.forEach(linha => {
            const textContent = linha.innerText.replace('ab', '').trim();
            if(textContent) itens.push({ text: textContent, node: linha }); 
        });
    }
    return itens;
}

function extrairExplicacaoParaFila() {
    const objHeader = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('Educational objective'));
    if (!objHeader) return [{ text: "Explanation not found.", node: null }];
    const container = objHeader.parentElement;
    const blocos = getBlocosDeTexto(container);
    const itens = [];
    for (let b of blocos) {
        if (objHeader.contains(b.node) || b.node === objHeader) break;
        itens.push(b);
    }
    return itens;
}

function extrairObjetivoParaFila() {
    const objHeader = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('Educational objective'));
    if (!objHeader) return [{ text: "Educational objective not found.", node: null }];
    const container = objHeader.parentElement;
    const blocos = getBlocosDeTexto(container);
    const itens = [];
    let started = false;
    for (let b of blocos) {
        if (objHeader.contains(b.node) || b.node === objHeader) started = true;
        if (started) itens.push(b);
    }
    return itens;
}

function lerEnunciado() { iniciarFila(extrairEnunciadoParaFila()); }
function lerAlternativas() { iniciarFila(extrairAlternativasParaFila()); }
function lerQuestaoCompleta() { iniciarFila([...extrairEnunciadoParaFila(), ...extrairAlternativasParaFila()]); }

// --- Automação ---
function processarSubmit() {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnSubmit = botoes.find(b => b.textContent.trim() === 'Submit');
    if (btnSubmit && !btnSubmit.disabled) {
        const currentText = extrairEnunciadoParaFila().map(i => i.text).join(" ");
        btnSubmit.click();
        
        // Notifica o Pacer
        notificarPacer(false, true, false);

        let tentativas = 0;
        const checkInterval = setInterval(() => {
            tentativas++;
            const alertDiv = document.querySelector('div[role="alert"]');
            if (alertDiv) {
                clearInterval(checkInterval);
                const resultText = alertDiv.innerText.toLowerCase();
                if (resultText.includes('correct') && !resultText.includes('incorrect')) falarFeedback("Você acertou a questão.");
                else if (resultText.includes('incorrect')) falarFeedback("Você errou a questão.");
                else falarFeedback("Resposta enviada.");
                return;
            }
            const newText = extrairEnunciadoParaFila().map(i => i.text).join(" ");
            if (newText !== currentText && newText !== "Question text not found.") {
                clearInterval(checkInterval); playBeep(true);
                if (configAtual.autoRead) setTimeout(() => lerQuestaoCompleta(), 1500);
                return;
            }
            if (tentativas > 25) clearInterval(checkInterval); 
        }, 200);
    } else falarFeedback("Selecione uma alternativa antes de enviar.");
}

function selecionarAlternativa(letraDesejada) {
    const linhasAlternativas = document.querySelectorAll('tr.cursor-pointer');
    let encontrou = false;
    linhasAlternativas.forEach(linha => {
        const spanLetra = linha.querySelector('span.font-normal');
        if (spanLetra && spanLetra.innerText.toLowerCase().includes(letraDesejada)) {
            linha.click(); playBeep(true); encontrou = true;
        }
    });
    if (!encontrou) falarFeedback(`Alternativa ${letraDesejada.toUpperCase()} não encontrada.`);
}

function acionarBotao(acao) {
    if (acao === 'next') { 
        const b = document.querySelector('button[title="Next"]'); 
        if(b) b.click(); 
        notificarPacer(true, false, false);
    }
    else if (acao === 'previous') { 
        const b = document.querySelector('button[title="Previous"]'); 
        if(b) b.click(); 
        notificarPacer(false, false, true);
    }
}

// --- Cliques Manuais na Tela ---
document.addEventListener('click', (e) => {
    // 1. Notifica o Pacer quando botões são clicados manualmente na tela
    const btn = e.target.closest("button, a, [role='button'], .submit-btn, input[type='submit'], input[type='button']");
    if (btn) {
        const title = (btn.getAttribute("title") || "").toLowerCase();
        const text = (btn.textContent || "").toLowerCase();
        const cls = (btn.getAttribute("class") || "").toLowerCase();
        const val = (btn.getAttribute("value") || "").toLowerCase();

        const isNext = title.includes("next") || text.includes("next") || cls.includes("next") || title.includes("próximo") || text.includes("próximo") || val.includes("next");
        const isSubmit = title.includes("submit") || text.includes("submit") || cls.includes("submit") || text.includes("enviar") || val.includes("submit");
        const isPrev = title.includes("prev") || text.includes("prev") || cls.includes("prev") || title.includes("anterior") || text.includes("anterior") || val.includes("prev");

        if (isNext || isSubmit || isPrev) {
            notificarPacer(isNext, isSubmit, isPrev);
            if (isNext) currentQNumberExt++;
            else if (isPrev && currentQNumberExt > 1) currentQNumberExt--;
            setTimeout(() => {
                if (typeof atualizarStatusCardQuestaoAtual === 'function') {
                    atualizarStatusCardQuestaoAtual();
                }
                executarGeracaoFlashcard(true); // isAutoNav: true
            }, 700);
        }
    }

    // 2. Auto-Read
    if (configAtual.autoRead) {
        const btnNav = e.target.closest('button[title="Next"], button[title="Previous"]');
        if (btnNav) { pararLeitura(); setTimeout(() => lerQuestaoCompleta(), 1500); }
    }
}, true);

// --- Teclas de Atalho Customizáveis ---
function verificarAtalho(e, atalhoConfig) {
    if (!atalhoConfig) return false;
    const atalhos = atalhoConfig.split(',').map(s => s.trim().toLowerCase());
    for (let atalho of atalhos) {
        const partes = atalho.split('+').map(p => p.trim());
        const principal = partes.pop();
        const ctrl = partes.includes('ctrl');
        const alt = partes.includes('alt');
        const shift = partes.includes('shift');
        if (e.ctrlKey === ctrl && e.altKey === alt && e.shiftKey === shift && e.key.toLowerCase() === principal) return true;
    }
    return false;
}

document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key === 'MediaPlayPause' || verificarAtalho(e, configAtual.kbPlay)) { alternarPlayPause(); e.preventDefault(); }
    else if (e.key === 'MediaStop' || verificarAtalho(e, configAtual.kbStop)) { pararLeitura(); e.preventDefault(); }
    else if (e.key === 'MediaTrackNext' || verificarAtalho(e, configAtual.kbNextPhrase)) { navegarFrase(1); e.preventDefault(); }
    else if (e.key === 'MediaTrackPrevious' || verificarAtalho(e, configAtual.kbPrevPhrase)) { navegarFrase(-1); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbLer)) { lerQuestaoCompleta(); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbRepEnunciado)) { lerEnunciado(); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbRepAlt)) { lerAlternativas(); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbExp)) { iniciarFila(extrairExplicacaoParaFila()); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbObj)) { iniciarFila(extrairObjetivoParaFila()); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbProx)) { acionarBotao('next'); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbAnt)) { acionarBotao('previous'); e.preventDefault(); }
    else if (verificarAtalho(e, configAtual.kbSubmit)) { processarSubmit(); e.preventDefault(); }
    else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        if (!isMicActive) { playBeep(true); iniciarReconhecimento(); } 
        else { isMicActive = false; if(globalRecognition) globalRecognition.stop(); playBeep(false); }
    }
});

// --- Reconhecimento de Voz ---
let isMicActive = false;
let globalRecognition = null;

function comandoDetectado(transcricao, configString) {
    const comandos = configString.split(',').map(c => c.trim().toLowerCase()).filter(c => c);
    return comandos.some(cmd => transcricao.includes(cmd));
}

function iniciarReconhecimento() {
    if (!('webkitSpeechRecognition' in window)) return;
    if (globalRecognition) globalRecognition.stop();

    isMicActive = true;
    globalRecognition = new webkitSpeechRecognition();
    globalRecognition.lang = 'pt-BR'; globalRecognition.continuous = true; globalRecognition.interimResults = false;

    globalRecognition.onresult = function(event) {
        const transcricao = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        
        if (comandoDetectado(transcricao, configAtual.cmdLer)) lerQuestaoCompleta();
        else if (comandoDetectado(transcricao, configAtual.cmdRepEnunciado)) lerEnunciado();
        else if (comandoDetectado(transcricao, configAtual.cmdRepAlt)) lerAlternativas();
        else if (comandoDetectado(transcricao, configAtual.cmdExplicacao)) iniciarFila(extrairExplicacaoParaFila());
        else if (comandoDetectado(transcricao, configAtual.cmdObjetivo)) iniciarFila(extrairObjetivoParaFila());
        else if (comandoDetectado(transcricao, configAtual.cmdProx)) acionarBotao('next');
        else if (comandoDetectado(transcricao, configAtual.cmdAnt)) acionarBotao('previous');
        else if (comandoDetectado(transcricao, configAtual.cmdSubmit)) processarSubmit();
        else if (comandoDetectado(transcricao, configAtual.cmdParar)) pararLeitura();
        else {
            const prefixes = configAtual.cmdSel.split(',').map(c => c.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(c => c);
            if(prefixes.length > 0) {
                const regexAlternativa = new RegExp(`(${prefixes.join('|')})\\s+([a-h])`);
                const matchAlternativa = transcricao.match(regexAlternativa);
                if (matchAlternativa) selecionarAlternativa(matchAlternativa[2]);
            }
        }
    };
    globalRecognition.onend = () => { if (isMicActive) globalRecognition.start(); };
    globalRecognition.start();
}

// --- Mensagens do Popup da Extensão ---
chrome.runtime.onMessage.addListener(function(request) {
    if (request.comando === 'ler') lerQuestaoCompleta();
    if (request.comando === 'rep_enunciado') lerEnunciado();
    if (request.comando === 'rep_alt') lerAlternativas();
    if (request.comando === 'explicacao') iniciarFila(extrairExplicacaoParaFila());
    if (request.comando === 'objetivo') iniciarFila(extrairObjetivoParaFila());
    if (request.comando === 'parar') pararLeitura();
    if (request.comando === 'proxima') acionarBotao('next');
    if (request.comando === 'anterior') acionarBotao('previous');
    if (request.comando === 'submit') processarSubmit();
    
    if (request.comando === 'ativar_mic') { playBeep(true); iniciarReconhecimento(); }
    if (request.comando === 'desativar_mic') { isMicActive = false; if(globalRecognition) globalRecognition.stop(); playBeep(false); }
});
