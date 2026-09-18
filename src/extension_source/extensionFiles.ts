// =========================================================================
// Fonte da Extensão do Chrome: Assistente de Questões por Voz + Pacer
// Toda alteração feita aqui atualiza automaticamente o arquivo .ZIP para download no site!
// =========================================================================

export const EXTENSION_VERSION = "1.4";
export const EXTENSION_NAME = "Assistente de Questões por Voz + Pacer";

export const manifestJson = `{
  "manifest_version": 3,
  "name": "Assistente de Questões por Voz + Pacer",
  "version": "1.4",
  "description": "Lê enunciados, seleciona alternativas por voz e executa o Question Pacer diretamente no Popup ou pelo Site.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Assistente Q-Bank & Pacer"
  }
}`;

export const popupHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Assistente Q-Bank & Pacer</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      width: 400px;
      margin: 0;
      padding: 0;
      background: #f8fafc;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.4;
      overflow-x: hidden;
      user-select: none;
    }

    /* Top Brand Header */
    .app-header {
      background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }
    .brand-text h1 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .brand-text span {
      font-size: 10px;
      opacity: 0.85;
      font-weight: 500;
    }
    .brand-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge-version {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 700;
    }

    /* Tab Navigation (Matching Site Style) */
    .nav-tabs {
      display: flex;
      gap: 4px;
      padding: 6px 10px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }
    .nav-tab-btn {
      flex: 1;
      padding: 7px 4px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .nav-tab-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .nav-tab-btn.active {
      background: #eff6ff;
      color: #2563eb;
      box-shadow: 0 1px 2px rgba(37,99,235,0.06);
    }

    /* Content Area */
    .tab-content {
      display: none;
      padding: 12px;
      flex-direction: column;
      gap: 12px;
    }
    .tab-content.active {
      display: flex;
    }

    /* Cards */
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    /* Pacer Visualizer (Hero Card) */
    .pacer-hero-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 14px;
      text-align: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      position: relative;
      overflow: hidden;
    }
    .pacer-hero-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status-idle { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    .status-running { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .status-paused { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .status-finished { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

    .q-bank-sync-tag {
      font-size: 10px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .q-bank-sync-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 4px #10b981;
    }

    /* Progress Info */
    .pacer-progress-text {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 5px;
    }
    .pacer-bar-container {
      width: 100%;
      height: 6px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 14px;
      border: 1px solid #e2e8f0;
    }
    .pacer-bar-fill {
      height: 100%;
      background: #2563eb;
      width: 2.5%;
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    /* Main Big Clock Display */
    .pacer-clock-container {
      margin: 6px 0 10px 0;
    }
    .pacer-clock-digits {
      font-size: 42px;
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: #059669; /* Emerald for on-pace */
      transition: color 0.2s;
    }
    .pacer-clock-digits.warning { color: #d97706; }
    .pacer-clock-digits.overtime { color: #dc2626; }
    .pacer-clock-target {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-top: 4px;
    }

    /* Stats 2-column Grid */
    .pacer-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 12px 0 14px 0;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 8px;
      text-align: center;
    }
    .stat-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 2px;
    }
    .stat-val {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }
    .stat-val.pace-ok { color: #059669; }
    .stat-val.pace-ahead { color: #2563eb; }
    .stat-val.pace-behind { color: #dc2626; }

    /* Action Buttons */
    .pacer-btn-main {
      width: 100%;
      padding: 10px 14px;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
      background: #2563eb;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(37,99,235,0.25);
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .pacer-btn-main:hover {
      background: #1d4ed8;
      box-shadow: 0 3px 6px rgba(37,99,235,0.35);
    }
    .pacer-btn-main.is-paused {
      background: #10b981;
    }
    .pacer-btn-main.is-running {
      background: #f59e0b;
    }

    .pacer-btn-row {
      display: grid;
      grid-template-columns: 1fr 1.2fr 0.8fr;
      gap: 6px;
      margin-top: 8px;
    }
    .btn-secondary-action {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .btn-secondary-action:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-next-action {
      background: #4f46e5;
      color: white;
      border: none;
    }
    .btn-next-action:hover {
      background: #4338ca;
      color: white;
    }

    /* Pacer Config Panel */
    .pacer-config-header {
      font-size: 11px;
      font-weight: 800;
      color: #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .pills-group {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }
    .pill-btn {
      flex: 1;
      padding: 5px 2px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .pill-btn:hover {
      border-color: #94a3b8;
    }
    .pill-btn.active {
      background: #eff6ff;
      color: #2563eb;
      border-color: #93c5fd;
      font-weight: 800;
    }

    /* Run on Site Card */
    .site-pacer-card {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .site-pacer-info h4 {
      margin: 0;
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
    }
    .site-pacer-info p {
      margin: 2px 0 0 0;
      font-size: 10px;
      color: #64748b;
    }
    .btn-open-site-pacer {
      padding: 7px 12px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-open-site-pacer:hover {
      background: #4338ca;
    }

    /* Voice / Form Styles */
    .form-group {
      margin-bottom: 10px;
    }
    .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 4px;
    }
    select, input[type="text"] {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
    }
    select:focus, input[type="text"]:focus {
      border-color: #2563eb;
    }

    .speed-slider-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .speed-slider-row input[type="range"] {
      flex: 1;
    }
    .speed-badge {
      min-width: 38px;
      text-align: right;
      font-size: 11px;
      font-weight: 800;
      color: #2563eb;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #334155;
      cursor: pointer;
    }

    .mic-control-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }
    .btn-mic-on {
      padding: 8px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }
    .btn-mic-off {
      padding: 8px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }

    /* Shortcuts Table */
    .shortcut-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .shortcut-row:last-child {
      border-bottom: none;
    }
    .shortcut-name {
      font-size: 11px;
      color: #475569;
    }
    .shortcut-input {
      width: 100px !important;
      padding: 4px 6px !important;
      font-size: 10px !important;
      text-align: center;
      font-family: monospace;
      font-weight: 700;
    }

    /* Bottom Save Button */
    .bottom-bar {
      padding: 8px 12px 12px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }
    .btn-save-prefs {
      width: 100%;
      padding: 8px;
      background: #1e293b;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-save-prefs:hover {
      background: #0f172a;
    }
  </style>
</head>
<body>

  <!-- Brand Header -->
  <div class="app-header">
    <div class="brand-left">
      <div class="brand-icon">⏱️</div>
      <div class="brand-text">
        <h1>Question Pacer</h1>
        <span>Assistente de Questões & Ritmo</span>
      </div>
    </div>
    <div class="brand-right">
      <span class="badge-version">v1.4</span>
      <button id="btn-sound-toggle" title="Alternar som do Pacer" style="background:none; border:none; color:white; cursor:pointer; font-size:14px; padding:2px 4px;">🔊</button>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div class="nav-tabs">
    <button class="nav-tab-btn active" id="tab-btn-pacer">⏱️ Pacer</button>
    <button class="nav-tab-btn" id="tab-btn-voice">🎙️ Voz & Leitura</button>
    <button class="nav-tab-btn" id="tab-btn-keys">⌨️ Atalhos</button>
  </div>

  <!-- TAB 1: PACER (Direct In-Popup Pacer) -->
  <div class="tab-content active" id="tab-content-pacer">
    
    <!-- Pacer Visualizer Hero Card -->
    <div class="pacer-hero-card">
      <div class="pacer-hero-header">
        <span class="status-pill status-idle" id="pacer-status-badge">⚪ Não iniciado</span>
        <div class="q-bank-sync-tag" title="Sincronização com UWorld/Amboss ativa">
          <span class="q-bank-sync-dot"></span>
          <span>Q-Bank Sync</span>
        </div>
      </div>

      <!-- Question Counter & Bar -->
      <div class="pacer-progress-text">
        <span>Questão <b id="p-cur-q">1</b> de <span id="p-tot-q">40</span></span>
        <span id="p-pct">2%</span>
      </div>
      <div class="pacer-bar-container">
        <div class="pacer-bar-fill" id="p-bar-fill"></div>
      </div>

      <!-- Big Timer Display -->
      <div class="pacer-clock-container">
        <div class="pacer-clock-digits" id="p-timer-display">00:00</div>
        <div class="pacer-clock-target" id="p-target-label">Meta: 01:30 por questão</div>
      </div>

      <!-- Pace & Stats -->
      <div class="pacer-stats-grid">
        <div class="stat-box">
          <div class="stat-label">Ritmo (Pace)</div>
          <div class="stat-val pace-ok" id="p-pace-val">No ritmo</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Tempo Restante</div>
          <div class="stat-val" id="p-block-rem">60:00</div>
        </div>
      </div>

      <!-- Main Controls -->
      <button class="pacer-btn-main" id="btn-pacer-main">
        <span>▶ Iniciar Bloco</span>
      </button>

      <div class="pacer-btn-row">
        <button class="btn-secondary-action" id="btn-pacer-prev">◀ Anterior</button>
        <button class="btn-secondary-action btn-next-action" id="btn-pacer-next">Próxima ▶</button>
        <button class="btn-secondary-action" id="btn-pacer-reset">🔄 Zerar</button>
      </div>
    </div>

    <!-- Quick Block Config -->
    <div class="card">
      <div class="pacer-config-header">
        <span>Configurações do Bloco</span>
        <span style="font-size:10px; color:#64748b;">(Ajustável a qualquer momento)</span>
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:3px;">Qtd. de Questões:</label>
        <div class="pills-group" id="pills-questions">
          <div class="pill-btn" data-val="10">10 Qs</div>
          <div class="pill-btn" data-val="20">20 Qs</div>
          <div class="pill-btn active" data-val="40">40 Qs</div>
          <div class="pill-btn" data-val="60">60 Qs</div>
        </div>
      </div>

      <div style="margin-bottom:6px;">
        <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:3px;">Tempo por Questão:</label>
        <div class="pills-group" id="pills-time">
          <div class="pill-btn" data-val="60">60s</div>
          <div class="pill-btn" data-val="75">75s</div>
          <div class="pill-btn active" data-val="90">90s (USMLE)</div>
          <div class="pill-btn" data-val="120">120s</div>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:0;">
        <label style="font-size:10px; font-weight:700; color:#475569; margin-bottom:3px;">Avançar no Pacer ao clicar em:</label>
        <select id="pacer-trigger-select">
          <option value="both">Next ou Submit (Recomendado)</option>
          <option value="next">Apenas Next</option>
          <option value="submit">Apenas Submit</option>
        </select>
      </div>
    </div>

    <!-- Website Pacer Connection (Maintain Run via Site) -->
    <div class="site-pacer-card">
      <div class="site-pacer-info">
        <h4>Rodar Pacer pelo Site</h4>
        <p>Tela cheia, segundo monitor ou histórico completo.</p>
      </div>
      <button class="btn-open-site-pacer" id="btn-open-site-pacer">
        <span>🌐 Abrir no Site</span>
      </button>
    </div>

  </div>

  <!-- TAB 2: VOICE & READING -->
  <div class="tab-content" id="tab-content-voice">
    <div class="card">
      <div class="form-group">
        <label>Voz da Leitura:</label>
        <select id="voice-select"></select>
        <label class="toggle-row" style="margin-top:5px;">
          <input type="checkbox" id="show-all-voices">
          <span>Mostrar todas as vozes do sistema</span>
        </label>
      </div>

      <div class="form-group">
        <label>Velocidade da Voz:</label>
        <div class="speed-slider-row">
          <input type="range" id="voice-speed" min="0.5" max="2.0" step="0.1" value="1.1">
          <span class="speed-badge" id="speed-val">1.1x</span>
        </div>
      </div>

      <label class="toggle-row" style="margin-top:8px;">
        <input type="checkbox" id="auto-read">
        <span style="font-weight:700; color:#1e40af;">Ler automaticamente ao avançar/voltar questão</span>
      </label>
    </div>

    <!-- Mic Controls -->
    <div class="card">
      <div class="pacer-config-header">
        <span>Reconhecimento de Voz Q-Bank</span>
      </div>
      <p style="font-size:10px; color:#64748b; margin:0 0 6px 0;">
        Fale <i>"ler questão"</i>, <i>"próxima"</i>, <i>"selecionar A"</i> ou <i>"explicação"</i> no UWorld.
      </p>
      <div class="mic-control-grid">
        <button id="btn-mic" class="btn-mic-on">🎙️ Ligar Microfone</button>
        <button id="btn-mic-off" class="btn-mic-off">⏹️ Desligar Microfone</button>
      </div>
    </div>
  </div>

  <!-- TAB 3: KEYBOARD SHORTCUTS -->
  <div class="tab-content" id="tab-content-keys">
    <div class="card">
      <div class="pacer-config-header">
        <span>Atalhos de Teclado no UWorld</span>
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Avançar (Next)</span>
        <input type="text" class="shortcut-input" id="kb-prox" value="alt+n">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Voltar (Prev)</span>
        <input type="text" class="shortcut-input" id="kb-ant" value="alt+b">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Confirmar (Submit)</span>
        <input type="text" class="shortcut-input" id="kb-submit" value="alt+enter">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Ler Questão</span>
        <input type="text" class="shortcut-input" id="kb-ler" value="alt+l">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Ler Explicação</span>
        <input type="text" class="shortcut-input" id="kb-exp" value="alt+x">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Play / Pause Leitor</span>
        <input type="text" class="shortcut-input" id="kb-play" value="alt+p">
      </div>
      <div class="shortcut-row">
        <span class="shortcut-name">Parar Leitura</span>
        <input type="text" class="shortcut-input" id="kb-stop" value="alt+s">
      </div>
    </div>
  </div>

  <!-- Bottom Save Bar (for Voice & Shortcuts) -->
  <div class="bottom-bar" id="bottom-bar-prefs">
    <button id="btn-salvar" class="btn-save-prefs">Salvar Preferências</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

export const popupJs = `// =========================================================================
// Assistente Q-Bank & Pacer - Popup Controller
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
    // Mostra a barra de salvar apenas nas abas de voz e atalhos
    const saveBar = document.getElementById('bottom-bar-prefs');
    if (saveBar) {
        saveBar.style.display = tabKey === 'pacer' ? 'none' : 'block';
    }
}

document.getElementById('tab-btn-pacer').addEventListener('click', () => switchTab('pacer'));
document.getElementById('tab-btn-voice').addEventListener('click', () => switchTab('voice'));
document.getElementById('tab-btn-keys').addEventListener('click', () => switchTab('keys'));

// Inicia na aba Pacer por padrão
switchTab('pacer');

// =========================================================================
// PACER STATE & ENGINE (Execução Direta no Popup)
// =========================================================================
let pacerState = {
    isActive: false,
    isPaused: false,
    isFinished: false,
    totalQ: 40,
    currentQ: 1,
    targetSeconds: 90,
    triggerMode: 'both',
    soundEnabled: true,
    qStartTime: 0,
    elapsedQSeconds: 0,
    questionTimes: [],
    blockStartTime: 0
};

function formatSeconds(secs) {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return String(m).padStart(2, '0') + ':' + String(remS).padStart(2, '0');
}

function playPacerBeep(freq = 880) {
    if (!pacerState.soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
}

function savePacerState() {
    chrome.storage.local.set({ pacer_state: pacerState });
}

function loadPacerState(callback) {
    chrome.storage.local.get(['pacer_state'], (result) => {
        if (result.pacer_state) {
            pacerState = Object.assign(pacerState, result.pacer_state);
        }
        if (callback) callback();
        renderPacerUI();
    });
}

function renderPacerUI() {
    // 1. Status Badge
    const badge = document.getElementById('pacer-status-badge');
    const btnMain = document.getElementById('btn-pacer-main');

    if (pacerState.isFinished) {
        badge.className = 'status-pill status-finished';
        badge.textContent = '✓ Bloco Concluído!';
        btnMain.innerHTML = '<span>🔄 Iniciar Novo Bloco</span>';
        btnMain.className = 'pacer-btn-main is-paused';
    } else if (pacerState.isActive && !pacerState.isPaused) {
        badge.className = 'status-pill status-running';
        badge.textContent = '🟢 Em Andamento';
        btnMain.innerHTML = '<span>⏸ Pausar Bloco</span>';
        btnMain.className = 'pacer-btn-main is-running';
    } else if (pacerState.isActive && pacerState.isPaused) {
        badge.className = 'status-pill status-paused';
        badge.textContent = '🟡 Pausado';
        btnMain.innerHTML = '<span>▶ Retomar Bloco</span>';
        btnMain.className = 'pacer-btn-main is-paused';
    } else {
        badge.className = 'status-pill status-idle';
        badge.textContent = '⚪ Não iniciado';
        btnMain.innerHTML = '<span>▶ Iniciar Bloco</span>';
        btnMain.className = 'pacer-btn-main';
    }

    // 2. Progresso
    document.getElementById('p-cur-q').textContent = pacerState.currentQ;
    document.getElementById('p-tot-q').textContent = pacerState.totalQ;
    const pct = Math.min(100, Math.round((pacerState.currentQ / pacerState.totalQ) * 100));
    document.getElementById('p-pct').textContent = pct + '%';
    document.getElementById('p-bar-fill').style.width = pct + '%';

    // 3. Tempo da questão atual
    let curQElapsed = pacerState.elapsedQSeconds;
    if (pacerState.isActive && !pacerState.isPaused && pacerState.qStartTime > 0) {
        curQElapsed += Math.floor((Date.now() - pacerState.qStartTime) / 1000);
    }

    const clockEl = document.getElementById('p-timer-display');
    clockEl.textContent = formatSeconds(curQElapsed);

    // Cor do cronômetro conforme o ritmo
    clockEl.className = 'pacer-clock-digits';
    if (curQElapsed > pacerState.targetSeconds) {
        clockEl.classList.add('overtime');
    } else if (curQElapsed > pacerState.targetSeconds - 15) {
        clockEl.classList.add('warning');
    }

    // Target label
    document.getElementById('p-target-label').textContent = 
        'Meta: ' + formatSeconds(pacerState.targetSeconds) + ' por questão';

    // 4. Ritmo (Pace) e Tempo Restante do Bloco
    const completedSeconds = (pacerState.questionTimes || []).reduce((a, b) => a + b, 0);
    const totalBlockElapsed = completedSeconds + curQElapsed;
    const totalBlockTarget = pacerState.totalQ * pacerState.targetSeconds;
    const remainingBlockSeconds = Math.max(0, totalBlockTarget - totalBlockElapsed);
    document.getElementById('p-block-rem').textContent = formatSeconds(remainingBlockSeconds);

    // Pace calculation
    const paceValEl = document.getElementById('p-pace-val');
    const expectedSoFar = pacerState.currentQ * pacerState.targetSeconds;
    const diff = expectedSoFar - totalBlockElapsed;

    paceValEl.className = 'stat-val';
    if (!pacerState.isActive) {
        paceValEl.textContent = 'No ritmo';
        paceValEl.classList.add('pace-ok');
    } else if (diff > 15) {
        paceValEl.textContent = 'Adiantado (+' + formatSeconds(diff) + ')';
        paceValEl.classList.add('pace-ahead');
    } else if (diff < -15) {
        paceValEl.textContent = 'Atrasado (-' + formatSeconds(Math.abs(diff)) + ')';
        paceValEl.classList.add('pace-behind');
    } else {
        paceValEl.textContent = 'No ritmo ideal';
        paceValEl.classList.add('pace-ok');
    }

    // Som
    const sndBtn = document.getElementById('btn-sound-toggle');
    if (sndBtn) sndBtn.textContent = pacerState.soundEnabled ? '🔊' : '🔇';

    // Pills ativas
    updatePillsActive();
}

function updatePillsActive() {
    document.querySelectorAll('#pills-questions .pill-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val) === pacerState.totalQ);
    });
    document.querySelectorAll('#pills-time .pill-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val) === pacerState.targetSeconds);
    });
    const triggerSel = document.getElementById('pacer-trigger-select');
    if (triggerSel) triggerSel.value = pacerState.triggerMode || 'both';
}

// Loop de atualização em tempo real no popup
setInterval(() => {
    if (pacerState.isActive && !pacerState.isPaused) {
        renderPacerUI();
    }
}, 500);

// Ações dos Botões do Pacer
document.getElementById('btn-pacer-main').addEventListener('click', () => {
    if (pacerState.isFinished) {
        // Reset e novo bloco
        pacerState.isFinished = false;
        pacerState.isActive = true;
        pacerState.isPaused = false;
        pacerState.currentQ = 1;
        pacerState.qStartTime = Date.now();
        pacerState.elapsedQSeconds = 0;
        pacerState.questionTimes = [];
        pacerState.blockStartTime = Date.now();
        playPacerBeep(520);
    } else if (!pacerState.isActive) {
        // Iniciar
        pacerState.isActive = true;
        pacerState.isPaused = false;
        pacerState.currentQ = 1;
        pacerState.qStartTime = Date.now();
        pacerState.elapsedQSeconds = 0;
        pacerState.questionTimes = [];
        pacerState.blockStartTime = Date.now();
        playPacerBeep(520);
    } else if (!pacerState.isPaused) {
        // Pausar
        pacerState.isPaused = true;
        pacerState.elapsedQSeconds += Math.floor((Date.now() - pacerState.qStartTime) / 1000);
        pacerState.qStartTime = 0;
    } else {
        // Retomar
        pacerState.isPaused = false;
        pacerState.qStartTime = Date.now();
    }
    savePacerState();
    renderPacerUI();
});

document.getElementById('btn-pacer-next').addEventListener('click', () => {
    avancarQuestao();
});

document.getElementById('btn-pacer-prev').addEventListener('click', () => {
    voltarQuestao();
});

document.getElementById('btn-pacer-reset').addEventListener('click', () => {
    if (confirm('Deseja zerar o bloco de questões atual?')) {
        pacerState.isActive = false;
        pacerState.isPaused = false;
        pacerState.isFinished = false;
        pacerState.currentQ = 1;
        pacerState.qStartTime = 0;
        pacerState.elapsedQSeconds = 0;
        pacerState.questionTimes = [];
        savePacerState();
        renderPacerUI();
    }
});

function avancarQuestao() {
    if (!pacerState.isActive) {
        pacerState.isActive = true;
        pacerState.isPaused = false;
        pacerState.qStartTime = Date.now();
        pacerState.elapsedQSeconds = 0;
    }

    let curQElapsed = pacerState.elapsedQSeconds;
    if (pacerState.qStartTime > 0) {
        curQElapsed += Math.floor((Date.now() - pacerState.qStartTime) / 1000);
    }
    pacerState.questionTimes.push(Math.max(1, curQElapsed));

    if (pacerState.currentQ < pacerState.totalQ) {
        pacerState.currentQ += 1;
        pacerState.qStartTime = Date.now();
        pacerState.elapsedQSeconds = 0;
        playPacerBeep(880);
    } else {
        pacerState.isActive = false;
        pacerState.isFinished = true;
        playPacerBeep(1040);
    }
    savePacerState();
    renderPacerUI();
}

function voltarQuestao() {
    if (pacerState.currentQ > 1) {
        pacerState.currentQ -= 1;
        pacerState.qStartTime = Date.now();
        pacerState.elapsedQSeconds = 0;
        savePacerState();
        renderPacerUI();
    }
}

// Configuração de Questões (Pills)
document.querySelectorAll('#pills-questions .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        pacerState.totalQ = parseInt(btn.dataset.val);
        savePacerState();
        renderPacerUI();
    });
});

document.querySelectorAll('#pills-time .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        pacerState.targetSeconds = parseInt(btn.dataset.val);
        savePacerState();
        renderPacerUI();
    });
});

document.getElementById('pacer-trigger-select').addEventListener('change', (e) => {
    pacerState.triggerMode = e.target.value;
    savePacerState();
});

document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    pacerState.soundEnabled = !pacerState.soundEnabled;
    savePacerState();
    renderPacerUI();
});

// Sincronização em tempo real via Storage (se o Q-Bank avançar via content.js)
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.pacer_state && changes.pacer_state.newValue) {
            pacerState = Object.assign(pacerState, changes.pacer_state.newValue);
            renderPacerUI();
        }
    }
});

// =========================================================================
// BOTÃO: RODAR PACER PELO SITE (JANELA COMPLETA)
// =========================================================================
document.getElementById('btn-open-site-pacer').addEventListener('click', () => {
    // Abre o Pacer no site oficial em janela flutuante dedicada
    window.open("https://usmle-study-tools.vercel.app/pacer", "PacerWindow", "width=540,height=880");
});

// =========================================================================
// VOZ & LEITURA
// =========================================================================
let allVoices = [];

function carregarVozes() {
    allVoices = speechSynthesis.getVoices();
    if (allVoices.length === 0) return;

    chrome.storage.local.get(['vozEscolhida', 'showAllVoices', 'autoRead'], function(result) {
        document.getElementById('show-all-voices').checked = result.showAllVoices || false;
        document.getElementById('auto-read').checked = result.autoRead || false;

        const select = document.getElementById('voice-select');
        select.innerHTML = '';

        const optDefault = document.createElement('option');
        optDefault.value = 'default';
        optDefault.textContent = 'Automático (Voz Natural)';
        select.appendChild(optDefault);

        const nomesDesejados = ["Ava", "Andrew", "Emma", "Brian"];
        let vozesPremium = [];

        allVoices.forEach((voice) => {
            const isPremium = nomesDesejados.some(nome => voice.name.includes(nome)) && 
                              voice.name.includes('Multilingual') && 
                              voice.name.includes('Online') && 
                              voice.name.includes('Natural');
            if (isPremium) vozesPremium.push(voice);
        });

        let vozesParaMostrar = (result.showAllVoices || vozesPremium.length === 0) ? allVoices : vozesPremium;

        if (result.vozEscolhida && result.vozEscolhida !== 'default') {
            const vozSalvaExiste = allVoices.find(v => v.name === result.vozEscolhida);
            if (vozSalvaExiste && !vozesParaMostrar.includes(vozSalvaExiste)) {
                vozesParaMostrar.push(vozSalvaExiste);
            }
        }

        vozesParaMostrar.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = voice.name;
            select.appendChild(option);
        });

        select.value = result.vozEscolhida ? result.vozEscolhida : 'default';
    });
}

speechSynthesis.onvoiceschanged = carregarVozes;
carregarVozes();

document.getElementById('voice-select').addEventListener('change', (e) => chrome.storage.local.set({ vozEscolhida: e.target.value }));
document.getElementById('show-all-voices').addEventListener('change', (e) => chrome.storage.local.set({ showAllVoices: e.target.checked }, () => carregarVozes()));
document.getElementById('auto-read').addEventListener('change', (e) => chrome.storage.local.set({ autoRead: e.target.checked }));

const speedInput = document.getElementById('voice-speed');
const speedVal = document.getElementById('speed-val');
speedInput.addEventListener('input', (e) => {
    speedVal.textContent = e.target.value + 'x';
    chrome.storage.local.set({ velocidadeVoz: e.target.value });
});

function enviarAcaoAba(acao) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { comando: acao });
    });
}

document.getElementById('btn-mic').addEventListener('click', () => enviarAcaoAba('ativar_mic'));
document.getElementById('btn-mic-off').addEventListener('click', () => enviarAcaoAba('desativar_mic'));

// Salvar Atalhos & Preferências
document.getElementById('btn-salvar').addEventListener('click', () => {
    const config = {
        kbProx: document.getElementById('kb-prox').value.toLowerCase().trim(),
        kbAnt: document.getElementById('kb-ant').value.toLowerCase().trim(),
        kbSubmit: document.getElementById('kb-submit').value.toLowerCase().trim(),
        kbLer: document.getElementById('kb-ler').value.toLowerCase().trim(),
        kbExp: document.getElementById('kb-exp').value.toLowerCase().trim(),
        kbPlay: document.getElementById('kb-play').value.toLowerCase().trim(),
        kbStop: document.getElementById('kb-stop').value.toLowerCase().trim()
    };
    chrome.storage.local.set(config, () => {
        const btn = document.getElementById('btn-salvar');
        btn.textContent = "✓ Preferências Salvas!";
        btn.style.background = "#10b981";
        setTimeout(() => {
            btn.textContent = "Salvar Preferências";
            btn.style.background = "#1e293b";
        }, 2000);
    });
});

// Carrega configurações salvas de atalhos e pacer ao abrir o popup
chrome.storage.local.get(null, (res) => {
    if (res.kbProx) document.getElementById('kb-prox').value = res.kbProx;
    if (res.kbAnt) document.getElementById('kb-ant').value = res.kbAnt;
    if (res.kbSubmit) document.getElementById('kb-submit').value = res.kbSubmit;
    if (res.kbLer) document.getElementById('kb-ler').value = res.kbLer;
    if (res.kbExp) document.getElementById('kb-exp').value = res.kbExp;
    if (res.kbPlay) document.getElementById('kb-play').value = res.kbPlay;
    if (res.kbStop) document.getElementById('kb-stop').value = res.kbStop;

    if (res.velocidadeVoz) {
        speedInput.value = res.velocidadeVoz;
        speedVal.textContent = res.velocidadeVoz + 'x';
    }

    loadPacerState();
});
`;

export const contentJs = `// =========================================================================
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

        const now = Date.now();
        if (shouldAdvance) {
            let curQElapsed = pState.elapsedQSeconds || 0;
            if (pState.qStartTime > 0) {
                curQElapsed += Math.floor((now - pState.qStartTime) / 1000);
            }
            pState.questionTimes = pState.questionTimes || [];
            pState.questionTimes.push(Math.max(1, curQElapsed));

            if (pState.currentQ < pState.totalQ) {
                pState.currentQ += 1;
                pState.qStartTime = now;
                pState.elapsedQSeconds = 0;
                chrome.storage.local.set({ pacer_state: pState });
                if (pState.soundEnabled) {
                    tocarBipPacer(880);
                }
            } else {
                pState.isActive = false;
                pState.isFinished = true;
                chrome.storage.local.set({ pacer_state: pState });
                if (pState.soundEnabled) {
                    tocarBipPacer(1040);
                }
            }
        } else if (shouldGoBack && pState.currentQ > 1) {
            pState.currentQ -= 1;
            pState.qStartTime = now;
            pState.elapsedQSeconds = 0;
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
styleCustom.innerHTML = \`
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
\`;
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
    bar.innerHTML = \`
        <div id="tts-drag-handle" title="Arraste para mover">⠿</div>
        <button id="tts-btn-prev" title="Frase Anterior">⏮️</button>
        <button id="tts-btn-play" title="Play / Pause">⏸️</button>
        <button id="tts-btn-stop" title="Parar Leitura">⏹️</button>
        <button id="tts-btn-next" title="Próxima Frase">⏭️</button>
        <button id="tts-btn-close" title="Minimizar">✖</button>
    \`;
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
            const parts = textNode.nodeValue.split(/(\\s+)/);
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
            if (!textToSpeak.match(/\\s$/)) { textToSpeak += " "; fragment.appendChild(document.createTextNode(" ")); }
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
    const containerQuestao = document.querySelector('.max-w-5xl div.\\\\!text-ink');
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
    if (!encontrou) falarFeedback(\`Alternativa \${letraDesejada.toUpperCase()} não encontrada.\`);
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
            const prefixes = configAtual.cmdSel.split(',').map(c => c.trim().toLowerCase().replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).filter(c => c);
            if(prefixes.length > 0) {
                const regexAlternativa = new RegExp(\`(\${prefixes.join('|')})\\\\s+([a-h])\`);
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
});`;

export const readmeTxt = `===========================================================
ASSISTENTE Q-BANK & PACER - VERSÃO 1.4
===========================================================

Novidades da Versão 1.4:
- O Question Pacer agora roda DIRETAMENTE na janela de Popup da extensão, sem precisar abrir nova aba ou janela!
- Mantida a função de rodar o Pacer em tela cheia pelo site ("🌐 Abrir no Site").
- Identidade visual unificada com o design oficial do site.

COMO INSTALAR / ATUALIZAR:
1. Descompacte o arquivo zip baixado em uma pasta fixa no seu computador 
   (ex: Meus Documentos/Extensao-USMLE).
2. Abra o Google Chrome, Edge ou Brave.
3. Digite na barra de endereços: chrome://extensions
4. Ative a chave "Modo do desenvolvedor" no canto superior direito.
5. Clique em "Carregar sem compactação" e selecione a pasta descompactada.
6. Pronto! Ao clicar no ícone da extensão, o Pacer abrirá na hora!
`;
