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

// Extração dos novos campos: Subject e System
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
                subject = (next.getAttribute('title') || next.innerText || next.textContent || '').trim();
            }
        }
        
        if (!system && /^System$/i.test(txt)) {
            const next = el.nextElementSibling || (el.parentElement ? el.parentElement.querySelector('button, span:nth-child(2), [title], [class*="semibold"]') : null);
            if (next && next !== el) {
                system = (next.getAttribute('title') || next.innerText || next.textContent || '').trim();
            }
        }
    }

    // 2. Fallbacks com seletores conhecidos
    if (!subject) {
        const subEl = document.querySelector('[data-subject], .subject-name, [class*="subject"]');
        if (subEl) subject = subEl.getAttribute('title') || subEl.innerText.trim();
    }
    if (!system) {
        const sysEl = document.querySelector('[data-system], .system-name, [class*="system"]');
        if (sysEl) system = sysEl.getAttribute('title') || sysEl.innerText.trim();
    }

    // 3. Fallback por regex no body text
    const bodyText = document.body ? document.body.innerText : '';
    if (!subject) {
        const matchSub = bodyText.match(/Subject\s*[\n\r:]+\s*([^\n\r<|]{2,60})/i);
        if (matchSub && matchSub[1]) subject = matchSub[1].trim();
    }
    if (!system) {
        const matchSys = bodyText.match(/System\s*[\n\r:]+\s*([^\n\r<|]{2,80})/i);
        if (matchSys && matchSys[1]) system = matchSys[1].trim();
    }

    return { subject, system };
}

// Extração de imagens presentes na explicação ou em links no texto
function extrairTodasImagensQuestao() {
    const imagesSet = new Set();
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src;
        if (!src || src.includes('data:image/svg')) return;

        const isMedicalImage = src.includes('/media/') || 
                               src.includes('/webi/') ||
                               src.includes('qbankly.app') || 
                               src.includes('uworld') || 
                               src.includes('amboss') ||
                               src.includes('Thumbnail') || 
                               img.alt?.includes('Thumbnail') ||
                               img.closest('button[aria-label*="Enlarge"]') ||
                               img.closest('div[class*="aspect-square"]') ||
                               (img.width > 60 || img.height > 60);

        if (isMedicalImage && !src.includes('favicon') && !src.includes('avatar') && !src.includes('logo')) {
            try {
                const absUrl = new URL(src, window.location.href).href;
                imagesSet.add(absUrl);
            } catch(e) {
                imagesSet.add(src);
            }
        }
    });

    // Links <a> apontando para imagens ao longo do texto da explicação
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
    const choicesArr = extrairAlternativasParaFila();
    const questionChoices = choicesArr.filter(i => i.text !== 'Options:').map(i => i.text).join('\n');
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
}

// Auto-importação durante a navegação pelas questões:
// Cada questão pela qual o usuário passar é importada para o repositório de questões do banco selecionado
function autoImportarQuestaoSeNavegou() {
    if (!isPaginaResolucaoQBank()) return;
    const currentQId = extrairIdQuestaoAtual();
    if (!currentQId || currentQId === lastImportedQId) return;

    lastImportedQId = currentQId;
    const cardData = extrairDadosCompletosQuestao();

    // Obtém o banco de destino configurado pelo usuário no popup
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['target_qbank_name', 'auto_sync_all_questions'], (res) => {
            const targetBank = res.target_qbank_name || 'UWorld Step 1';
            cardData.bankName = targetBank;
            cardData.targetBankName = targetBank;

            // 1. Despacha para o repositório de Questões
            try {
                const qbSync = new BroadcastChannel('usmle_qbank_sync');
                qbSync.postMessage({
                    type: 'QBANK_QUESTION_SYNC',
                    question: cardData,
                    bankName: targetBank,
                    qid: currentQId,
                    timestamp: Date.now()
                });
                setTimeout(() => qbSync.close(), 1200);
            } catch(e) {}

            // 2. Despacha para o editor de Flashcards (sem salvar card vazio)
            despacharDadosParaFlashcards(cardData);
        });
    } else {
        despacharDadosParaFlashcards(cardData);
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

        const subSys = extrairSubjectESystem();
        const detectedFieldsHtml = `
            <div style="margin-top: 8px; margin-bottom: 8px; padding: 8px 10px; background: rgba(15,23,42,0.8); border-radius: 8px; border: 1px solid #334155; font-size: 10px; line-height: 1.5; color: #94a3b8;">
                <div><b style="color: #cbd5e1;">Subject:</b> <span style="color: #60a5fa;">${subSys.subject || 'Detectando...'}</span></div>
                <div><b style="color: #cbd5e1;">System:</b> <span style="color: #60a5fa;">${subSys.system || 'Detectando...'}</span></div>
                <div><b style="color: #cbd5e1;">Q ID:</b> <span style="color: #34d399;">${qId}</span></div>
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
                ${detectedFieldsHtml}
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
                ${detectedFieldsHtml}
                <p style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin: 0 0 10px 0;">
                    Nenhum flashcard criado ainda para esta questão.
                </p>
                <button id="btn-gerar-card" style="width: 100%; padding: 10px 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                    ⚡ Criar Flashcard da Questão
                </button>
                <div style="margin-top: 8px; font-size: 10px; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(251,191,36,0.2);">
                    ℹ️ <b>Proteção Automática:</b> O flashcard só será salvo se você preencher frente e verso manualmente. Ao navegar, rascunhos incompletos são descartados.
                </div>
            `;
        }

        const btnGerar = document.getElementById('btn-gerar-card');
        if (btnGerar) {
            btnGerar.addEventListener('click', executarGeracaoFlashcard);
        }
    });
}

function executarGeracaoFlashcard() {
    const cardData = extrairDadosCompletosQuestao();
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
        autoImportarQuestaoSeNavegou();
    }, 600);
}

// Monitoramento contínuo da página de resolução e navegação
setInterval(() => {
    atualizarVisibilidadeBotaoQBank();
    if (isPaginaResolucaoQBank()) {
        const qId = extrairIdQuestaoAtual();
        if (qId && qId !== lastImportedQId) {
            autoImportarQuestaoSeNavegou();
            if (typeof atualizarStatusCardQuestaoAtual === 'function') {
                atualizarStatusCardQuestaoAtual();
            }
        }
    }
}, 800);

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
            if (el && el.innerText && el.innerText.trim().length > 25) {
                const blocos = getBlocosDeTexto(el);
                if (blocos.length > 0) return blocos;
            }
        } catch(e) {}
    }

    // 2. Fallback inteligente para UWorld real (parágrafos clínicos antes das opções)
    const elements = Array.from(document.querySelectorAll('p, div'));
    const blocosStem = [];
    for (let el of elements) {
        const txt = (el.innerText || '').trim();
        // Filtra enunciados com comprimento clínico e ignora botões de controle
        if (txt.length > 40 && !txt.includes('Clear highlights') && !txt.includes('Mark Question') && !txt.includes('Item ') && !txt.includes('Question Id:')) {
            const hasChoiceHeader = /(?:Options|Alternativas|Educational objective)/i.test(txt);
            if (!hasChoiceHeader && !el.querySelector('table, tr, input[type="radio"]')) {
                const jaAdicionado = blocosStem.some(b => b.node && (b.node.contains(el) || el.contains(b.node)));
                if (!jaAdicionado) {
                    blocosStem.push({ text: txt, node: el });
                }
            }
        }
    }
    if (blocosStem.length > 0) return blocosStem;

    return [{ text: "Texto do enunciado não identificado.", node: null }];
}

function extrairAlternativasParaFila() {
    const itens = [];
    // 1. Tabela de alternativas ou linhas com classe de escolha
    const linhasAlternativas = document.querySelectorAll('tr.cursor-pointer, tr.cursor-default, table.choices tr, .choice-row, [class*="alternative"], [class*="choice"] tr');
    if (linhasAlternativas.length > 0) {
        itens.push({ text: "Options:", node: null });
        linhasAlternativas.forEach(linha => {
            const textContent = linha.innerText.replace(/^[a-z]{1,2}\s+/i, '').trim();
            if (textContent && textContent.length > 2) itens.push({ text: textContent, node: linha });
        });
        if (itens.length > 1) return itens;
    }

    // 2. Fallback por regex para linhas de múltipla escolha (A., B., C., D.)
    const elementsWithChoices = Array.from(document.querySelectorAll('div, p, tr, td, li'));
    const matchedChoices = [];
    elementsWithChoices.forEach(el => {
        if (el.children.length <= 1) {
            const txt = (el.innerText || '').trim();
            if (/^[A-H]\.?\s+[A-Za-z0-9]/m.test(txt) && txt.length < 350) {
                if (!matchedChoices.some(c => c.text === txt)) {
                    matchedChoices.push({ text: txt, node: el });
                }
            }
        }
    });

    if (matchedChoices.length > 0) {
        return [{ text: "Options:", node: null }, ...matchedChoices];
    }

    return itens;
}

// Localiza estritamente o cabeçalho do Educational Objective (evita capturar divs pai que englobam a página)
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
    // 1. Procura pela aba "Explanation"
    const expTab = Array.from(document.querySelectorAll('span, li, button, h2, h3')).find(el => 
        /^\s*Explanation\s*$/i.test((el.textContent || '').trim())
    );
    if (expTab) {
        const section = expTab.closest('div.mt-8, div[class*="mt-"], main, article');
        if (section) return section;
    }

    // 2. Container pai do cabeçalho do objetivo
    const objHeader = encontrarCabecalhoObjetivo();
    if (objHeader && objHeader.parentElement) {
        return objHeader.parentElement.closest('div.mt-8, div[class*="pt-5"], main') || objHeader.parentElement;
    }

    return document.body;
}

function extrairExplicacaoParaFila() {
    const objHeader = encontrarCabecalhoObjetivo();
    const expContainer = obterContainerExplicacao();
    const itens = [];

    // Todos os parágrafos dentro do container de explicação
    const allP = Array.from(expContainer.querySelectorAll('p'));
    for (let p of allP) {
        if (objHeader && (objHeader === p || objHeader.contains(p))) continue;

        // Se o parágrafo vem DEPOIS do objHeader, ele pertence ao Educational Objective!
        if (objHeader && (objHeader.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            continue;
        }

        // Ignora metadados de Subject / System
        if (p.closest('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)\s*:/i.test(p.innerText || '')) {
            continue;
        }

        const txt = (p.innerText || '').trim();
        if (txt.length > 5 && !/(?:Clear highlights|Mark Question)/i.test(txt)) {
            itens.push({ text: txt, node: p });
        }
    }

    // Fallback: se allP não achou nada, pega blocos de texto antes do objHeader
    if (itens.length === 0 && objHeader) {
        let prev = objHeader.previousElementSibling;
        const prevNodes = [];
        while (prev) {
            const txt = (prev.innerText || '').trim();
            if (txt.length > 5) prevNodes.unshift({ text: txt, node: prev });
            prev = prev.previousElementSibling;
        }
        if (prevNodes.length > 0) return prevNodes;
    }

    return itens.length > 0 ? itens : [{ text: "Explanation not found.", node: null }];
}

function extrairObjetivoParaFila() {
    const objHeader = encontrarCabecalhoObjetivo();
    if (!objHeader) return [{ text: "Educational objective not found.", node: null }];

    const itens = [];

    // 1. Pega os irmãos diretos que vêm depois do objHeader
    let next = objHeader.nextElementSibling;
    while (next) {
        // Se encontrou a barra de metadados Subject / System / Q ID, para imediatamente!
        if (next.querySelector('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)\s*:/i.test(next.innerText || '')) {
            break;
        }
        const txt = (next.innerText || '').trim();
        if (txt.length > 5) {
            itens.push({ text: txt, node: next });
        }
        next = next.nextElementSibling;
    }

    // 2. Se os irmãos diretos não trouxeram nada, varre parágrafos com compareDocumentPosition
    if (itens.length === 0) {
        const expContainer = obterContainerExplicacao();
        const allP = Array.from(expContainer.querySelectorAll('p'));
        for (let p of allP) {
            if (objHeader === p || objHeader.contains(p)) continue;
            // Se vem DEPOIS do objHeader
            if (objHeader.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) {
                if (p.closest('[class*="border-y"]') || /(?:Subject|System|Q\s*ID)/i.test(p.innerText || '')) break;
                const txt = (p.innerText || '').trim();
                if (txt.length > 5) itens.push({ text: txt, node: p });
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
                if (typeof autoImportarQuestaoSeNavegou === 'function') {
                    autoImportarQuestaoSeNavegou();
                }
            }, 600);
        }
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
