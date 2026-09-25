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
            const act = changes.pacer_action.newValue;
            window.postMessage(act, "*");
            try {
                localStorage.setItem('pacer_action', JSON.stringify(act));
            } catch(e) {}
        }
    }
});

let pacerWindow = null;
let pacerLastTrigger = 0;
let lastDetectedQId = null;
let lastDetectedQIndex = null;
let lastDetectedPhase = null;

function detectarDadosQuestaoQBank() {
    let qNumber = null;
    let totalQ = null;
    let qId = typeof extrairIdQuestaoAtual === 'function' ? extrairIdQuestaoAtual() : '';

    // 1. Procura texto tipo "Question 5 of 40", "Item 5 of 40", "Questão 5 de 40", "5 / 40"
    const regexFull = /(?:Question|Item|Quest[aã]o)\s*[:#]?\s*(\d+)\s*(?:of|\/|de)\s*(\d+)/i;
    const regexShort = /\b(\d+)\s*(?:of|\/|de)\s*(\d+)\b/i;

    const candidateEls = Array.from(document.querySelectorAll('header, nav, [class*="header"], [class*="toolbar"], [class*="nav"], [class*="topbar"], [class*="status"], span, div, p, h1, h2, h3, h4, h5, h6'));
    
    for (const el of candidateEls) {
        if (el.children.length > 3) continue;
        const txt = (el.innerText || el.textContent || '').trim();
        if (txt.length > 60) continue;

        const mFull = txt.match(regexFull);
        if (mFull && mFull[1] && mFull[2]) {
            const num = parseInt(mFull[1], 10);
            const tot = parseInt(mFull[2], 10);
            if (num > 0 && tot >= num && tot < 500) {
                qNumber = num;
                totalQ = tot;
                break;
            }
        }
    }

    if (!qNumber) {
        for (const el of candidateEls) {
            if (el.children.length > 2) continue;
            const txt = (el.innerText || el.textContent || '').trim();
            if (txt.length > 20) continue;

            const mShort = txt.match(regexShort);
            if (mShort && mShort[1] && mShort[2]) {
                const num = parseInt(mShort[1], 10);
                const tot = parseInt(mShort[2], 10);
                if (num > 0 && tot >= num && tot <= 200) {
                    qNumber = num;
                    totalQ = tot;
                    break;
                }
            }
        }
    }

    // 2. Procura botões numéricos na barra de navegação de questões (Q1, Q2, ..., Q40)
    if (!qNumber) {
        const navItems = Array.from(document.querySelectorAll('[data-question-index], [data-q-index], .q-item, .question-number, button[class*="question-nav"], [class*="item-number"]'));
        if (navItems.length > 1) {
            totalQ = navItems.length;
            const activeItem = navItems.find(item => 
                item.classList.contains('active') || 
                item.classList.contains('selected') || 
                item.classList.contains('current') || 
                item.getAttribute('aria-current') === 'true' || 
                item.getAttribute('aria-selected') === 'true'
            );
            if (activeItem) {
                const numTxt = (activeItem.innerText || activeItem.textContent || '').replace(/\D/g, '');
                if (numTxt) {
                    qNumber = parseInt(numTxt, 10);
                } else {
                    qNumber = navItems.indexOf(activeItem) + 1;
                }
            }
        }
    }

    // 3. Detecção da Fase (Solve vs Review no modo Tutored)
    const expDirect = document.querySelector('.explanation, [class*="explanation" i], [id*="explanation" i], [data-testid*="explanation" i]');
    const hasExpDirect = Boolean(expDirect && (expDirect.innerText || '').trim().length > 30 && expDirect.offsetParent !== null);

    const hasExpHeader = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, span, strong, div.font-bold')).some(el => {
        const t = (el.textContent || '').trim();
        return /^(?:Explanation|Educational\s*Objective|Key\s*Points?|Gabarito\s*Comentado)$/i.test(t) && el.offsetParent !== null;
    });

    const alertDiv = document.querySelector('div[role="alert"], [class*="border-l-red"], [class*="border-l-green"], .result-banner');
    const hasAlert = Boolean(alertDiv && (alertDiv.innerText || '').trim().length > 0 && alertDiv.offsetParent !== null);

    const hasResultInChoices = Boolean(
        document.querySelector('.choices-container .text-emerald-600, .choices-container .text-rose-600, table.choices [class*="green"], table.choices [class*="red"], .choice-row [class*="green"], tr:has(.lucide-check), tr:has(.lucide-x)')
    );

    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
    const btnSubmit = allButtons.find(b => {
        const txt = (b.textContent || b.getAttribute('value') || b.getAttribute('title') || '').trim();
        return /^(?:Submit|Confirm|Confirmar|Check\s*Answer|Responder)$/i.test(txt);
    });
    const hasActiveSubmit = Boolean(btnSubmit && !btnSubmit.disabled && btnSubmit.offsetParent !== null);

    let phase = 'solve';
    if (hasExpDirect || hasExpHeader || hasAlert || hasResultInChoices) {
        phase = 'review';
    } else if (hasActiveSubmit) {
        phase = 'solve';
    }

    return {
        qId,
        questionIndex: qNumber || currentQNumberExt,
        totalQuestions: totalQ,
        phase
    };
}

function notificarPacer(isNext, isSubmit, isPrev, explicitQIndex = null) {
    const now = Date.now();
    if (now - pacerLastTrigger > 300) {
        pacerLastTrigger = now;
        const qData = detectarDadosQuestaoQBank();
        const targetQ = explicitQIndex || qData.questionIndex;
        let phase = isSubmit ? 'review' : qData.phase;

        const actionId = `pacer-${now}-${Math.random().toString(36).substring(2, 7)}`;
        const payload = {
            type: "PACER_BTN_CLICK",
            actionId: actionId,
            id: actionId,
            isNext: Boolean(isNext),
            isSubmit: Boolean(isSubmit),
            isPrev: Boolean(isPrev),
            questionIndex: targetQ,
            totalQuestions: qData.totalQuestions,
            phase: phase,
            qId: qData.qId,
            ts: now
        };

        // 1. Canal direto via janela aberta
        if (pacerWindow && !pacerWindow.closed) {
            try { pacerWindow.postMessage(payload, "*"); } catch(e) {}
        }

        // 2. Canal Universal via Storage da Extensão (repassa para abas do applet)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ pacer_action: payload });
        }

        // 3. Notificar Background Worker para injetar e repassar a todas as abas abertas da aplicação
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'DISPATCH_PACER_ACTION',
                action: payload
            }, () => {});
        }

        // 4. Atualizar Pacer embutido da Extensão em segundo plano
        atualizarPacerEmbutido(isNext, isSubmit, isPrev);
    }
}

function atualizarPacerEmbutido(isNext, isSubmit, isPrev) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(['pacer_state'], function(res) {
        let pState = res.pacer_state;
        if (!pState || !pState.isActive || pState.isPaused) return;

        const trig = pState.triggerMode || 'both';
        let shouldAdvance = false;
        let shouldGoBack = false;

        if (trig === 'next' && isNext) shouldAdvance = true;
        else if (trig === 'submit' && isSubmit) shouldAdvance = true;
        else if (trig === 'both' && (isNext || isSubmit)) shouldAdvance = true;

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
        position: fixed; bottom: 20px; right: 20px; background: #004976; color: white; width: 45px; height: 45px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; 
        cursor: pointer; z-index: 999998; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: 0.2s;
    }
    #qbankly-tts-launcher:hover { transform: scale(1.1); }
    #qbankly-tts-bar {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0, 73, 118, 0.95); color: white; display: none; gap: 15px; padding: 12px 20px;
        border-radius: 50px; z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        align-items: center; justify-content: center; backdrop-filter: blur(5px); border: 1px solid #005f9e;
    }
    #qbankly-tts-bar button { background: none; border: none; color: white; font-size: 20px; cursor: pointer; transition: 0.2s; padding: 0; outline: none; }
    #qbankly-tts-bar button:hover { transform: scale(1.2); text-shadow: 0 0 10px rgba(255,255,255,0.8); }
    #tts-drag-handle { cursor: grab; padding-right: 5px; opacity: 0.7; user-select: none; font-size: 18px; display: flex; align-items: center; }
    #tts-drag-handle:active { cursor: grabbing; }
    #tts-btn-close { font-size: 14px !important; margin-left: 5px; opacity: 0.7; }
    #tts-btn-close:hover { opacity: 1; color: #ff4444 !important; }

    /* --- Botão Flutuante Discreto na Margem DIREITA e Aba Vertical (Flashcards) --- */
    #qbankly-card-launcher {
        position: fixed !important;
        top: 50% !important;
        right: 0px !important;
        left: auto !important;
        transform: translateY(-50%) !important;
        background: linear-gradient(180deg, #1d4ed8, #3b82f6) !important;
        color: white !important;
        padding: 12px 6px !important;
        border-radius: 12px 0 0 12px !important;
        display: none;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 11px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        z-index: 2147483647 !important;
        box-shadow: -4px 0 16px rgba(0,0,0,0.35) !important;
        border: 1px solid rgba(255,255,255,0.4) !important;
        border-right: none !important;
        transition: 0.2s !important;
        user-select: none !important;
    }
    #qbankly-card-launcher:hover {
        padding-left: 10px !important;
        background: linear-gradient(180deg, #1e40af, #2563eb) !important;
    }
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
        position: fixed !important;
        top: 0px !important;
        right: 0px !important;
        left: auto !important;
        width: 360px !important;
        height: 100vh !important;
        background: #0f172a !important;
        color: #f8fafc !important;
        z-index: 2147483647 !important;
        box-shadow: -8px 0 35px rgba(0,0,0,0.6) !important;
        border-left: 2px solid #334155 !important;
        border-right: none !important;
        display: none;
        flex-direction: column !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-sizing: border-box !important;
        text-align: left !important;
    }
    #qbankly-card-drawer * { box-sizing: border-box; }
    #qbankly-card-drawer.open { display: flex !important; }
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
// Módulo de Flashcards Q-Bank: Botão Flutuante e Aba Vertical na Margem Direita
// =========================================================================
let flashcardWindowRef = null;
let currentQNumberExt = 1;
let lastImportedQId = null;

// Verifica estritamente se a página atual é uma página de resolução de questões do Q-Bank
function isPaginaResolucaoQBank() {
    // 1. Containers típicos de enunciado / stem de caso clínico
    const hasStemEl = Boolean(
        document.querySelector('[id*="question-id"], [class*="question-id"], [data-question-id], .question-stem, .q-stem, .stem, [class*="questionBody"], [class*="question-content"], .max-w-5xl, div[class*="case-study"], [id*="qStem"]')
    );
    // 2. Alternativas / opções de múltipla escolha
    const hasChoicesEl = Boolean(
        document.querySelector('.choices-container, .answer-choices, table.choices, .choice-row, input[type="radio"][name*="question"], input[type="radio"][name*="choice"], tr.cursor-pointer, .option-text, [class*="alternative"]')
    );
    // 3. Botões de navegação e resolução
    const hasNavButtons = Boolean(
        document.querySelector('button[title*="Next" i], button[title*="Previous" i], button[title*="Submit" i], .submit-btn, button[class*="next" i], button[class*="prev" i]')
    );
    // 4. Texto típico de questão no corpo da página
    const bodyText = document.body ? (document.body.innerText || '') : '';
    const hasQIdPattern = /(?:Question\s*Id|Item|Quest[aã]o)\s*[:#]?\s*(\d{4,8})/i.test(bodyText);
    const hasChoiceLetters = /(?:^|\n)\s*[A-F]\s*[\.\)]\s+/m.test(bodyText);

    return (hasStemEl && (hasChoicesEl || hasNavButtons)) || (hasQIdPattern && (hasChoicesEl || hasChoiceLetters || hasNavButtons));
}

function atualizarVisibilidadeBotaoQBank() {
    const launcher = document.getElementById('qbankly-card-launcher');
    const drawer = document.getElementById('qbankly-card-drawer');
    if (!launcher) return;

    const estaEmResolucao = isPaginaResolucaoQBank();
    if (estaEmResolucao) {
        if (!drawer || !drawer.classList.contains('open')) {
            launcher.style.display = 'flex';
        }
    } else {
        launcher.style.display = 'none';
        if (drawer && drawer.classList.contains('open')) {
            drawer.classList.remove('open');
        }
    }
}

function extrairIdQuestaoAtual() {
    let qId = '';

    // 1. Procura label "Q ID" e seu irmão adjacente (como no QBankly: span com texto "Q ID" seguido de span com "4262")
    const allLabels = Array.from(document.querySelectorAll('span, button, div, dt, td'));
    for (let el of allLabels) {
        const txt = (el.innerText || el.textContent || '').trim();
        if (/^Q\s*ID$/i.test(txt)) {
            const next = el.nextElementSibling || (el.parentElement ? el.parentElement.querySelector('span:nth-child(2), [title], [class*="semibold"]') : null);
            if (next && next !== el) {
                const val = (next.getAttribute('title') || next.innerText || next.textContent || '').replace(/[^0-9]/g, '');
                if (val) { qId = val; break; }
            }
        }
    }

    // 2. Procura Question Id na navbar superior: "Question Id: 4262"
    if (!qId) {
        const headerEl = Array.from(document.querySelectorAll('span, div')).find(el => 
            /Question\s*Id\s*:\s*\d+/i.test(el.textContent || '')
        );
        if (headerEl) {
            const m = headerEl.textContent.match(/Question\s*Id\s*:\s*(\d+)/i);
            if (m) qId = m[1];
        }
    }

    // 3. Atualiza o número da questão pelo item (ex: "Item 51 of 60" ou "51 / 60")
    const itemEl = Array.from(document.querySelectorAll('span, div')).find(el => 
        /Item\s*\d+\s*of\s*\d+/i.test(el.textContent || '') || /^\s*\d+\s*\/\s*\d+\s*$/.test(el.textContent || '')
    );
    if (itemEl) {
        const m = itemEl.textContent.match(/(?:Item\s*)?(\d+)\s*(?:of|\/)\s*(\d+)/i);
        if (m) currentQNumberExt = parseInt(m[1], 10);
    }

    // 4. Fallback no body text
    const bodyText = document.body ? document.body.innerText : '';
    if (!qId) {
        const matchQId = bodyText.match(/(?:Question\s*Id|Quest[aã]o|QID)\s*[:#]?\s*(\d{2,8})/i);
        if (matchQId && matchQId[1]) qId = matchQId[1];
    }

    if (!qId) {
        qId = 'Q-' + currentQNumberExt;
    }
    return qId;
}

// Extração dos novos campos: Subject e System com detecção de 'Click to Show'
function extrairSubjectESystem() {
    let subject = '';
    let system = '';

    // 1. Busca específica por pares de label/valor (como no QBankly / UWorld)
    const allLabels = Array.from(document.querySelectorAll('span, button, div, dt, td, label, b, strong'));
    for (let el of allLabels) {
        const txt = (el.innerText || el.textContent || '').trim();
        
        if (!subject && /^Subject$/i.test(txt)) {
            const next = el.nextElementSibling || (el.parentElement ? el.parentElement.querySelector('span:nth-child(2), button, [title], [class*="semibold"]') : null);
            if (next && next !== el) {
                const val = (next.getAttribute('title') || next.innerText || next.textContent || '').trim();
                if (!/click\s*to\s*show/i.test(val)) {
                    subject = val;
                }
            }
        }
        
        if (!system && /^System$/i.test(txt)) {
            const next = el.nextElementSibling || (el.parentElement ? el.parentElement.querySelector('button, span:nth-child(2), [title], [class*="semibold"]') : null);
            if (next && next !== el) {
                const val = (next.getAttribute('title') || next.innerText || next.textContent || '').trim();
                if (!/click\s*to\s*show/i.test(val)) {
                    system = val;
                }
            }
        }
    }

    // 2. Fallbacks com seletores conhecidos
    if (!subject) {
        const subEl = document.querySelector('[data-subject], .subject-name, [class*="subject"]');
        if (subEl) {
            const val = subEl.getAttribute('title') || subEl.innerText.trim();
            if (!/click\s*to\s*show/i.test(val)) subject = val;
        }
    }
    if (!system) {
        const sysEl = document.querySelector('[data-system], .system-name, [class*="system"]');
        if (sysEl) {
            const val = sysEl.getAttribute('title') || sysEl.innerText.trim();
            if (!/click\s*to\s*show/i.test(val)) system = val;
        }
    }

    // 3. Fallback por regex no body text
    const bodyText = document.body ? document.body.innerText : '';
    if (!subject) {
        const matchSub = bodyText.match(/Subject\s*[\n\r:]+\s*([^\n\r<|]{2,60})/i);
        if (matchSub && matchSub[1] && !/click\s*to\s*show/i.test(matchSub[1])) {
            subject = matchSub[1].trim();
        }
    }
    if (!system) {
        const matchSys = bodyText.match(/System\s*[\n\r:]+\s*([^\n\r<|]{2,80})/i);
        if (matchSys && matchSys[1] && !/click\s*to\s*show/i.test(matchSys[1])) {
            system = matchSys[1].trim();
        }
    }

    return { subject, system };
}

// Clica automaticamente em qualquer botão 'Click to Show' ou 'Show System' na tela
function revelarCamposOcultos() {
    let count = 0;
    const clickables = Array.from(document.querySelectorAll('button, a, span[role="button"], div[role="button"], [class*="cursor-pointer"]'));
    clickables.forEach(el => {
        const txt = (el.innerText || el.textContent || '').trim();
        const title = (el.getAttribute('title') || '').trim();
        const aria = (el.getAttribute('aria-label') || '').trim();
        if (
            /click\s*to\s*show/i.test(txt) ||
            /click\s*to\s*show/i.test(title) ||
            /click\s*to\s*show/i.test(aria) ||
            /show\s*system/i.test(txt) ||
            /show\s*subject/i.test(txt) ||
            /reveal\s*system/i.test(txt)
        ) {
            try {
                el.click();
                count++;
            } catch(e) {}
        }
    });
    return count;
}

// Validador de integridade com auto-recuperação
function validarDadosCompletosQuestao(cardData) {
    // Tenta revelar campos ocultos se algum estiver pendente
    revelarCamposOcultos();

    // Se o system ainda estiver com "Click to show", tenta preencher com o subject ou geral
    if (!cardData.system || /click\s*to\s*show/i.test(cardData.system)) {
        const subSys = extrairSubjectESystem();
        if (subSys.system && !/click\s*to\s*show/i.test(subSys.system)) {
            cardData.system = subSys.system;
        } else if (cardData.subject) {
            cardData.system = cardData.subject;
        } else {
            cardData.system = 'General';
        }
    }

    if (!cardData.subject || /click\s*to\s*show/i.test(cardData.subject)) {
        const subSys = extrairSubjectESystem();
        if (subSys.subject && !/click\s*to\s*show/i.test(subSys.subject)) {
            cardData.subject = subSys.subject;
            cardData.subjective = subSys.subject;
        } else {
            cardData.subject = 'General';
            cardData.subjective = 'General';
        }
    }

    const pendencias = [];
    const status = {
        qid: Boolean(cardData.questionId && cardData.questionId !== 'Q-0'),
        stem: Boolean(cardData.questionStem && !cardData.questionStem.startsWith('Questão #') && cardData.questionStem.trim().length > 10 && cardData.questionStem !== 'Question text not found.' && cardData.questionStem !== 'Texto do enunciado não identificado.'),
        choices: Boolean(cardData.questionChoices && cardData.questionChoices.trim().length > 0 && cardData.questionChoices !== 'Options:'),
        explanation: Boolean(cardData.explanation && cardData.explanation !== 'Explanation not found.' && cardData.explanation.trim().length > 10),
        objective: Boolean(cardData.educationalObjective && cardData.educationalObjective !== 'Educational objective not found.' && cardData.educationalObjective.trim().length > 10),
        system: Boolean(cardData.system && cardData.system.trim().length > 0),
        subject: Boolean(cardData.subject && cardData.subject.trim().length > 0)
    };

    if (!status.stem) pendencias.push('Enunciado não identificado');
    if (!status.choices) pendencias.push('Alternativas não identificadas');
    if (!status.explanation) pendencias.push('Explicação oculta (responda a questão para liberar)');
    if (!status.objective) pendencias.push('Educational Objective oculto');

    return {
        completo: Boolean(status.qid && status.stem && status.choices),
        pendencias,
        status
    };
}

// Toast flutuante na tela para informar o usuário imediatamente caso dados estejam incompletos
function mostrarToastFlutuante(msg, tipo = 'aviso') {
    let toast = document.getElementById('qbankly-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'qbankly-toast';
        toast.style.cssText = `
            position: fixed !important;
            bottom: 24px !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(100px) !important;
            z-index: 2147483647 !important;
            padding: 12px 20px !important;
            border-radius: 12px !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease !important;
            opacity: 0 !important;
            pointer-events: auto !important;
            max-width: 90vw !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        `;
        document.body.appendChild(toast);
    }

    if (tipo === 'aviso' || tipo === 'erro') {
        toast.style.background = '#7f1d1d';
        toast.style.color = '#fecaca';
        toast.style.border = '1px solid #dc2626';
    } else if (tipo === 'sucesso') {
        toast.style.background = '#064e3b';
        toast.style.color = '#a7f3d0';
        toast.style.border = '1px solid #059669';
    } else {
        toast.style.background = '#1e293b';
        toast.style.color = '#e2e8f0';
        toast.style.border = '1px solid #475569';
    }

    toast.innerHTML = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';

    if (window._qbanklyToastTimer) clearTimeout(window._qbanklyToastTimer);
    window._qbanklyToastTimer = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
    }, 6000);
}

// Extração de imagens presentes no enunciado, nas alternativas, na explicação ou em links no texto
function extrairTodasImagensQuestao() {
    const imagesSet = new Set();
    
    // 1. Imagens no Enunciado (Stem)
    const stemEls = document.querySelectorAll('.question-stem, .q-stem, .stem, div[id*="qStem"], [class*="questionBody"], #questionBody, div[class*="question-content"], .max-w-5xl, article.question, .case-study');
    stemEls.forEach(container => {
        container.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-zoom-src') || img.getAttribute('data-original-src') || img.src;
            if (src && !src.includes('data:image/svg') && !src.includes('favicon') && !src.includes('avatar') && !src.includes('logo')) {
                try {
                    imagesSet.add(new URL(src, window.location.href).href);
                } catch(e) {
                    imagesSet.add(src);
                }
            }
        });
    });

    // 2. Imagens no Container de Explicação e Educational Objective
    const expContainer = typeof obterContainerExplicacao === 'function' ? obterContainerExplicacao() : document.querySelector('.explanation, [class*="explanation" i]');
    if (expContainer) {
        expContainer.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-zoom-src') || img.getAttribute('data-original-src') || img.src;
            if (src && !src.includes('data:image/svg') && !src.includes('favicon') && !src.includes('avatar') && !src.includes('logo')) {
                try {
                    imagesSet.add(new URL(src, window.location.href).href);
                } catch(e) {
                    imagesSet.add(src);
                }
            }
        });
    }

    // 3. Imagens dentro das Alternativas
    const choiceEls = document.querySelectorAll('table tbody tr, table.choices tr, .choice-row, [class*="alternative"]');
    choiceEls.forEach(container => {
        container.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-zoom-src') || img.src;
            if (src && !src.includes('data:image/svg') && !src.includes('favicon')) {
                try {
                    imagesSet.add(new URL(src, window.location.href).href);
                } catch(e) {
                    imagesSet.add(src);
                }
            }
        });
    });

    // 4. Todas as imagens da página com filtros médicos ou tamanho representativo
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-zoom-src') || img.getAttribute('data-original-src') || img.src;
        if (!src || src.includes('data:image/svg')) return;

        const isMedicalImage = src.includes('/media/') || 
                               src.includes('/webi/') ||
                               src.includes('qbankly.app') || 
                               src.includes('uworld') || 
                               src.includes('amboss') ||
                               src.includes('Thumbnail') || 
                               img.alt?.includes('Thumbnail') ||
                               img.closest('button[aria-label*="Enlarge" i]') ||
                               img.closest('div[class*="aspect-square"]') ||
                               img.closest('.choices-container, .answer-choices, table.choices, tr') ||
                               img.closest('.explanation, article, main, section') ||
                               (img.width > 40 || img.height > 40);

        if (isMedicalImage && !src.includes('favicon') && !src.includes('avatar') && !src.includes('logo')) {
            try {
                const absUrl = new URL(src, window.location.href).href;
                imagesSet.add(absUrl);
            } catch(e) {
                imagesSet.add(src);
            }
        }
    });

    // 5. Links <a> apontando para imagens ao longo do texto da explicação
    const links = document.querySelectorAll('a[href]');
    links.forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        const isImgLink = /\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?$/i.test(href) ||
                          href.includes('/media/') ||
                          href.includes('/images/') ||
                          href.includes('/webi/');
        if (isImgLink) {
            try {
                const absUrl = new URL(href, window.location.href).href;
                imagesSet.add(absUrl);
            } catch(e) {
                imagesSet.add(href);
            }
        }
    });

    return Array.from(imagesSet);
}

// Gera tags sem duplicações de qid ou qbank-sync
function gerarTagsUnicas(qId, subject, system) {
    const tags = new Set();
    if (qId) tags.add(`qid:${qId}`);
    if (system) {
        const cleanSys = system.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (cleanSys) tags.add(`system:${cleanSys}`);
    }
    if (subject) {
        const cleanSub = subject.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (cleanSub) tags.add(`subject:${cleanSub}`);
    }
    tags.add('qbank-sync');
    return Array.from(tags);
}

function extrairDadosCompletosQuestao() {
    const qId = extrairIdQuestaoAtual();
    const stemArr = extrairEnunciadoParaFila();
    const questionStem = stemArr.filter(i => i.text !== "Question text not found." && i.text !== "Texto do enunciado não identificado.").map(i => i.text).join('\n\n');
    
    // Extrai alternativas estruturadas e limpas
    const detailedAlternatives = extrairAlternativasDetalhadas();
    const questionChoices = detailedAlternatives.map(a => `${a.letter}. ${a.text}`).join('\n');

    const expArr = extrairExplicacaoParaFila();
    const explanation = expArr.filter(i => i.text !== 'Explanation not found.').map(i => i.text).join('\n\n');
    const objArr = extrairObjetivoParaFila();
    const educationalObjective = objArr.filter(i => i.text !== 'Educational objective not found.').map(i => i.text).join('\n\n');
    
    const subSys = extrairSubjectESystem();
    const questionImages = extrairTodasImagensQuestao();
    const tags = gerarTagsUnicas(qId, subSys.subject, subSys.system);

    return {
        questionId: qId,
        questionStem: questionStem || `Questão #${currentQNumberExt}`,
        alternatives: detailedAlternatives,
        choices: detailedAlternatives,
        questionChoices: questionChoices || '',
        explanation: explanation || '',
        educationalObjective: educationalObjective || '',
        subject: subSys.subject || '',
        subjective: subSys.subject || '',
        system: subSys.system || '',
        questionImages: questionImages,
        // Regra: Frente e verso devem permanecer vazios para preenchimento manual do usuário
        front: '',
        back: '',
        tags: tags
    };
}

// Despacha os dados aproveitando abas já abertas com conexão ultra confiável
function despacharDadosParaFlashcards(cardData) {
    const val = validarDadosCompletosQuestao(cardData);
    if (!val.completo) {
        const pendenciasMsg = val.pendencias.join('<br>• ');
        mostrarToastFlutuante(`⚠️ <b>Dados Incompletos para Flashcard:</b><br><div style="text-align:left;font-size:11px;margin-top:4px;">• ${pendenciasMsg}</div><div style="font-size:10px;margin-top:4px;opacity:0.85;">Responda a questão e revele o System ("Click to Show") antes de gerar.</div>`, 'aviso');
        mostrarFeedbackDrawer(`⚠️ Dados incompletos: ${val.pendencias[0]}`);
        return false;
    }

    mostrarFeedbackDrawer('⚡ Sincronizando com o editor de Flashcards...');

    // Salva no storage local da extensão
    chrome.storage.local.set({
        pending_flashcard_import: cardData,
        pending_flashcard_timestamp: Date.now()
    });

    try {
        localStorage.setItem('pending_flashcard_import', JSON.stringify(cardData));
    } catch(e) {}

    // 1. BroadcastChannel para comunicação instantânea entre abas
    try {
        const bc = new BroadcastChannel('usmle_flashcards_sync');
        bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData });
        setTimeout(() => bc.close(), 1500);
    } catch(e) {}

    // 2. Mensagem para o background worker (foca aba existente ou abre no app)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
            type: 'DISPATCH_FLASHCARD_DATA',
            cardData: cardData
        }, (response) => {
            if (response && response.openedNew === false) {
                mostrarFeedbackDrawer('✅ Aba do App localizada e focada! Flashcard carregado.');
            } else if (response && response.openedNew === true) {
                mostrarFeedbackDrawer('🌐 Abrindo o editor de Flashcards...');
            } else {
                mostrarFeedbackDrawer('✅ Flashcard da questão sincronizado com sucesso!');
            }
        });
    }

    // 3. Fallback se janela já foi aberta diretamente
    if (flashcardWindowRef && !flashcardWindowRef.closed) {
        try {
            flashcardWindowRef.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData }, '*');
            flashcardWindowRef.focus();
            mostrarFeedbackDrawer('✅ Flashcard sincronizado com a janela aberta!');
        } catch(e) {}
    }

    mostrarToastFlutuante(`✅ <b>Flashcard pronto!</b> Dados da questão #${currentQNumberExt} exportados.`, 'sucesso');
    return true;
}

// Auto-importação durante a navegação pelas questões:
// Cada questão pela qual o usuário passar só é importada se TODOS os dados estiverem disponíveis
function autoImportarQuestaoSeNavegou() {
    if (!isPaginaResolucaoQBank()) return;
    const currentQId = extrairIdQuestaoAtual();
    if (!currentQId) return;

    const cardData = extrairDadosCompletosQuestao();
    const val = validarDadosCompletosQuestao(cardData);

    // Regra estrita: Se dados estiverem incompletos, não importa e alerta o usuário
    if (!val.completo) {
        return;
    }

    if (currentQId === lastImportedQId) return;
    lastImportedQId = currentQId;

    // Obtém o banco de destino configurado pelo usuário no popup
    const finishSync = (targetBank) => {
        cardData.bankName = targetBank;
        cardData.targetBankName = targetBank;

        // 1. Storage local da extensão e página
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                pending_question_import: cardData,
                last_synced_question: cardData,
                pending_question_timestamp: Date.now()
            });
        }
        try {
            localStorage.setItem('pending_question_import', JSON.stringify(cardData));
            localStorage.setItem('last_synced_question', JSON.stringify(cardData));
        } catch(e) {}

        // 2. BroadcastChannel para comunicação direta com abas do app
        try {
            const qbSync = new BroadcastChannel('usmle_qbank_sync');
            qbSync.postMessage({
                type: 'QBANK_QUESTION_SYNC',
                question: cardData,
                bankName: targetBank,
                qid: currentQId,
                timestamp: Date.now()
            });
            setTimeout(() => qbSync.close(), 1500);
        } catch(e) {}

        // 3. Notificação via Background Worker (injeção em abas e proxy para API do app)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'DISPATCH_QUESTION_DATA',
                questionData: cardData,
                bankName: targetBank
            }, () => {});
        }

        // 4. CustomEvent local se app estiver na mesma janela
        try {
            window.dispatchEvent(new CustomEvent('usmle_import_question', {
                detail: {
                    type: 'QBANK_QUESTION_SYNC',
                    question: cardData,
                    bankName: targetBank,
                    qid: currentQId
                }
            }));
        } catch(e) {}

        mostrarFeedbackDrawer(`✅ Questão #${currentQNumberExt} (QID: ${currentQId}) importada com sucesso!`);
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['target_qbank_name', 'auto_sync_all_questions'], (res) => {
            const targetBank = res.target_qbank_name || 'UWorld Step 1';
            finishSync(targetBank);
        });
    } else {
        finishSync('UWorld Step 1');
    }
}

function criarFlashcardUI() {
    if (document.getElementById('qbankly-card-launcher')) return;

    // 1. Botão Flutuante Discreto na Margem Direita (Estilos forçados no elemento)
    const launcher = document.createElement('div');
    launcher.id = 'qbankly-card-launcher';
    launcher.title = 'Abrir Gerador de Flashcard da Questão (Margem Direita)';
    launcher.style.setProperty('position', 'fixed', 'important');
    launcher.style.setProperty('top', '50%', 'important');
    launcher.style.setProperty('right', '0px', 'important');
    launcher.style.setProperty('left', 'auto', 'important');
    launcher.style.setProperty('transform', 'translateY(-50%)', 'important');
    launcher.style.setProperty('border-radius', '12px 0 0 12px', 'important');
    launcher.style.setProperty('border-right', 'none', 'important');
    launcher.style.setProperty('border-left', '2px solid rgba(255,255,255,0.4)', 'important');
    launcher.style.setProperty('z-index', '2147483647', 'important');
    launcher.innerHTML = `
        <span class="card-icon">⚡</span>
        <span class="card-label">Flashcard</span>
        <span class="card-badge" id="qbankly-launcher-badge">Q1</span>
    `;
    document.body.appendChild(launcher);

    // 2. Aba Vertical na Margem Direita (Drawer Retrátil com estilos forçados)
    const drawer = document.createElement('div');
    drawer.id = 'qbankly-card-drawer';
    drawer.style.setProperty('position', 'fixed', 'important');
    drawer.style.setProperty('top', '0px', 'important');
    drawer.style.setProperty('right', '0px', 'important');
    drawer.style.setProperty('left', 'auto', 'important');
    drawer.style.setProperty('width', '360px', 'important');
    drawer.style.setProperty('height', '100vh', 'important');
    drawer.style.setProperty('border-left', '2px solid #334155', 'important');
    drawer.style.setProperty('border-right', 'none', 'important');
    drawer.style.setProperty('z-index', '2147483647', 'important');
    drawer.innerHTML = `
        <div style="padding: 14px 16px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; background: #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 16px;">⚡</div>
                <div>
                    <div style="font-weight: 800; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 6px;">
                        <span>Flashcard Q-Bank</span>
                        <span id="drawer-header-qid" style="font-family: monospace; font-size: 10px; background: rgba(59,130,246,0.3); color: #93c5fd; padding: 2px 5px; border-radius: 4px;">Q-1</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">Margem Direita • Sincronizado</div>
                </div>
            </div>
            <button id="qbankly-drawer-close" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
        </div>

        <div id="drawer-feedback" style="display: none; margin: 12px 14px 0 14px; padding: 8px 12px; background: rgba(16,185,129,0.15); border: 1px solid #10b981; border-radius: 8px; color: #6ee7b7; font-size: 11px; font-weight: 600;"></div>

        <div style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px;">
            <div id="drawer-status-card" style="padding: 14px; border-radius: 12px; background: #1e293b; border: 1px solid #334155;">
                <!-- Preenchido dinamicamente por atualizarStatusCardQuestaoAtual() -->
            </div>

            <!-- Seção Dinâmica de Flashcards Sugeridos da Questão (AnKing e Criados) -->
            <div id="drawer-suggested-cards-section" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Preenchido dinamicamente por renderizarCardsSugeridosQuestao() -->
            </div>

            <div style="padding: 12px; border-radius: 12px; background: rgba(30,41,59,0.5); border: 1px solid #334155; font-size: 11px; color: #94a3b8;">
                <div style="font-weight: 700; color: #cbd5e1; text-transform: uppercase; margin-bottom: 8px; font-size: 10px; letter-spacing: 1px;">Campos da Questão Importados:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Question ID</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Enunciado</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Alternativas</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Explicação</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Subject & System</div>
                    <div style="background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Educational Objective</div>
                    <div style="grid-column: span 2; background: #0f172a; padding: 6px 8px; border-radius: 6px; border: 1px solid #1e293b; color: #e2e8f0;">✓ Imagens e Links de Imagens</div>
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
        atualizarVisibilidadeBotaoQBank();
    });

    document.getElementById('drawer-btn-prev').addEventListener('click', () => navegarQuestaoDrawer(-1));
    document.getElementById('drawer-btn-next').addEventListener('click', () => navegarQuestaoDrawer(1));

    atualizarVisibilidadeBotaoQBank();
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

        const cardData = extrairDadosCompletosQuestao();
        const val = validarDadosCompletosQuestao(cardData);

        const subSys = extrairSubjectESystem();
        
        // Checklist visual de integridade
        const checklistHtml = `
            <div style="margin-top: 8px; margin-bottom: 8px; padding: 10px; background: rgba(15,23,42,0.9); border-radius: 8px; border: 1px solid #334155; font-size: 11px; line-height: 1.6; color: #94a3b8;">
                <div style="font-weight: 700; color: #cbd5e1; font-size: 10px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Diagnóstico de Campos:</span>
                    <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: ${val.completo ? 'rgba(16,185,129,0.2); color: #34d399;' : 'rgba(239,68,68,0.2); color: #f87171;'}">
                        ${val.completo ? 'Pronto para Importar' : 'Campos Ocultos'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px;">
                    <div><span style="color: ${val.status.stem ? '#34d399' : '#f87171'}">${val.status.stem ? '✓' : '✗'}</span> Enunciado</div>
                    <div><span style="color: ${val.status.choices ? '#34d399' : '#f87171'}">${val.status.choices ? '✓' : '✗'}</span> Alternativas</div>
                    <div><span style="color: ${val.status.explanation ? '#34d399' : '#f87171'}">${val.status.explanation ? '✓' : '✗'}</span> Explicação</div>
                    <div><span style="color: ${val.status.objective ? '#34d399' : '#f87171'}">${val.status.objective ? '✓' : '✗'}</span> Objective</div>
                    <div><span style="color: ${val.status.subject ? '#34d399' : '#f87171'}">${val.status.subject ? '✓' : '✗'}</span> Subject: <b style="color:#60a5fa">${subSys.subject || '---'}</b></div>
                    <div><span style="color: ${val.status.system ? '#34d399' : '#f87171'}">${val.status.system ? '✓' : '✗'}</span> System: <b style="color:#60a5fa">${subSys.system || 'Oculto'}</b></div>
                </div>
            </div>
        `;

        if (cardExistente) {
            statusCard.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Questão #${currentQNumberExt}</span>
                    <span style="font-size: 10px; font-weight: 700; background: rgba(16,185,129,0.2); color: #34d399; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        ● Flashcard Salvo
                    </span>
                </div>
                ${checklistHtml}
                <div style="font-size: 11px; color: #cbd5e1; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #1e293b; margin-bottom: 10px; max-height: 80px; overflow: hidden; text-overflow: ellipsis;">
                    <b>Frente:</b> ${(cardExistente.front || '').replace(/<[^>]+>/g, '').substring(0, 100)}...
                </div>
                <button id="btn-gerar-card" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(37,99,235,0.4);">
                    ⚡ Abrir / Editar no App
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
                ${checklistHtml}

                ${!val.completo ? `
                    <div style="margin-bottom: 10px; padding: 8px 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; font-size: 10px; color: #fca5a5; line-height: 1.4;">
                        ⚠️ <b>Aviso:</b> Responda a questão e clique em "Click to Show" para liberar todos os dados antes de importar.
                    </div>
                ` : ''}

                <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                    ${!val.status.system ? `
                        <button id="btn-revelar-campos" style="flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid #475569; background: #1e293b; color: #38bdf8; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            🔍 Revelar 'Click to Show'
                        </button>
                    ` : ''}
                    <button id="btn-gerar-card" style="flex: 1; padding: 10px 12px; border-radius: 8px; border: none; background: ${val.completo ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : '#334155'}; color: ${val.completo ? '#fff' : '#94a3b8'}; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        ⚡ Criar Flashcard
                    </button>
                </div>
            `;
        }

        const btnRevelar = document.getElementById('btn-revelar-campos');
        if (btnRevelar) {
            btnRevelar.addEventListener('click', () => {
                const count = revelarCamposOcultos();
                mostrarFeedbackDrawer(`🔍 Botões 'Click to Show' acionados (${count}). Atualizando...`);
                setTimeout(() => {
                    atualizarStatusCardQuestaoAtual();
                    autoImportarQuestaoSeNavegou();
                }, 400);
            });
        }

        const btnGerar = document.getElementById('btn-gerar-card');
        if (btnGerar) {
            btnGerar.addEventListener('click', executarGeracaoFlashcard);
        }

        // Renderiza cards sugeridos (AnKing / Criados) para a questão atual
        renderizarCardsSugeridosQuestao(qId);
    });
}

// =========================================================================
// Sincronização e Indexação O(1) de Flashcards por Tags/QID (AnKing & Criados)
// =========================================================================

let cachedExtensionCardsCatalog = [];
let cachedExtensionCardsIndex = new Map(); // QID limpo -> Array de cards
let hasInitializedCardsSync = false;

function extrairQidsDeTag(tag) {
    if (!tag || typeof tag !== 'string') return [];
    const trimmed = tag.trim();
    const found = new Set();

    // 1. Hierarquia AnKing: "##AK_Step2_v12::#UWorld::Step::4911"
    if (trimmed.includes('::')) {
        const segs = trimmed.split('::').map(s => s.trim()).filter(Boolean);
        const lastSeg = segs[segs.length - 1];
        if (/^\d{1,8}$/.test(lastSeg)) {
            found.add(lastSeg);
        }
        for (const seg of segs) {
            const numMatch = seg.match(/(?:qid|uworld|amboss|step)?[:\-_]?\s*(\d{2,8})\b/i);
            if (numMatch && numMatch[1]) {
                found.add(numMatch[1]);
            }
        }
    }

    // 2. Formato de cards criados: "qid:4911", "qid-4911"
    const qidMatch = trimmed.match(/^qid[:\s\-_]+(\d{1,8})$/i);
    if (qidMatch && qidMatch[1]) {
        found.add(qidMatch[1]);
    }

    // 3. Prefixos de plataforma: "uworld:4911", "amboss-12345"
    const platMatch = trimmed.match(/^(?:uworld|amboss|usmle|nbme)[:\-_]+(\d{1,8})$/i);
    if (platMatch && platMatch[1]) {
        found.add(platMatch[1]);
    }

    // 4. Numérico puro: "4911"
    if (/^\d{2,8}$/.test(trimmed)) {
        found.add(trimmed);
    }

    return Array.from(found);
}

function rebuildExtensionCardsIndex(cards) {
    if (!Array.isArray(cards)) return;
    cachedExtensionCardsCatalog = cards;
    cachedExtensionCardsIndex = new Map();

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;
        const qids = new Set();

        if (card.questionId) {
            const clean = card.questionId.toString().replace(/^qid[:\-_]*/i, '').trim();
            if (clean) qids.add(clean);
        }

        if (card.qids && Array.isArray(card.qids)) {
            card.qids.forEach(q => {
                if (q) {
                    const clean = q.toString().replace(/^qid[:\-_]*/i, '').trim();
                    if (clean) qids.add(clean);
                }
            });
        }

        if (card.tags && Array.isArray(card.tags)) {
            for (const tag of card.tags) {
                const extracted = extrairQidsDeTag(tag);
                extracted.forEach(q => qids.add(q));
            }
        }

        qids.forEach(q => {
            if (!cachedExtensionCardsIndex.has(q)) {
                cachedExtensionCardsIndex.set(q, []);
            }
            cachedExtensionCardsIndex.get(q).push(card);
        });
    }
}

function initExtensionCardsSync() {
    if (hasInitializedCardsSync) return;
    hasInitializedCardsSync = true;

    // 1. Carrega do chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['cardblocks_qbank_cards'], (res) => {
            if (res && Array.isArray(res.cardblocks_qbank_cards)) {
                rebuildExtensionCardsIndex(res.cardblocks_qbank_cards);
                renderizarCardsSugeridosQuestao();
            }
        });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.cardblocks_qbank_cards) {
                rebuildExtensionCardsIndex(changes.cardblocks_qbank_cards.newValue || []);
                renderizarCardsSugeridosQuestao();
            }
        });
    }

    // 2. BroadcastChannel para comunicação direta com a aba aberta do CardBlocks
    try {
        const bc = new BroadcastChannel('usmle_flashcards_sync');
        bc.onmessage = (event) => {
            if (!event.data) return;
            if (event.data.type === 'USMLE_CARDS_CATALOG_SYNC' && Array.isArray(event.data.cards)) {
                rebuildExtensionCardsIndex(event.data.cards);
                renderizarCardsSugeridosQuestao();
            }
        };
    } catch (e) {}

    // 3. Busca inicial no servidor local se disponível
    fetch('/api/imported-questions').catch(() => null);
}

initExtensionCardsSync();

async function renderizarCardsSugeridosQuestao(overrideQid) {
    const container = document.getElementById('drawer-suggested-cards-section');
    if (!container) return;

    const rawQid = overrideQid || extrairIdQuestaoAtual();
    const cleanQid = (rawQid || '').toString().replace(/^qid[:\-_]*/i, '').trim();

    if (!cleanQid) {
        container.innerHTML = '';
        return;
    }

    // 1. Busca no índice local de alta performance
    let matching = cachedExtensionCardsIndex.get(cleanQid) || [];

    // 2. Se vazio no índice local, tenta consultar a API do servidor
    if (matching.length === 0) {
        try {
            const res = await fetch(`/api/qbank-matching-cards?qid=${encodeURIComponent(cleanQid)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.cards) && data.cards.length > 0) {
                    matching = data.cards;
                }
            }
        } catch (e) {}
    }

    if (matching.length === 0) {
        container.innerHTML = `
            <div style="padding: 12px; border-radius: 12px; background: rgba(30,41,59,0.5); border: 1px solid #334155; font-size: 11px; color: #94a3b8; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                    <span>🏷️ Nenhum Card AnKing / Criado com Tag #${cleanQid}</span>
                </div>
                <div style="font-size: 10px; color: #64748b;">
                    Ao criar um flashcard para esta questão, ele será vinculado automaticamente a esta QID.
                </div>
            </div>
        `;
        return;
    }

    const now = Date.now();
    const allSuspended = matching.every(c => c.isSuspended);

    let cardsHtml = `
        <div style="padding: 12px; border-radius: 12px; background: #1e293b; border: 1px solid #3b82f6; box-shadow: 0 4px 14px rgba(37,99,235,0.15);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #334155;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 13px;">⚡</span>
                    <span style="font-size: 11px; font-weight: 800; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.5px;">
                        Cards Sugeridos (${matching.length})
                    </span>
                </div>
                <span style="font-size: 10px; font-family: monospace; background: rgba(59,130,246,0.25); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                    QID: ${cleanQid}
                </span>
            </div>

            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 10px; line-height: 1.4;">
                Estes flashcards possuem tags ou associação direta com a questão <b>#${cleanQid}</b> (AnKing / Banco).
            </div>

            ${matching.length > 1 ? `
                <button id="btn-drawer-activate-all" style="width: 100%; margin-bottom: 10px; padding: 8px 10px; border-radius: 8px; border: none; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">
                    ⚡ Ativar Todos (${matching.length}) e Revisar Hoje
                </button>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    matching.forEach((card, idx) => {
        const isSuspended = Boolean(card.isSuspended);
        const isDue = (card.nextReviewDate || 0) <= now && !isSuspended;
        const deckName = card.deckName || 'Baralho';
        const frontSnippet = (card.frontPreview || card.front || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\{\{c\d+::(.*?)\}\}/gi, '[$1]')
            .trim()
            .substring(0, 95);

        let statusBadge = '';
        if (isSuspended) {
            statusBadge = `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(239,68,68,0.2); color: #f87171; font-weight: bold;">Inativo (Suspenso)</span>`;
        } else if (isDue) {
            statusBadge = `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(245,158,11,0.2); color: #fbbf24; font-weight: bold;">Para Revisar Hoje</span>`;
        } else {
            const d = new Date(card.nextReviewDate || Date.now());
            const dStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            statusBadge = `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(16,185,129,0.2); color: #34d399; font-weight: bold;">Agendado (${dStr})</span>`;
        }

        cardsHtml += `
            <div style="background: #0f172a; border: 1px solid ${isSuspended ? '#7f1d1d' : isDue ? '#78350f' : '#1e293b'}; border-radius: 8px; padding: 9px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
                        ${deckName}
                    </span>
                    ${statusBadge}
                </div>

                <div style="font-size: 11px; color: #e2e8f0; line-height: 1.35; font-weight: 500;">
                    ${frontSnippet || 'Flashcard relacionado'}...
                </div>

                <div style="display: flex; gap: 6px; margin-top: 4px;">
                    <button class="btn-card-act-today" data-card-id="${card.id}" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: none; background: #059669; color: #fff; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 4px rgba(5,150,105,0.3);">
                        ⚡ Ativar & Revisar Hoje
                    </button>
                    ${isSuspended ? `
                        <button class="btn-card-unsuspend" data-card-id="${card.id}" style="padding: 6px 8px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; font-size: 10px; font-weight: 600; cursor: pointer;">
                            Ativar
                        </button>
                    ` : `
                        <button class="btn-card-schedule-today" data-card-id="${card.id}" style="padding: 6px 8px; border-radius: 6px; border: 1px solid #3b82f6; background: rgba(59,130,246,0.15); color: #93c5fd; font-size: 10px; font-weight: 600; cursor: pointer;">
                            Revisar Hoje
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    cardsHtml += `
            </div>
        </div>
    `;

    container.innerHTML = cardsHtml;

    // Vincula Eventos
    const btnActivateAll = document.getElementById('btn-drawer-activate-all');
    if (btnActivateAll) {
        btnActivateAll.addEventListener('click', () => {
            matching.forEach(c => executarAcaoCardDrawer(c.id, 'activate_today', cleanQid));
            mostrarFeedbackDrawer(`⚡ Todos os ${matching.length} flashcards foram ativados e agendados para hoje!`);
            setTimeout(() => renderizarCardsSugeridosQuestao(cleanQid), 200);
        });
    }

    container.querySelectorAll('.btn-card-act-today').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = btn.getAttribute('data-card-id');
            executarAcaoCardDrawer(cardId, 'activate_today', cleanQid);
            mostrarFeedbackDrawer('⚡ Flashcard ativado e adicionado à fila de hoje!');
            setTimeout(() => renderizarCardsSugeridosQuestao(cleanQid), 200);
        });
    });

    container.querySelectorAll('.btn-card-unsuspend').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = btn.getAttribute('data-card-id');
            executarAcaoCardDrawer(cardId, 'unsuspend', cleanQid);
            mostrarFeedbackDrawer('🟢 Flashcard ativado!');
            setTimeout(() => renderizarCardsSugeridosQuestao(cleanQid), 200);
        });
    });

    container.querySelectorAll('.btn-card-schedule-today').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = btn.getAttribute('data-card-id');
            executarAcaoCardDrawer(cardId, 'schedule_today', cleanQid);
            mostrarFeedbackDrawer('📅 Flashcard agendado para revisão hoje!');
            setTimeout(() => renderizarCardsSugeridosQuestao(cleanQid), 200);
        });
    });
}

function executarAcaoCardDrawer(cardId, action, qid) {
    if (!cardId) return;

    // 1. Atualização otimista imediata na memória para feedback instantâneo (0ms)
    const card = cachedExtensionCardsCatalog.find(c => c.id === cardId);
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
        rebuildExtensionCardsIndex(cachedExtensionCardsCatalog);
    }

    // 2. BroadcastChannel para a aba do CardBlocks
    try {
        const bc = new BroadcastChannel('usmle_flashcards_sync');
        bc.postMessage({
            type: 'CARD_ACTION',
            payload: { cardId, action, qid }
        });
        setTimeout(() => bc.close(), 1000);
    } catch (e) {}

    // 3. Chamada para a API backend
    fetch('/api/update-card-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action, qid })
    }).catch(() => {});
}

function executarGeracaoFlashcard() {
    const cardData = extrairDadosCompletosQuestao();
    const val = validarDadosCompletosQuestao(cardData);
    if (!val.completo) {
        revelarCamposOcultos();
        setTimeout(() => {
            const reData = extrairDadosCompletosQuestao();
            const reVal = validarDadosCompletosQuestao(reData);
            if (!reVal.completo) {
                const msg = reVal.pendencias.join('<br>• ');
                mostrarToastFlutuante(`⚠️ <b>Dados Incompletos:</b><br><div style="text-align:left;font-size:11px;margin-top:4px;">• ${msg}</div><div style="font-size:10px;margin-top:4px;opacity:0.85;">Responda a questão e clique em "Click to Show" para liberar.</div>`, 'aviso');
                mostrarFeedbackDrawer(`⚠️ Dados incompletos: ${reVal.pendencias[0]}`);
                atualizarStatusCardQuestaoAtual();
            } else {
                despacharDadosParaFlashcards(reData);
                autoImportarQuestaoSeNavegou();
                atualizarStatusCardQuestaoAtual();
            }
        }, 300);
        return;
    }
    despacharDadosParaFlashcards(cardData);
}

// Handshake: Se a janela aberta informar que está pronta para receber os dados
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'USMLE_FLASHCARD_TAB_READY') {
        if (event.source) {
            flashcardWindowRef = event.source;
            const cardData = extrairDadosCompletosQuestao();
            try {
                event.source.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: cardData }, '*');
                mostrarFeedbackDrawer('Sessão conectada! Dados importados com sucesso.');
            } catch (e) {}
        }
    }
});

function navegarQuestaoDrawer(direcao) {
    if (direcao > 0) {
        acionarBotao('next');
        currentQNumberExt++;
    } else if (direcao < 0 && currentQNumberExt > 1) {
        acionarBotao('previous');
        currentQNumberExt--;
    }
    setTimeout(() => {
        atualizarVisibilidadeBotaoQBank();
        atualizarStatusCardQuestaoAtual();
        agendarImportacaoRapida();
    }, 150);
}

// Mecanismo de agendamento ultra-rápido de importação com retentativas
let activeSyncTimers = [];
function agendarImportacaoRapida() {
    activeSyncTimers.forEach(t => clearTimeout(t));
    activeSyncTimers = [];

    const delays = [30, 100, 250, 500, 900, 1500];
    delays.forEach(d => {
        const timer = setTimeout(() => {
            if (isPaginaResolucaoQBank()) {
                revelarCamposOcultos();
                autoImportarQuestaoSeNavegou();
                if (typeof atualizarStatusCardQuestaoAtual === 'function') {
                    atualizarStatusCardQuestaoAtual();
                }
            }
        }, d);
        activeSyncTimers.push(timer);
    });
}

function verificarMudancaEstadoQuestao() {
    if (!isPaginaResolucaoQBank()) return;
    const qData = detectarDadosQuestaoQBank();
    if (!qData.qId && !qData.questionIndex) return;

    if (qData.qId && qData.qId !== lastImportedQId) {
        agendarImportacaoRapida();
    }

    const qChanged = qData.qId !== lastDetectedQId || (qData.questionIndex && qData.questionIndex !== lastDetectedQIndex);
    const phaseChanged = qData.phase !== lastDetectedPhase;

    if (qChanged || phaseChanged) {
        const isFirst = lastDetectedQId === null && lastDetectedQIndex === null;
        lastDetectedQId = qData.qId;
        lastDetectedQIndex = qData.questionIndex;
        lastDetectedPhase = qData.phase;

        if (qData.questionIndex) {
            currentQNumberExt = qData.questionIndex;
        }

        if (!isFirst) {
            const now = Date.now();
            if (now - pacerLastTrigger > 350) {
                pacerLastTrigger = now;
                const actionId = `pacer-sync-${now}-${Math.random().toString(36).substring(2, 7)}`;
                const payload = {
                    type: "PACER_SYNC_STATE",
                    actionId: actionId,
                    id: actionId,
                    questionIndex: qData.questionIndex,
                    totalQuestions: qData.totalQuestions,
                    phase: qData.phase,
                    qId: qData.qId,
                    ts: now
                };

                if (pacerWindow && !pacerWindow.closed) {
                    try { pacerWindow.postMessage(payload, "*"); } catch(e) {}
                }
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ pacer_action: payload });
                }
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        type: 'DISPATCH_PACER_ACTION',
                        action: payload
                    }, () => {});
                }
            }
        }
    }
}

// Monitoramento contínuo da página de resolução e navegação
setInterval(() => {
    atualizarVisibilidadeBotaoQBank();
    if (isPaginaResolucaoQBank()) {
        verificarMudancaEstadoQuestao();
    }
}, 400);

// Observador de mutações no DOM para capturar imediatamente mudanças de questão
try {
    const domObserver = new MutationObserver(() => {
        if (!isPaginaResolucaoQBank()) return;
        verificarMudancaEstadoQuestao();
    });

    if (document.body) {
        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            domObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false
            });
        });
    }
} catch(e) {}

// Listeners de clique e teclado para navegação veloz (Next, Prev, números 1..10, setas)
document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const isNavElement = target.closest('button[title*="Next" i], button[title*="Previous" i], button[aria-label*="Next" i], button[aria-label*="Previous" i], button, a, li[tabindex], [class*="cursor-pointer"]');
    if (isNavElement && isPaginaResolucaoQBank()) {
        agendarImportacaoRapida();
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (!isPaginaResolucaoQBank()) return;
    
    // Ignora quando digitando em inputs, textareas ou contenteditable
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

    if (e.key === 'ArrowRight' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        notificarPacer(true, false, false);
        agendarImportacaoRapida();
    } else if (e.key === 'ArrowLeft' || (e.altKey && (e.key === 'p' || e.key === 'P'))) {
        notificarPacer(false, false, true);
        agendarImportacaoRapida();
    } else if (e.key === 'Enter' || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        notificarPacer(false, true, false);
        agendarImportacaoRapida();
    } else if (e.key === 'n' || e.key === 'p') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key === 'n') notificarPacer(true, false, false);
            if (e.key === 'p') notificarPacer(false, false, true);
            agendarImportacaoRapida();
        }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.altKey) {
        agendarImportacaoRapida();
    }
}, true);

window.addEventListener('DOMContentLoaded', () => {
    criarBarraUI();
    criarFlashcardUI();
    atualizarVisibilidadeBotaoQBank();
});
if (document.body) {
    criarFlashcardUI();
    atualizarVisibilidadeBotaoQBank();
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

// --- Funções de Extração Inteligente por Blocos, Imagens, Highlights e Tabelas ---
function limparEFormatarTabelaHtml(tableEl) {
    if (!tableEl) return '';
    const clone = tableEl.cloneNode(true);
    clone.querySelectorAll('script, style, button, [role="button"]').forEach(el => {
        const img = el.querySelector('img');
        if (img) el.replaceWith(img);
        else el.remove();
    });
    clone.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src;
        if (src) {
            try { img.src = new URL(src, window.location.href).href; } catch(e){}
        }
        img.removeAttribute('style');
        img.className = 'max-h-72 max-w-full rounded-lg my-2 object-contain mx-auto block';
    });
    clone.className = 'qbank-imported-table border-collapse w-full my-3 text-xs sm:text-sm border border-gray-300 dark:border-gray-700';
    clone.querySelectorAll('th, td').forEach(cell => {
        cell.className = 'border border-gray-300 dark:border-gray-700 p-2 text-left';
    });
    clone.querySelectorAll('th').forEach(th => {
        th.className += ' font-bold bg-gray-100 dark:bg-gray-800';
    });
    return clone.outerHTML;
}

// Limpa e normaliza o HTML preservando imagens, tabelas e trechos com highlight
function limparEFormatarConteudoHtml(containerEl) {
    if (!containerEl) return '';
    const clone = containerEl.cloneNode(true);

    // 1. Remove scripts, styles, toolbars de highlight que NÃO contêm imagens
    clone.querySelectorAll('script, style, .markBtnContainer, [aria-label*="Clear highlights" i], [class*="Clear highlights" i]').forEach(el => el.remove());
    
    // 2. Trata botões / links / containers de ampliar imagem (desembrulha a imagem para não perder na remoção)
    clone.querySelectorAll('button, a, div[role="button"], span[role="button"], figure, div[class*="aspect-square"]').forEach(btn => {
        const imgs = Array.from(btn.querySelectorAll('img'));
        if (imgs.length > 0) {
            const fragment = document.createDocumentFragment();
            imgs.forEach(im => fragment.appendChild(im));
            btn.replaceWith(fragment);
        } else {
            const btnText = (btn.innerText || '').trim().toLowerCase();
            if (btnText.includes('clear highlights') || btnText.includes('mark question') || btnText.includes('exhibit')) {
                btn.remove();
            }
        }
    });

    // 3. Converte todas as imagens para URLs absolutas e aplica estilização responsiva
    clone.querySelectorAll('img').forEach(img => {
        const rawSrc = img.getAttribute('src') || 
                       img.getAttribute('data-src') || 
                       img.getAttribute('data-zoom-src') || 
                       img.getAttribute('data-original-src') || 
                       img.getAttribute('data-highres-src') || 
                       img.src;
        if (rawSrc) {
            try {
                img.src = new URL(rawSrc, window.location.href).href;
            } catch(e) {
                img.src = rawSrc;
            }
        }
        img.removeAttribute('srcset');
        img.removeAttribute('style');
        img.removeAttribute('loading');
        img.className = 'max-h-96 max-w-full rounded-xl my-3 shadow-xs border border-gray-200 dark:border-gray-700 object-contain mx-auto block cursor-pointer';
    });

    // 4. Converte links para imagens em tags <img> nativas
    clone.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        const isImgLink = /\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?$/i.test(href) ||
                          href.includes('/media/') ||
                          href.includes('/images/') ||
                          href.includes('/webi/');
        if (isImgLink && !a.querySelector('img')) {
            try {
                const absSrc = new URL(href, window.location.href).href;
                const img = document.createElement('img');
                img.src = absSrc;
                img.className = 'max-h-96 max-w-full rounded-xl my-3 shadow-xs border border-gray-200 dark:border-gray-700 object-contain mx-auto block cursor-pointer';
                a.replaceWith(img);
            } catch(e) {}
        }
    });

    // 5. Converte e normaliza todas as variações de trechos com Highlight (<mark>, spans com classes ou inline styles)
    const highlightElements = clone.querySelectorAll('mark, [class*="highlight" i], [class*="bg-yellow" i], [class*="bg-amber" i], [data-highlight], span[style*="background"]');
    highlightElements.forEach(hlEl => {
        hlEl.className = 'qbank-highlight bg-amber-200 dark:bg-amber-400/40 text-gray-900 dark:text-gray-100 px-1 py-0.5 rounded font-medium shadow-xs';
        hlEl.style.backgroundColor = '#fef08a';
        hlEl.style.color = '#111827';
        hlEl.style.borderRadius = '3px';
        hlEl.style.padding = '1px 3px';
    });

    // 6. Formata tabelas internas
    clone.querySelectorAll('table').forEach(tbl => {
        const tblHtml = limparEFormatarTabelaHtml(tbl);
        if (tblHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = tblHtml;
            tbl.replaceWith(tempDiv.firstElementChild || tbl);
        }
    });

    return clone.innerHTML.trim();
}

function getBlocosDeTexto(container) {
    const itens = [];
    if (!container) return itens;

    const formattedFull = limparEFormatarConteudoHtml(container);
    if (formattedFull && formattedFull.length > 0) {
        itens.push({ text: formattedFull, node: container });
        return itens;
    }

    const tables = container.querySelectorAll('table');
    if (tables.length > 0) {
        tables.forEach(tbl => {
            const tableHtml = limparEFormatarTabelaHtml(tbl);
            if (tableHtml) itens.push({ text: tableHtml, node: tbl });
        });
    }

    const blocos = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');
    blocos.forEach(b => {
        if (b.closest('table')) return;
        const hasBlockChildren = Array.from(b.children).some(child => ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(child.tagName));
        if (!hasBlockChildren && b.innerText.trim().length > 0) itens.push({ text: b.innerHTML.trim() || b.innerText, node: b });
    });

    if (itens.length === 0 && container.innerText.trim().length > 0) {
        itens.push({ text: container.innerHTML.trim() || container.innerText, node: container });
    }
    return itens;
}

function extrairEnunciadoParaFila() {
    // 1. Tenta seletores diretos de enunciados de Q-Banks
    const seletoresStem = [
        '.max-w-5xl div.\\!text-ink',
        '[class*="questionBody"]',
        '#questionBody',
        '.question-stem',
        '.q-stem',
        '.stem',
        'div[id*="qStem"]',
        'div[class*="question-content"]',
        'div[data-testid="question-stem"]',
        'article.question',
        '.case-study'
    ];
    for (let sel of seletoresStem) {
        try {
            const el = document.querySelector(sel);
            if (el && ((el.innerText && el.innerText.trim().length > 20) || el.querySelector('img, table'))) {
                const formattedHtml = limparEFormatarConteudoHtml(el);
                if (formattedHtml && formattedHtml.length > 15) {
                    return [{ text: formattedHtml, node: el }];
                }
            }
        } catch(e) {}
    }

    // 2. Fallback inteligente para UWorld real (parágrafos clínicos antes das opções)
    const elements = Array.from(document.querySelectorAll('p, div'));
    const blocosStem = [];
    for (let el of elements) {
        const txt = (el.innerText || '').trim();
        const hasImg = Boolean(el.querySelector('img'));
        if ((txt.length > 40 || hasImg) && !txt.includes('Clear highlights') && !txt.includes('Mark Question') && !txt.includes('Item ') && !txt.includes('Question Id:')) {
            const hasChoiceHeader = /(?:Options|Alternativas|Educational objective)/i.test(txt);
            if (!hasChoiceHeader && !el.querySelector('table.choices, tr, input[type="radio"]')) {
                const jaAdicionado = blocosStem.some(b => b.node && (b.node.contains(el) || el.contains(b.node)));
                if (!jaAdicionado) {
                    const formatted = limparEFormatarConteudoHtml(el);
                    blocosStem.push({ text: formatted || txt, node: el });
                }
            }
        }
    }
    if (blocosStem.length > 0) return blocosStem;

    return [{ text: "Texto do enunciado não identificado.", node: null }];
}

function extrairAlternativasDetalhadas() {
    const list = [];
    
    // 0. Procura banner superior de resultado da questão (role="alert")
    let explicitCorrectFromBanner = '';
    let isQuestionMarkedCorrectOnPage = false;
    let isQuestionMarkedIncorrectOnPage = false;

    const alertElements = Array.from(document.querySelectorAll('div[role="alert"], [class*="border-l-red"], [class*="border-l-green"]'));
    alertElements.forEach(alertEl => {
        const textAlert = (alertEl.innerText || alertEl.textContent || '').trim();
        if (/Incorrect/i.test(textAlert)) isQuestionMarkedIncorrectOnPage = true;
        if (/^Correct|\bCorrect\b/i.test(textAlert) && !/Incorrect/i.test(textAlert)) isQuestionMarkedCorrectOnPage = true;

        const matchCorrect = textAlert.match(/Correct\s*answer\s*[:\n\s]*([A-H])/i);
        if (matchCorrect && matchCorrect[1]) {
            explicitCorrectFromBanner = matchCorrect[1].toUpperCase();
        }
    });

    // 1. Tabela de alternativas do Q-Bank
    const parentTable = document.querySelector('table tbody, table.choices, table:has(tr .lucide-check), table:has(tr [role="radio"])');
    let tableHeaders = [];
    if (parentTable) {
        const headerRow = parentTable.querySelector('thead tr, tr:first-child:has(th), tr:first-child:has(td.font-bold)');
        if (headerRow) {
            const ths = Array.from(headerRow.querySelectorAll('th, td')).map(t => (t.innerText || '').trim());
            const filteredThs = ths.filter(t => t && !/^[A-H][\.\)]?$/i.test(t) && !/^\(?\d+%\)?$/.test(t));
            if (filteredThs.length > 1) {
                tableHeaders = filteredThs;
            }
        }
    }

    const linhas = Array.from(document.querySelectorAll('table tbody tr, table.choices tr, tr[class*="flex items-start"], .choice-row, [class*="alternative"]'));
    
    const validRows = linhas.filter(tr => {
        const txt = (tr.innerText || '').trim();
        return /^[A-H][\.\)]|^\s*[A-H]\s*[\.\)]/m.test(txt) || tr.querySelector('[role="radio"], input[type="radio"], .lucide-check, .lucide-x');
    });

    if (validRows.length > 0) {
        validRows.forEach((tr, idx) => {
            // A. Detectar letra
            let letter = String.fromCharCode(65 + idx);
            const letterEl = tr.querySelector('td:first-child span, [class*="font-normal"], b, strong');
            const rowText = tr.innerText || '';
            const letterMatch = rowText.match(/^([A-H])[\.\)]/m) || (letterEl ? letterEl.innerText.match(/([A-H])[\.\)]?/i) : null);
            if (letterMatch && letterMatch[1]) {
                letter = letterMatch[1].toUpperCase();
            }

            // B. Detectar texto e colunas da alternativa
            let text = '';
            
            const allTds = Array.from(tr.querySelectorAll('td, [class*="w-full"]'));
            const contentCells = [];
            allTds.forEach((cell, cellIdx) => {
                const cellTxt = (cell.innerText || '').trim();
                const isRadioOrLetter = cell.querySelector('[role="radio"], input[type="radio"]') || (/^[A-H][\.\)]?$/i.test(cellTxt) && cellIdx === 0);
                const isPercentage = /^\(?\d+%\)?$/.test(cellTxt);
                if (!isRadioOrLetter && !isPercentage && cellTxt.length > 0) {
                    contentCells.push(cell);
                }
            });

            // Se tem imagens na alternativa
            const imgEl = tr.querySelector('img');
            let imgHtml = '';
            if (imgEl && imgEl.src) {
                try {
                    const absSrc = new URL(imgEl.getAttribute('src') || imgEl.src, window.location.href).href;
                    imgHtml = `<img src="${absSrc}" alt="Alternative image" class="max-h-48 max-w-full rounded-lg my-1 inline-block" />`;
                } catch(e) {}
            }

            if (contentCells.length > 1 && tableHeaders.length === contentCells.length) {
                const parts = contentCells.map((c, i) => {
                    const h = tableHeaders[i] || `Col ${i+1}`;
                    const val = (c.innerText || '').trim();
                    return `${h}: ${val}`;
                });
                text = parts.join('  |  ');
            } else if (contentCells.length > 1) {
                const parts = contentCells.map(c => (c.innerText || '').trim());
                text = parts.join('  |  ');
            } else if (contentCells.length === 1) {
                const clone = contentCells[0].cloneNode(true);
                clone.querySelectorAll('span').forEach(s => {
                    if (/^\s*\(\d+%\)\s*$/.test(s.innerText || '')) s.remove();
                });
                text = (clone.innerText || clone.textContent || '').replace(/\s*\(\d+%\)\s*$/, '').trim();
            }

            if (imgHtml) {
                text = text ? `${text}\n${imgHtml}` : imgHtml;
            }

            if (!text) {
                text = rowText
                    .replace(/^[A-H][\.\)]\s*/im, '')
                    .replace(/\(\d+%\)/g, '')
                    .replace(/\n+/g, ' ')
                    .trim();
            }

            // C. Detectar se é a alternativa correta
            let isCorrect = false;

            if (explicitCorrectFromBanner && letter === explicitCorrectFromBanner) {
                isCorrect = true;
            }

            if (!isCorrect) {
                const checkSvg = tr.querySelector('svg.lucide-check, svg[class*="text-green"], svg[class*="fill-green"], svg[class*="text-emerald"], path[d*="M20 6 9 17l-5-5"], path[d*="M10.97 4.97"]');
                if (checkSvg) isCorrect = true;
            }

            if (!isCorrect) {
                const hasGreenClass = Array.from(tr.querySelectorAll('*')).some(el => {
                    const cls = (el.className || '').toString();
                    return cls.includes('text-green') || cls.includes('bg-green') || cls.includes('text-emerald') || cls.includes('bg-emerald');
                });
                if (hasGreenClass && (tr.querySelector('.lucide-check') || tr.innerHTML.includes('M20 6 9 17l-5-5') || tr.innerHTML.includes('M10.97 4.97'))) {
                    isCorrect = true;
                }
            }

            if (!isCorrect && isQuestionMarkedCorrectOnPage && !isQuestionMarkedIncorrectOnPage) {
                const isSelectedRadio = tr.querySelector('[role="radio"][aria-checked="true"], input[type="radio"]:checked, [class*="bg-[#004976]"], [class*="bg-blue"]');
                if (isSelectedRadio) {
                    isCorrect = true;
                }
            }

            if (!isCorrect && (rowText.includes('✓') || rowText.includes('✔'))) {
                isCorrect = true;
            }

            if (text && text.length > 0) {
                list.push({
                    id: `alt-${idx + 1}`,
                    letter,
                    text,
                    isCorrect
                });
            }
        });
    }

    // Fallback: Se não encontrou linhas na tabela, busca por parágrafos/divs com "A. ", "B. "
    if (list.length === 0) {
        const elementsWithChoices = Array.from(document.querySelectorAll('div, p, li'));
        const matched = [];
        elementsWithChoices.forEach(el => {
            if (el.children.length <= 1) {
                const txt = (el.innerText || '').trim();
                const m = txt.match(/^([A-H])[\.\)]\s+(.*)$/);
                if (m && txt.length < 350) {
                    const cleanText = m[2].replace(/\s*\(\d+%\)\s*$/, '').trim();
                    const letter = m[1].toUpperCase();
                    let isCorr = false;
                    if (explicitCorrectFromBanner && letter === explicitCorrectFromBanner) {
                        isCorr = true;
                    } else if (el.querySelector('svg[class*="green"], .lucide-check') !== null || el.classList.contains('correct')) {
                        isCorr = true;
                    }
                    if (!matched.some(c => c.letter === letter)) {
                        matched.push({
                            id: `alt-${matched.length + 1}`,
                            letter,
                            text: cleanText,
                            isCorrect: isCorr
                        });
                    }
                }
            }
        });
        if (matched.length > 0) return matched;
    }

    // Se nenhuma foi marcada como correta ainda, analisa a explicação
    if (list.length > 0 && !list.some(a => a.isCorrect)) {
        const bodyText = document.body ? document.body.innerText : '';
        const explicitMatch = bodyText.match(/(?:The\s+correct\s+(?:answer|choice|option)\s+is|correct\s+answer\s*[:\s]+)\s*\(?([A-H])\)?/i);
        if (explicitMatch && explicitMatch[1]) {
            const corr = explicitMatch[1].toUpperCase();
            const target = list.find(a => a.letter === corr);
            if (target) target.isCorrect = true;
        } else {
            const incorrectChoicesSet = new Set();
            const choiceRegex = /\((?:Choices?|Options?)\s+([A-H](?:\s*(?:and|or|,)\s*[A-H])*)\)/gi;
            let match;
            while ((match = choiceRegex.exec(bodyText)) !== null) {
                const lettersFound = match[1].match(/[A-H]/gi);
                if (lettersFound) {
                    lettersFound.forEach(l => incorrectChoicesSet.add(l.toUpperCase()));
                }
            }
            if (incorrectChoicesSet.size > 0 && incorrectChoicesSet.size < list.length) {
                const remaining = list.filter(a => !incorrectChoicesSet.has(a.letter));
                if (remaining.length === 1) {
                    remaining[0].isCorrect = true;
                }
            }
        }
    }

    return list;
}

function extrairAlternativasParaFila() {
    const detailed = extrairAlternativasDetalhadas();
    if (detailed.length > 0) {
        return [
            { text: "Options:", node: null },
            ...detailed.map(d => ({ text: `${d.letter}. ${d.text}`, node: null }))
        ];
    }

    return [{ text: "Options not found.", node: null }];
}

// Localiza estritamente o cabeçalho do Educational Objective
function encontrarCabecalhoObjetivo() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, [class*="header"]'));
    const directHeading = headings.find(h => {
        const txt = (h.textContent || '').trim();
        return /(?:Educational\s*objective|Key\s*point|Take-home)/i.test(txt) && txt.length < 80;
    });
    if (directHeading) return directHeading;

    const all = Array.from(document.querySelectorAll('*'));
    return all.find(el => {
        const txt = (el.textContent || '').trim();
        return /(?:Educational\s*objective|Key\s*point|Take-home)/i.test(txt) && txt.length < 60 && el.children.length <= 2;
    }) || null;
}

function obterContainerExplicacao() {
    // 1. Seletores diretos por classe ou atributo do container de explicação
    const direct = document.querySelector('.explanation, [class*="explanation" i], [id*="explanation" i], [data-testid*="explanation" i]');
    if (direct) return direct;

    // 2. Tab ou texto "Explanation"
    const expTab = Array.from(document.querySelectorAll('span, li, button, h2, h3, h4, div')).find(el => 
        /^\s*Explanation\s*$/i.test((el.textContent || '').trim())
    );
    if (expTab) {
        const section = expTab.closest('div.mt-8, div[class*="mt-"], div[class*="pt-"], main, article, section') || expTab.parentElement;
        if (section) return section;
    }

    // 3. Fallback antes do Educational objective
    const objHeader = encontrarCabecalhoObjetivo();
    if (objHeader && objHeader.parentElement) {
        return objHeader.parentElement.closest('div.mt-8, div[class*="pt-5"], main, article, section') || objHeader.parentElement;
    }

    return document.body;
}

function extrairExplicacaoParaFila() {
    const objHeader = encontrarCabecalhoObjetivo();
    const expContainer = obterContainerExplicacao();
    const itens = [];
    const processedNodes = new Set();

    // Procura elementos de bloco e imagens dentro do container em ordem natural do DOM
    const allElements = Array.from(expContainer.querySelectorAll('p, table, figure, img, ul, ol, div:has(> img), div:has(> button > img), div:has(> figure), h1, h2, h3, h4, h5, h6, blockquote'));

    for (let el of allElements) {
        if (processedNodes.has(el)) continue;

        // Se o elemento está dentro de uma tabela já processada
        if (el.closest('table') && el.tagName !== 'TABLE') continue;

        // Se o elemento é/está após o Educational Objective
        if (objHeader) {
            if (objHeader === el || objHeader.contains(el)) break;
            if (objHeader.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) break;
        }

        // Ignora botões de toolbar, marcações, e rodapés de metadados
        if (el.closest('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)\s*:/i.test(el.innerText || '')) {
            continue;
        }

        // Se for tabela
        if (el.tagName === 'TABLE') {
            const tableHtml = limparEFormatarTabelaHtml(el);
            if (tableHtml) {
                itens.push({ text: tableHtml, node: el });
                processedNodes.add(el);
                el.querySelectorAll('*').forEach(c => processedNodes.add(c));
            }
            continue;
        }

        // Se tiver imagem (seja tag <img> direta ou contida no elemento)
        const hasImg = el.tagName === 'IMG' || Boolean(el.querySelector('img'));
        if (hasImg) {
            const formatted = limparEFormatarConteudoHtml(el);
            if (formatted && formatted.length > 0) {
                itens.push({ text: formatted, node: el });
                processedNodes.add(el);
                el.querySelectorAll('*').forEach(c => processedNodes.add(c));
                continue;
            }
        }

        // Se for parágrafo ou bloco de texto
        const rawText = (el.innerText || '').trim();
        if (rawText.length > 3 && !/(?:Clear highlights|Mark Question|Educational\s*Objective)/i.test(rawText)) {
            // Evita adicionar nó filho se o pai já foi adicionado
            const isChildOfProcessed = Array.from(processedNodes).some(p => p.contains(el));
            if (!isChildOfProcessed) {
                const formatted = limparEFormatarConteudoHtml(el);
                if (formatted) {
                    itens.push({ text: formatted, node: el });
                    processedNodes.add(el);
                    el.querySelectorAll('*').forEach(c => processedNodes.add(c));
                }
            }
        }
    }

    // Fallback: Se não encontrou blocos individuais, formata o container inteiro
    if (itens.length === 0 && expContainer && expContainer !== document.body) {
        const fullFormatted = limparEFormatarConteudoHtml(expContainer);
        if (fullFormatted && fullFormatted.length > 20) {
            itens.push({ text: fullFormatted, node: expContainer });
        }
    }

    return itens.length > 0 ? itens : [{ text: "Explanation not found.", node: null }];
}

function extrairObjetivoParaFila() {
    const objHeader = encontrarCabecalhoObjetivo();
    if (!objHeader) return [{ text: "Educational objective not found.", node: null }];

    const itens = [];
    let next = objHeader.nextElementSibling;
    while (next) {
        if (next.querySelector('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)\s*:/i.test(next.innerText || '')) {
            break;
        }
        const hasImg = next.tagName === 'IMG' || Boolean(next.querySelector('img'));
        const txt = (next.innerText || '').trim();
        if (txt.length > 3 || hasImg) {
            const formatted = limparEFormatarConteudoHtml(next);
            itens.push({ text: formatted || txt, node: next });
        }
        next = next.nextElementSibling;
    }

    if (itens.length === 0) {
        const expContainer = obterContainerExplicacao();
        const allP = Array.from(expContainer.querySelectorAll('p, figure, div:has(> img)'));
        for (let p of allP) {
            if (objHeader === p || objHeader.contains(p)) continue;
            if (objHeader.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) {
                if (p.closest('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)/i.test(p.innerText || '')) break;
                const hasImg = p.tagName === 'IMG' || Boolean(p.querySelector('img'));
                const txt = (p.innerText || '').trim();
                if (txt.length > 3 || hasImg) {
                    const formatted = limparEFormatarConteudoHtml(p);
                    itens.push({ text: formatted || txt, node: p });
                }
            }
        }
    }

    return itens.length > 0 ? itens : [{ text: "Educational objective not found.", node: null }];
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
        const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
        const ariaDesc = (btn.getAttribute("aria-description") || "").toLowerCase();
        const testId = (btn.getAttribute("data-testid") || btn.getAttribute("data-cy") || "").toLowerCase();
        const dataAction = (btn.getAttribute("data-action") || "").toLowerCase();
        const btnId = (btn.getAttribute("id") || "").toLowerCase();
        const svgTitle = (btn.querySelector("title")?.textContent || "").toLowerCase();
        const svgAria = (btn.querySelector("svg")?.getAttribute("aria-label") || "").toLowerCase();

        const combined = `${title} ${text} ${cls} ${val} ${ariaLabel} ${ariaDesc} ${testId} ${dataAction} ${btnId} ${svgTitle} ${svgAria}`;

        const isNext = combined.includes("next") || combined.includes("próxim") || combined.includes("proxim") || combined.includes("forward");
        const isSubmit = combined.includes("submit") || combined.includes("enviar") || combined.includes("confirm") || combined.includes("responder") || combined.includes("check answer");
        const isPrev = combined.includes("prev") || combined.includes("anterior") || combined.includes("backward") || combined.includes("back");

        if (isNext || isSubmit || isPrev) {
            notificarPacer(isNext, isSubmit, isPrev);
            if (isNext) currentQNumberExt++;
            else if (isPrev && currentQNumberExt > 1) currentQNumberExt--;
            setTimeout(() => {
                if (typeof atualizarStatusCardQuestaoAtual === 'function') {
                    atualizarStatusCardQuestaoAtual();
                }
                if (typeof autoImportarQuestaoSeNavegou === 'function') {
                    autoImportarQuestaoSeNavegou();
                }
            }, 600);
        }
    }

    // Navegação via clique direto na lista / grid de questões (ex: botão Q1, Q2, etc.)
    const qNumberItem = e.target.closest('[data-question-index], [data-q-index], .question-number, .q-item, button[class*="question-nav"], [class*="item-number"]');
    if (qNumberItem && isPaginaResolucaoQBank()) {
        const numText = (qNumberItem.innerText || qNumberItem.textContent || '').replace(/\D/g, '');
        const targetQ = numText ? parseInt(numText, 10) : null;
        notificarPacer(false, false, false, targetQ);
    }

    // Detecção universal de navegação não-sequencial por barra lateral / lista de questões
    setTimeout(() => {
        if (typeof autoImportarQuestaoSeNavegou === 'function') {
            autoImportarQuestaoSeNavegou();
        }
        if (typeof atualizarStatusCardQuestaoAtual === 'function') {
            atualizarStatusCardQuestaoAtual();
        }
    }, 700);

    // 2. Auto-Read
    if (configAtual.autoRead) {
        const btnNav = e.target.closest('button[title*="Next" i], button[title*="Previous" i], button[aria-label*="Next" i], button[aria-label*="Previous" i]');
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

// --- Mensagens do Popup da Extensão e do Background Worker ---
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
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

    // Ponte para entrega direta na aba de Flashcards
    if (request.type === 'USMLE_GENERATE_FLASHCARD') {
        const payload = request.payload || request.cardData || request;
        window.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: payload }, '*');
        window.dispatchEvent(new CustomEvent('usmle_generate_flashcard', { detail: payload }));
        try {
            const bc = new BroadcastChannel('usmle_flashcards_sync');
            bc.postMessage({ type: 'USMLE_GENERATE_FLASHCARD', payload: payload });
            setTimeout(() => bc.close(), 1000);
        } catch(e) {}
        sendResponse({ success: true, delivered: true });
        return true;
    }
});

// Auto-registro da URL da aplicação quando o usuário estiver navegando nela
try {
    const isAppPage = window.location.pathname.includes('/flashcards') || 
                      document.title.includes('USMLE') || 
                      document.title.includes('CardBlocks') ||
                      document.title.includes('Study Tools');
    if (isAppPage && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
            last_connected_app_url: window.location.origin + '/flashcards?tab=browse&action=create_card'
        });
    }
} catch(e) {}
