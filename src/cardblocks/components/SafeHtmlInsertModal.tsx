import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Code, Play, RefreshCw, X, Check, Sparkles, ShieldCheck, Layers, HelpCircle } from 'lucide-react';

interface SafeHtmlInsertModalProps {
  initialTitle?: string;
  initialHtml?: string;
  initialCss?: string;
  initialJs?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; html: string; css: string; js: string }) => void;
}

const HTML_TEMPLATES = [
  {
    name: 'Calculadora Osmolaridade',
    title: 'Calculadora de Osmolaridade Plasmática',
    html: `<div class="calc-container">
  <h3>⚡ Calculadora de Osmolaridade</h3>
  <p class="formula">Fórmula: 2 x Na + Glicose/18 + Ureia/6</p>
  <div class="input-group">
    <label>Sódio (mEq/L):</label>
    <input type="number" id="sodio" value="140" />
  </div>
  <div class="input-group">
    <label>Glicose (mg/dL):</label>
    <input type="number" id="glicose" value="90" />
  </div>
  <div class="input-group">
    <label>Ureia (mg/dL):</label>
    <input type="number" id="ureia" value="24" />
  </div>
  <button onclick="calcular()">Calcular Osmolaridade</button>
  <div id="resultado" class="result-box">Clique no botão para calcular</div>
</div>`,
    css: `.calc-container {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-family: inherit;
}
.formula {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 12px;
}
.input-group {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.input-group input {
  width: 90px;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
button {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}
button:hover { background: #1d4ed8; }
.result-box {
  margin-top: 12px;
  padding: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-weight: bold;
  color: #1e40af;
  text-align: center;
}`,
    js: `function calcular() {
  const na = parseFloat(document.getElementById('sodio').value) || 0;
  const gli = parseFloat(document.getElementById('glicose').value) || 0;
  const ur = parseFloat(document.getElementById('ureia').value) || 0;
  const osm = 2 * na + (gli / 18) + (ur / 6);
  const el = document.getElementById('resultado');
  el.innerText = 'Osmolaridade Estimada: ' + osm.toFixed(1) + ' mOsm/kg (Normal: 275-295)';
  el.style.color = (osm >= 275 && osm <= 295) ? '#15803d' : '#b91c1c';
}`
  },
  {
    name: 'Tabela Comparativa',
    title: 'Tabela: Choque Hipovolêmico vs Cardiogênico vs Séptico',
    html: `<table>
  <thead>
    <tr>
      <th>Tipo de Choque</th>
      <th>Pré-Carga (PCWP)</th>
      <th>Débito Cardíaco (DC)</th>
      <th>RVS</th>
      <th>SvO2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Hipovolêmico</b></td>
      <td>⬇️ Diminuída</td>
      <td>⬇️ Diminuído</td>
      <td>⬆️ Aumentada</td>
      <td>⬇️ Baixa</td>
    </tr>
    <tr>
      <td><b>Cardiogênico</b></td>
      <td>⬆️ Aumentada</td>
      <td>⬇️ Diminuído</td>
      <td>⬆️ Aumentada</td>
      <td>⬇️ Baixa</td>
    </tr>
    <tr>
      <td><b>Distributivo (Séptico)</b></td>
      <td>⬇️/Normal</td>
      <td>⬆️ Elevado (Hiper)</td>
      <td>⬇️ Diminuída</td>
      <td>⬆️ Alta</td>
    </tr>
  </tbody>
</table>`,
    css: `table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 8px 12px;
  text-align: left;
}
th {
  background: #f1f5f9;
  font-weight: bold;
  color: #1e293b;
}
tr:nth-child(even) { background: #f8fafc; }
tr:hover { background: #f1f5f9; }`,
    js: `// Tabela interativa com realce de linha ao clicar
document.querySelectorAll('tr').forEach(r => {
  r.addEventListener('click', () => {
    document.querySelectorAll('tr').forEach(other => other.style.outline = 'none');
    r.style.outline = '2px solid #3b82f6';
  });
});`
  },
  {
    name: 'Escala de Glasgow',
    title: 'Escala de Coma de Glasgow (ECG-P)',
    html: `<div class="glasgow-card">
  <h3>🧠 Escala de Coma de Glasgow</h3>
  <div class="row">
    <label>Abertura Ocular (1-4):</label>
    <select id="ao" onchange="calcGlasgow()">
      <option value="4">4 - Espontânea</option>
      <option value="3">3 - Ao estímulo verbal</option>
      <option value="2">2 - Ao estímulo de pressão</option>
      <option value="1">1 - Ausente</option>
    </select>
  </div>
  <div class="row">
    <label>Resposta Verbal (1-5):</label>
    <select id="rv" onchange="calcGlasgow()">
      <option value="5">5 - Orientada</option>
      <option value="4">4 - Confusa</option>
      <option value="3">3 - Palavras inapropriadas</option>
      <option value="2">2 - Sons ininteligíveis</option>
      <option value="1">1 - Ausente</option>
    </select>
  </div>
  <div class="row">
    <label>Resposta Motora (1-6):</label>
    <select id="rm" onchange="calcGlasgow()">
      <option value="6">6 - Obedece a comandos</option>
      <option value="5">5 - Localiza o estímulo</option>
      <option value="4">4 - Flexão normal (retirada)</option>
      <option value="3">3 - Flexão anormal (decorticação)</option>
      <option value="2">2 - Extensão (descerebração)</option>
      <option value="1">1 - Ausente</option>
    </select>
  </div>
  <div id="g-score" class="score-banner">Score ECG: 15 (Normal)</div>
</div>`,
    css: `.glasgow-card {
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
}
.row {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
select {
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
}
.score-banner {
  margin-top: 12px;
  padding: 10px;
  background: #10b981;
  color: white;
  border-radius: 8px;
  font-weight: bold;
  text-align: center;
}`,
    js: `function calcGlasgow() {
  const ao = parseInt(document.getElementById('ao').value, 10);
  const rv = parseInt(document.getElementById('rv').value, 10);
  const rm = parseInt(document.getElementById('rm').value, 10);
  const total = ao + rv + rm;
  const b = document.getElementById('g-score');
  let desc = 'Trauma Leve (13-15)';
  let bg = '#10b981';
  if (total <= 8) {
    desc = 'Trauma Grave (<= 8) - Intubação indicada!';
    bg = '#ef4444';
  } else if (total <= 12) {
    desc = 'Trauma Moderado (9-12)';
    bg = '#f59e0b';
  }
  b.innerText = 'Score ECG: ' + total + ' • ' + desc;
  b.style.backgroundColor = bg;
}`
  }
];

export const SafeHtmlInsertModal: React.FC<SafeHtmlInsertModalProps> = ({
  initialTitle = 'Bloco de HTML Interativo',
  initialHtml = '',
  initialCss = '',
  initialJs = '',
  isOpen,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState(initialTitle || 'Bloco de HTML Interativo');
  const [htmlCode, setHtmlCode] = useState(initialHtml || '<div class="meu-bloco">\n  <h3>Título do Bloco</h3>\n  <p>Conteúdo HTML seguro...</p>\n</div>');
  const [cssCode, setCssCode] = useState(initialCss || '.meu-bloco { padding: 12px; background: #f8fafc; border-radius: 8px; }');
  const [jsCode, setJsCode] = useState(initialJs || '// JavaScript interativo executado em ambiente isolado (sandbox)');
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');
  const [previewKey, setPreviewKey] = useState(0);

  if (!isOpen) return null;

  const generatePreviewSrcDoc = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 12px;
      color: #1e293b;
      line-height: 1.5;
    }
    ${cssCode}
  </style>
</head>
<body>
  ${htmlCode}
  <script>
    try {
      ${jsCode}
    } catch (err) {
      console.error(err);
      const div = document.createElement('div');
      div.style.cssText = "color:#dc2626;font-size:11px;margin-top:8px;padding:6px;background:#fee2e2;border-radius:4px;";
      div.innerText = "Erro: " + err.message;
      document.body.appendChild(div);
    }
  </script>
</body>
</html>
    `;
  };

  const handleApplyTemplate = (tmpl: typeof HTML_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setHtmlCode(tmpl.html);
    setCssCode(tmpl.css);
    setJsCode(tmpl.js);
    setPreviewKey(k => k + 1);
  };

  const handleSave = () => {
    onSave({
      title: title.trim() || 'Bloco HTML Seguro',
      html: htmlCode,
      css: cssCode,
      js: jsCode
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>Inserir Bloco de HTML Seguro (Iframe Sandbox)</span>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Isolamento Total
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Seu CSS e JavaScript são executados com sandbox seguro, sem afetar o layout ou a integridade da aplicação.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Título e Modelos Rápidos */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Título do Bloco / Identificador:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Tabela Comparativa de Bloqueadores Beta"
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            {/* Modelos prontos */}
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Carregar Modelo Pronto:</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {HTML_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    + {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duas colunas: Editor de Código à esquerda, Preview Sandboxed à direita */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Editor de Código */}
            <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-950">
              {/* Tab Selector */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('html')}
                    className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-colors ${
                      activeTab === 'html'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('css')}
                    className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-colors ${
                      activeTab === 'css'
                        ? 'bg-pink-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    CSS
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('js')}
                    className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-colors ${
                      activeTab === 'js'
                        ? 'bg-amber-600 text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    JS
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewKey(k => k + 1)}
                  className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[11px] flex items-center gap-1 font-semibold"
                  title="Atualizar prévia"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Testar</span>
                </button>
              </div>

              {activeTab === 'html' && (
                <textarea
                  value={htmlCode}
                  onChange={(e) => {
                    setHtmlCode(e.target.value);
                  }}
                  rows={12}
                  className="w-full p-3 font-mono text-xs bg-gray-950 text-cyan-300 border-0 focus:outline-none resize-none leading-relaxed"
                  placeholder="<div>Insira suas tags HTML aqui...</div>"
                />
              )}

              {activeTab === 'css' && (
                <textarea
                  value={cssCode}
                  onChange={(e) => {
                    setCssCode(e.target.value);
                  }}
                  rows={12}
                  className="w-full p-3 font-mono text-xs bg-gray-950 text-pink-300 border-0 focus:outline-none resize-none leading-relaxed"
                  placeholder=".classe { color: blue; }"
                />
              )}

              {activeTab === 'js' && (
                <textarea
                  value={jsCode}
                  onChange={(e) => {
                    setJsCode(e.target.value);
                  }}
                  rows={12}
                  className="w-full p-3 font-mono text-xs bg-gray-950 text-amber-300 border-0 focus:outline-none resize-none leading-relaxed"
                  placeholder="// Código JavaScript isolado..."
                />
              )}
            </div>

            {/* Prévia Segura (Sandbox Iframe) */}
            <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                  <span>Prévia em Tempo Real (Sandbox)</span>
                </span>
                <span className="text-[10px] text-gray-400">sandbox="allow-scripts"</span>
              </div>
              <div className="flex-1 min-h-[260px] bg-white dark:bg-gray-900">
                <iframe
                  key={previewKey}
                  srcDoc={generatePreviewSrcDoc()}
                  title="Live Sandbox Preview"
                  sandbox="allow-scripts"
                  className="w-full h-full min-h-[260px] border-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Inserir na Nota</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
