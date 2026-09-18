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

window.addEventListener('DOMContentLoaded', criarBarraUI);

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
