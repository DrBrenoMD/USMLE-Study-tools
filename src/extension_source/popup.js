// =========================================================================
// Assistente Q-Bank & Pacer - Popup Controller v1.5
// =========================================================================

// --- Navegação por Abas ---
const tabs = {
    pacer: { btn: document.getElementById('tab-btn-pacer'), content: document.getElementById('tab-content-pacer') },
    voice: { btn: document.getElementById('tab-btn-voice'), content: document.getElementById('tab-content-voice') },
    keys: { btn: document.getElementById('tab-btn-keys'), content: document.getElementById('tab-content-keys') }
};

function switchTab(tabKey) {
    Object.keys(tabs).forEach(k => {
        const isTarget = k === tabKey;
        tabs[k].btn.classList.toggle('active', isTarget);
        tabs[k].content.classList.toggle('active', isTarget);
    });
    const saveBar = document.getElementById('bottom-bar-prefs');
    if (saveBar) {
        saveBar.style.display = tabKey === 'pacer' ? 'none' : 'block';
    }
}

document.getElementById('tab-btn-pacer').addEventListener('click', () => switchTab('pacer'));
document.getElementById('tab-btn-voice').addEventListener('click', () => switchTab('voice'));
document.getElementById('tab-btn-keys').addEventListener('click', () => switchTab('keys'));
switchTab('pacer');

// --- Som do Pacer (Web Audio API) ---
let soundEnabled = true;
let audioCtx = null;
function playBeep(freq = 880, duration = 0.3) {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

const btnSoundToggle = document.getElementById('btn-sound-toggle');
btnSoundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSoundToggle.textContent = soundEnabled ? '🔊 Som' : '🔇 Mudo';
    chrome.storage.local.get(['pacer_state'], function(res) {
        let st = res.pacer_state || {};
        st.soundEnabled = soundEnabled;
        chrome.storage.local.set({ pacer_state: st });
    });
});

// =========================================================================
// PACER STATE MACHINE (Classico, Adaptativo e Sessões Pomodoro)
// =========================================================================
let pacerState = {
    isActive: false,
    isPaused: false,
    isFinished: false,
    mode: 'tradicional', // 'tradicional' | 'adaptativo' | 'sessoes'
    totalQ: 40,
    targetTimeSeconds: 90,
    triggerMode: 'both',
    currentQ: 1,
    currentQuestionTime: 0,
    completedQuestionsTime: [],
    soundEnabled: true,
    // Sessões Pomodoro
    studyMin: 50,
    restMin: 10,
    cyclesTotal: 4,
    currentCycle: 1,
    phase: 'study', // 'study' | 'rest'
    cycleTimeLeft: 50 * 60,
    studyTimeTotal: 50 * 4 * 60,
    studyTimeElapsed: 0,
    restTimeTotal: 10 * 4 * 60,
    restTimeElapsed: 0
};

// --- Formatação de Tempo ---
function formatTime(sec) {
    const s = Math.abs(sec) % 60;
    const m = Math.floor(Math.abs(sec) / 60);
    const sign = sec < 0 ? '-' : '';
    return sign + m + ':' + (s < 10 ? '0' : '') + s;
}

// --- Seleção de Modo de Sessão na Configuração ---
const btnModeTradicional = document.getElementById('btn-mode-tradicional');
const btnModeAdaptativo = document.getElementById('btn-mode-adaptativo');
const btnModeSessoes = document.getElementById('btn-mode-sessoes');
const boxPomodoroConfig = document.getElementById('box-pomodoro-config');

function setPacerMode(newMode) {
    pacerState.mode = newMode;
    btnModeTradicional.classList.toggle('active', newMode === 'tradicional');
    btnModeAdaptativo.classList.toggle('active', newMode === 'adaptativo');
    btnModeSessoes.classList.toggle('active', newMode === 'sessoes');
    boxPomodoroConfig.style.display = newMode === 'sessoes' ? 'block' : 'none';
}

btnModeTradicional.addEventListener('click', () => setPacerMode('tradicional'));
btnModeAdaptativo.addEventListener('click', () => setPacerMode('adaptativo'));
btnModeSessoes.addEventListener('click', () => setPacerMode('sessoes'));

// --- Atualização de Previsões no Form ---
const inputTotalQ = document.getElementById('p-cfg-total-q');
const inputTargetS = document.getElementById('p-cfg-target-s');
const previewTotal = document.getElementById('p-cfg-total-preview');
const inputStudyMin = document.getElementById('p-cfg-study-min');
const inputRestMin = document.getElementById('p-cfg-rest-min');
const inputCycles = document.getElementById('p-cfg-cycles');
const previewPomodoro = document.getElementById('p-cfg-pomodoro-total');

function updateFormPreviews() {
    const tq = Math.max(1, parseInt(inputTotalQ.value) || 40);
    const ts = Math.max(1, parseInt(inputTargetS.value) || 90);
    previewTotal.textContent = formatTime(tq * ts);

    const sMin = Math.max(1, parseInt(inputStudyMin.value) || 50);
    const rMin = Math.max(1, parseInt(inputRestMin.value) || 10);
    const cyc = Math.max(1, parseInt(inputCycles.value) || 4);
    const totalPomSec = (sMin + rMin) * cyc * 60;
    const hours = Math.floor(totalPomSec / 3600);
    const mins = Math.floor((totalPomSec % 3600) / 60);
    previewPomodoro.textContent = hours + 'h ' + (mins < 10 ? '0' : '') + mins + 'm';
}

inputTotalQ.addEventListener('input', updateFormPreviews);
inputTargetS.addEventListener('input', updateFormPreviews);
inputStudyMin.addEventListener('input', updateFormPreviews);
inputRestMin.addEventListener('input', updateFormPreviews);
inputCycles.addEventListener('input', updateFormPreviews);
updateFormPreviews();

// --- Abrir Pacer pelo Site (Mantida a função de rodar pelo site) ---
function abrirPacerNoSite() {
    const siteUrl = "https://ais-dev-uyia7fsfo4ccgjhz6kzehy-425901999385.us-east1.run.app/pacer";
    chrome.tabs.create({ url: siteUrl });
}
document.getElementById('btn-abrir-site-pacer').addEventListener('click', abrirPacerNoSite);
document.getElementById('link-abrir-site-sync').addEventListener('click', (e) => {
    e.preventDefault();
    abrirPacerNoSite();
});

// --- Iniciar Sessão ---
document.getElementById('btn-iniciar-sessao').addEventListener('click', () => {
    const tq = Math.max(1, parseInt(inputTotalQ.value) || 40);
    const ts = Math.max(1, parseInt(inputTargetS.value) || 90);
    const sMin = Math.max(1, parseInt(inputStudyMin.value) || 50);
    const rMin = Math.max(1, parseInt(inputRestMin.value) || 10);
    const cyc = Math.max(1, parseInt(inputCycles.value) || 4);

    pacerState.isActive = true;
    pacerState.isPaused = false;
    pacerState.isFinished = false;
    pacerState.totalQ = tq;
    pacerState.targetTimeSeconds = ts;
    pacerState.triggerMode = document.getElementById('p-cfg-trigger-mode').value;
    pacerState.currentQ = 1;
    pacerState.currentQuestionTime = 0;
    pacerState.completedQuestionsTime = [];
    
    // Configura Sessões Pomodoro
    pacerState.studyMin = sMin;
    pacerState.restMin = rMin;
    pacerState.cyclesTotal = cyc;
    pacerState.currentCycle = 1;
    pacerState.phase = 'study';
    pacerState.cycleTimeLeft = sMin * 60;
    pacerState.studyTimeTotal = sMin * cyc * 60;
    pacerState.studyTimeElapsed = 0;
    pacerState.restTimeTotal = rMin * cyc * 60;
    pacerState.restTimeElapsed = 0;

    salvarPacerState();
    renderPacerActive();
    playBeep(880, 0.4);
});

// --- Controles Ativos: Próxima, Anterior, Pausar, Parar ---
function pacerAvancar() {
    if (!pacerState.isActive) return;
    pacerState.completedQuestionsTime.push(Math.max(1, pacerState.currentQuestionTime));
    pacerState.currentQuestionTime = 0;

    if (pacerState.currentQ < pacerState.totalQ) {
        pacerState.currentQ += 1;
        playBeep(880, 0.2);
    } else {
        // Bloco finalizado
        pacerState.isActive = false;
        pacerState.isFinished = true;
        playBeep(1040, 0.6);
    }
    salvarPacerState();
    renderPacerActive();
}

function pacerVoltar() {
    if (!pacerState.isActive) return;
    if (pacerState.currentQ > 1) {
        pacerState.currentQ -= 1;
        if (pacerState.completedQuestionsTime.length > 0) {
            pacerState.currentQuestionTime = pacerState.completedQuestionsTime.pop();
        } else {
            pacerState.currentQuestionTime = 0;
        }
        salvarPacerState();
        renderPacerActive();
    }
}

function pacerTogglePause() {
    if (!pacerState.isActive) return;
    pacerState.isPaused = !pacerState.isPaused;
    salvarPacerState();
    renderPacerActive();
}

function pacerParar() {
    pacerState.isActive = false;
    pacerState.isPaused = false;
    pacerState.isFinished = false;
    pacerState.currentQ = 1;
    pacerState.currentQuestionTime = 0;
    pacerState.completedQuestionsTime = [];
    pacerState.phase = 'study';
    pacerState.currentCycle = 1;
    pacerState.cycleTimeLeft = pacerState.studyMin * 60;
    pacerState.studyTimeElapsed = 0;
    pacerState.restTimeElapsed = 0;
    salvarPacerState();
    renderPacerActive();
}

function pacerZerarTempoAcumulado() {
    if (!pacerState.isActive) return;
    // Normaliza questões concluídas para o tempo alvo (targetTimeSeconds),
    // zerando o atraso/adianto acumulado e reiniciando a questão atual em 0s.
    // Assim, o Status Global retorna ao valor exato de 1 questão (+targetTimeSeconds).
    pacerState.completedQuestionsTime = pacerState.completedQuestionsTime.map(() => pacerState.targetTimeSeconds);
    pacerState.currentQuestionTime = 0;
    salvarPacerState();
    renderPacerActive();
    playBeep(880, 0.15);
}

document.getElementById('btn-pacer-next').addEventListener('click', pacerAvancar);
document.getElementById('btn-pacer-prev').addEventListener('click', pacerVoltar);
document.getElementById('btn-pacer-pause').addEventListener('click', pacerTogglePause);
document.getElementById('btn-pacer-stop').addEventListener('click', pacerParar);
document.getElementById('btn-zerar-acumulado').addEventListener('click', pacerZerarTempoAcumulado);

// --- Pausa Extra no Pomodoro ---
document.getElementById('btn-cycle-pause-extra').addEventListener('click', () => {
    if (!pacerState.isActive || pacerState.mode !== 'sessoes') return;
    if (pacerState.phase === 'study') {
        pacerState.phase = 'rest';
        pacerState.cycleTimeLeft = pacerState.restMin * 60;
    } else {
        pacerState.phase = 'study';
        pacerState.cycleTimeLeft = pacerState.studyMin * 60;
    }
    salvarPacerState();
    renderPacerActive();
});

// --- Timer Tick (1 segundo) ---
setInterval(() => {
    if (!pacerState.isActive || pacerState.isPaused) return;

    pacerState.currentQuestionTime += 1;

    // Sessões Pomodoro
    if (pacerState.mode === 'sessoes') {
        pacerState.cycleTimeLeft -= 1;
        if (pacerState.phase === 'study') pacerState.studyTimeElapsed += 1;
        else pacerState.restTimeElapsed += 1;

        if (pacerState.cycleTimeLeft <= 0) {
            // Transição de fase
            if (pacerState.phase === 'study') {
                pacerState.phase = 'rest';
                pacerState.cycleTimeLeft = pacerState.restMin * 60;
                playBeep(659, 0.5);
            } else {
                pacerState.phase = 'study';
                pacerState.currentCycle = Math.min(pacerState.cyclesTotal, pacerState.currentCycle + 1);
                pacerState.cycleTimeLeft = pacerState.studyMin * 60;
                playBeep(880, 0.5);
            }
        }
    }

    // Alarme do Pacer (Clássico vs Adaptativo)
    const target = pacerState.targetTimeSeconds;
    const completedCount = pacerState.completedQuestionsTime.length;
    const completedTotal = pacerState.completedQuestionsTime.reduce((a, b) => a + b, 0);
    const globalElapsed = completedTotal + pacerState.currentQuestionTime;
    const totalTarget = pacerState.totalQ * target;
    const remainingQuestions = Math.max(0, pacerState.totalQ - completedCount);
    const realtimeRemainingTarget = totalTarget - globalElapsed;
    const requiredPace = remainingQuestions > 0 && realtimeRemainingTarget > 0 ? Math.floor(realtimeRemainingTarget / remainingQuestions) : target;
    const effectiveTarget = (pacerState.mode === 'adaptativo' && requiredPace < target && requiredPace > 0) ? requiredPace : target;

    if (pacerState.currentQuestionTime === effectiveTarget) {
        playBeep(880, 0.4);
    }

    renderPacerActive();
    salvarPacerState();
}, 1000);

// --- Renderizador Visual do Pacer Ativo ---
function renderPacerActive() {
    const viewConfig = document.getElementById('pacer-view-config');
    const viewActive = document.getElementById('pacer-view-active');

    if (!pacerState.isActive && !pacerState.isFinished) {
        viewConfig.style.display = 'flex';
        viewActive.style.display = 'none';
        return;
    }

    viewConfig.style.display = 'none';
    viewActive.style.display = 'flex';

    // 1. Pomodoro Banner
    const pomodoroBanner = document.getElementById('active-pomodoro-banner');
    if (pacerState.mode === 'sessoes') {
        pomodoroBanner.style.display = 'flex';
        pomodoroBanner.className = 'cycle-active-card ' + (pacerState.phase === 'study' ? 'cycle-study' : 'cycle-rest');
        document.getElementById('cycle-icon-display').textContent = pacerState.phase === 'study' ? '📖' : '☕';
        document.getElementById('cycle-phase-label').textContent = (pacerState.phase === 'study' ? 'Estudo' : 'Descanso') + ' • Ciclo ' + pacerState.currentCycle + ' de ' + pacerState.cyclesTotal;
        document.getElementById('cycle-timer-display').textContent = formatTime(pacerState.cycleTimeLeft);
        
        const totalRemSec = Math.max(0, (pacerState.studyTimeTotal - pacerState.studyTimeElapsed) + (pacerState.restTimeTotal - pacerState.restTimeElapsed));
        const remH = Math.floor(totalRemSec / 3600);
        const remM = Math.floor((totalRemSec % 3600) / 60);
        document.getElementById('cycle-total-rem').textContent = remH + 'h ' + (remM < 10 ? '0' : '') + remM + 'm';
    } else {
        pomodoroBanner.style.display = 'none';
    }

    // 2. Question Hero
    const completedCount = pacerState.completedQuestionsTime.length;
    const completedTotal = pacerState.completedQuestionsTime.reduce((a, b) => a + b, 0);
    const globalElapsed = completedTotal + pacerState.currentQuestionTime;
    const totalTarget = pacerState.totalQ * pacerState.targetTimeSeconds;
    const remainingQuestions = Math.max(0, pacerState.totalQ - completedCount);
    const realtimeRemainingTarget = totalTarget - globalElapsed;
    const requiredPace = remainingQuestions > 0 && realtimeRemainingTarget > 0 ? Math.floor(realtimeRemainingTarget / remainingQuestions) : pacerState.targetTimeSeconds;
    const effectiveTarget = (pacerState.mode === 'adaptativo' && requiredPace < pacerState.targetTimeSeconds && requiredPace > 0) ? requiredPace : pacerState.targetTimeSeconds;

    document.getElementById('q-counter-text').textContent = 'Questão ' + pacerState.currentQ + ' de ' + pacerState.totalQ;
    const qTimer = document.getElementById('q-timer-display');
    qTimer.textContent = formatTime(pacerState.currentQuestionTime);
    qTimer.classList.toggle('q-timer-overtime', pacerState.currentQuestionTime >= effectiveTarget);

    document.getElementById('q-alarm-label').textContent = 'Alarme em ' + formatTime(effectiveTarget);

    const adaptiveBadge = document.getElementById('q-adaptive-badge');
    adaptiveBadge.style.display = (pacerState.mode === 'adaptativo' && effectiveTarget < pacerState.targetTimeSeconds) ? 'inline-block' : 'none';

    const pausedBadge = document.getElementById('q-paused-badge');
    pausedBadge.style.display = pacerState.isPaused ? 'inline-block' : 'none';

    // 3. Stats Grid
    const avgPace = completedCount > 0 ? Math.round(completedTotal / completedCount) : 0;
    document.getElementById('stat-avg-pace').textContent = completedCount > 0 ? formatTime(avgPace) : '--:--';
    document.getElementById('stat-req-pace').textContent = formatTime(requiredPace);
    document.getElementById('stat-req-sub').textContent = 'Para as ' + remainingQuestions + ' restantes';

    // 4. Global Pace Status
    const globalDiff = (pacerState.currentQ * pacerState.targetTimeSeconds) - globalElapsed;
    const banner = document.getElementById('global-pace-banner');
    const isAhead = globalDiff >= 0;
    banner.className = 'global-pace-banner ' + (isAhead ? 'pace-ahead' : 'pace-behind');
    document.getElementById('pace-banner-val').textContent = (isAhead ? 'Adiantado em ' : 'Atrasado em ') + formatTime(Math.abs(globalDiff));
    document.getElementById('pacer-total-elapsed-text').textContent = 'Decorrido: ' + formatTime(globalElapsed);

    // 5. Botão de Pause label
    document.getElementById('btn-pacer-pause').textContent = pacerState.isPaused ? '▶️ Retomar' : '⏸️ Pausar';
}

function salvarPacerState() {
    chrome.storage.local.set({ pacer_state: pacerState });
}

function carregarPacerState() {
    chrome.storage.local.get(['pacer_state'], function(res) {
        if (res.pacer_state) {
            pacerState = Object.assign(pacerState, res.pacer_state);
            soundEnabled = pacerState.soundEnabled !== false;
            btnSoundToggle.textContent = soundEnabled ? '🔊 Som' : '🔇 Mudo';
            setPacerMode(pacerState.mode || 'tradicional');
            if (pacerState.isActive) {
                renderPacerActive();
            }
        }
    });
}
carregarPacerState();

// Escuta mudanças de Pacer vindas de outras abas ou do content script
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.pacer_state && changes.pacer_state.newValue) {
            pacerState = Object.assign(pacerState, changes.pacer_state.newValue);
            renderPacerActive();
        }
    }
});

// =========================================================================
// VOZ, LEITURA E BOTÕES DE AÇÃO
// =========================================================================
function enviarComandoAbaAtiva(cmd) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { comando: cmd });
        }
    });
}

// Botões de Ação Imediata & Inline
document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) enviarComandoAbaAtiva(cmd);
    });
});

// Microfone
const micStatusPill = document.getElementById('mic-status-pill');
document.getElementById('btn-mic-on').addEventListener('click', () => {
    enviarComandoAbaAtiva('ativar_mic');
    micStatusPill.textContent = 'Ligado';
    micStatusPill.style.color = '#059669';
});
document.getElementById('btn-mic-off').addEventListener('click', () => {
    enviarComandoAbaAtiva('desativar_mic');
    micStatusPill.textContent = 'Desligado';
    micStatusPill.style.color = '#dc2626';
});

// Vozes
const voiceSelect = document.getElementById('voice-select');
const showAllVoices = document.getElementById('show-all-voices');
const voiceSpeed = document.getElementById('voice-speed');
const speedVal = document.getElementById('speed-val');
const autoRead = document.getElementById('auto-read');

function popularVozes() {
    const vozes = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="default">Padrão Neural do Sistema</option>';
    const mostrarTodas = showAllVoices.checked;

    vozes.forEach(voz => {
        const isEnglish = voz.lang.includes('en');
        const isPortuguese = voz.lang.includes('pt');
        if (mostrarTodas || isEnglish || isPortuguese) {
            const opt = document.createElement('option');
            opt.value = voz.name;
            opt.textContent = voz.name + ' (' + voz.lang + ')';
            voiceSelect.appendChild(opt);
        }
    });
}

popularVozes();
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = popularVozes;
}
showAllVoices.addEventListener('change', popularVozes);

voiceSpeed.addEventListener('input', () => {
    speedVal.textContent = voiceSpeed.value + 'x';
});

// Carregar e Salvar Preferências de Voz e Atalhos
const camposConfig = [
    'cmd-ler', 'cmd-rep-enunciado', 'cmd-rep-alt', 'cmd-exp', 'cmd-obj',
    'cmd-prox', 'cmd-ant', 'cmd-submit', 'cmd-parar', 'cmd-sel',
    'kb-prox', 'kb-ant', 'kb-submit', 'kb-ler', 'kb-rep-enunciado', 'kb-rep-alt',
    'kb-exp', 'kb-obj', 'kb-play', 'kb-stop', 'kb-prev-phrase', 'kb-next-phrase'
];

chrome.storage.local.get([
    'cmdLer', 'cmdRepEnunciado', 'cmdRepAlt', 'cmdExplicacao', 'cmdObjetivo',
    'cmdProx', 'cmdAnt', 'cmdSubmit', 'cmdParar', 'cmdSel',
    'kbProx', 'kbAnt', 'kbSubmit', 'kbLer', 'kbRepEnunciado', 'kbRepAlt',
    'kbExp', 'kbObj', 'kbPlay', 'kbStop', 'kbPrevPhrase', 'kbNextPhrase',
    'vozEscolhida', 'velocidadeVoz', 'autoRead', 'showAllVoices'
], function(res) {
    if (res.cmdLer) document.getElementById('cmd-ler').value = res.cmdLer;
    if (res.cmdRepEnunciado) document.getElementById('cmd-rep-enunciado').value = res.cmdRepEnunciado;
    if (res.cmdRepAlt) document.getElementById('cmd-rep-alt').value = res.cmdRepAlt;
    if (res.cmdExplicacao) document.getElementById('cmd-exp').value = res.cmdExplicacao;
    if (res.cmdObjetivo) document.getElementById('cmd-obj').value = res.cmdObjetivo;
    if (res.cmdProx) document.getElementById('cmd-prox').value = res.cmdProx;
    if (res.cmdAnt) document.getElementById('cmd-ant').value = res.cmdAnt;
    if (res.cmdSubmit) document.getElementById('cmd-submit').value = res.cmdSubmit;
    if (res.cmdParar) document.getElementById('cmd-parar').value = res.cmdParar;
    if (res.cmdSel) document.getElementById('cmd-sel').value = res.cmdSel;

    if (res.kbProx) document.getElementById('kb-prox').value = res.kbProx;
    if (res.kbAnt) document.getElementById('kb-ant').value = res.kbAnt;
    if (res.kbSubmit) document.getElementById('kb-submit').value = res.kbSubmit;
    if (res.kbLer) document.getElementById('kb-ler').value = res.kbLer;
    if (res.kbRepEnunciado) document.getElementById('kb-rep-enunciado').value = res.kbRepEnunciado;
    if (res.kbRepAlt) document.getElementById('kb-rep-alt').value = res.kbRepAlt;
    if (res.kbExp) document.getElementById('kb-exp').value = res.kbExp;
    if (res.kbObj) document.getElementById('kb-obj').value = res.kbObj;
    if (res.kbPlay) document.getElementById('kb-play').value = res.kbPlay;
    if (res.kbStop) document.getElementById('kb-stop').value = res.kbStop;
    if (res.kbPrevPhrase) document.getElementById('kb-prev-phrase').value = res.kbPrevPhrase;
    if (res.kbNextPhrase) document.getElementById('kb-next-phrase').value = res.kbNextPhrase;

    if (res.velocidadeVoz) {
        voiceSpeed.value = res.velocidadeVoz;
        speedVal.textContent = res.velocidadeVoz + 'x';
    }
    if (res.autoRead !== undefined) autoRead.checked = res.autoRead;
    if (res.showAllVoices !== undefined) {
        showAllVoices.checked = res.showAllVoices;
        popularVozes();
    }
    if (res.vozEscolhida) {
        setTimeout(() => { voiceSelect.value = res.vozEscolhida; }, 200);
    }
});

// Salvar Preferências
document.getElementById('btn-salvar').addEventListener('click', () => {
    const payload = {
        cmdLer: document.getElementById('cmd-ler').value,
        cmdRepEnunciado: document.getElementById('cmd-rep-enunciado').value,
        cmdRepAlt: document.getElementById('cmd-rep-alt').value,
        cmdExplicacao: document.getElementById('cmd-exp').value,
        cmdObjetivo: document.getElementById('cmd-obj').value,
        cmdProx: document.getElementById('cmd-prox').value,
        cmdAnt: document.getElementById('cmd-ant').value,
        cmdSubmit: document.getElementById('cmd-submit').value,
        cmdParar: document.getElementById('cmd-parar').value,
        cmdSel: document.getElementById('cmd-sel').value,

        kbProx: document.getElementById('kb-prox').value,
        kbAnt: document.getElementById('kb-ant').value,
        kbSubmit: document.getElementById('kb-submit').value,
        kbLer: document.getElementById('kb-ler').value,
        kbRepEnunciado: document.getElementById('kb-rep-enunciado').value,
        kbRepAlt: document.getElementById('kb-rep-alt').value,
        kbExp: document.getElementById('kb-exp').value,
        kbObj: document.getElementById('kb-obj').value,
        kbPlay: document.getElementById('kb-play').value,
        kbStop: document.getElementById('kb-stop').value,
        kbPrevPhrase: document.getElementById('kb-prev-phrase').value,
        kbNextPhrase: document.getElementById('kb-next-phrase').value,

        vozEscolhida: voiceSelect.value,
        velocidadeVoz: parseFloat(voiceSpeed.value) || 1.1,
        autoRead: autoRead.checked,
        showAllVoices: showAllVoices.checked
    };

    chrome.storage.local.set(payload, () => {
        const toast = document.getElementById('toast-msg');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2000);
    });
});

// Restaurar Atalhos Padrão
document.getElementById('btn-reset-shortcuts').addEventListener('click', () => {
    document.getElementById('kb-prox').value = 'alt+n';
    document.getElementById('kb-ant').value = 'alt+b';
    document.getElementById('kb-submit').value = 'alt+enter';
    document.getElementById('kb-ler').value = 'alt+l';
    document.getElementById('kb-rep-enunciado').value = 'alt+e';
    document.getElementById('kb-rep-alt').value = 'alt+a';
    document.getElementById('kb-exp').value = 'alt+x';
    document.getElementById('kb-obj').value = 'alt+o';
    document.getElementById('kb-play').value = 'alt+p';
    document.getElementById('kb-stop').value = 'alt+s';
    document.getElementById('kb-prev-phrase').value = 'alt+arrowleft';
    document.getElementById('kb-next-phrase').value = 'alt+arrowright';
});