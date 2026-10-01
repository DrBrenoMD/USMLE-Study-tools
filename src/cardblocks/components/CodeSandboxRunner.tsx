import React, { useState, useRef, useEffect } from 'react';
import { Code, Play, RefreshCw, Trash2, Check, Eye, EyeOff, Layers } from 'lucide-react';

interface CodeSandboxRunnerProps {
  initialHtml?: string;
  initialCss?: string;
  initialJs?: string;
  title?: string;
  onSave?: (html: string, css: string, js: string) => void;
  onDelete?: () => void;
}

export const CodeSandboxRunner: React.FC<CodeSandboxRunnerProps> = ({
  initialHtml = '<div class="card">\n  <h2>Calculadora de Osmolaridade</h2>\n  <p>2 x Na + Glicose/18 + Ureia/6</p>\n  <button onclick="calcular()">Calcular</button>\n  <div id="resultado"></div>\n</div>',
  initialCss = `.card {
  font-family: system-ui, sans-serif;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  color: #1e293b;
}
button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}
#resultado {
  margin-top: 10px;
  font-weight: bold;
  color: #059669;
}`,
  initialJs = `function calcular() {
  const osm = 2 * 140 + 90 / 18 + 24 / 6;
  document.getElementById('resultado').innerText = 'Osmolaridade Plasmática Estimada: ' + osm.toFixed(1) + ' mOsm/kg';
}`,
  title = 'Simulação / Código Interativo (HTML / CSS / JS)',
  onSave,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'css' | 'js'>('preview');
  const [htmlCode, setHtmlCode] = useState(initialHtml);
  const [cssCode, setCssCode] = useState(initialCss);
  const [jsCode, setJsCode] = useState(initialJs);
  const [runKey, setRunKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const generateSrcDoc = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
      console.error("Erro no script da nota:", err);
      const errDiv = document.createElement('div');
      errDiv.style.color = '#ef4444';
      errDiv.style.fontSize = '12px';
      errDiv.style.marginTop = '8px';
      errDiv.innerText = 'Erro: ' + err.message;
      document.body.appendChild(errDiv);
    }
  </script>
</body>
</html>
    `;
  };

  const handleSave = () => {
    setRunKey(prev => prev + 1);
    if (onSave) {
      onSave(htmlCode, cssCode, jsCode);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 my-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">{title}</h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Ambiente seguro e isolado para simulações e widgets</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-gray-200 dark:bg-gray-700/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-gray-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              Prévia
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'html'
                  ? 'bg-white dark:bg-gray-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              HTML
            </button>
            <button
              onClick={() => setActiveTab('css')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'css'
                  ? 'bg-white dark:bg-gray-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              CSS
            </button>
            <button
              onClick={() => setActiveTab('js')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'js'
                  ? 'bg-white dark:bg-gray-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              JS
            </button>
          </div>

          <button
            onClick={() => {
              setRunKey(prev => prev + 1);
              handleSave();
            }}
            className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all shadow-xs"
            title="Executar / Salvar"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Remover bloco de código"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'preview' ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-inner min-h-[160px]">
          <iframe
            key={runKey}
            ref={iframeRef}
            srcDoc={generateSrcDoc()}
            title="Code Preview Sandbox"
            sandbox="allow-scripts allow-forms"
            className="w-full min-h-[180px] border-0"
          />
        </div>
      ) : activeTab === 'html' ? (
        <div className="space-y-2">
          <textarea
            value={htmlCode}
            onChange={(e) => {
              setHtmlCode(e.target.value);
              if (onSave) onSave(e.target.value, cssCode, jsCode);
            }}
            rows={7}
            className="w-full p-3 font-mono text-xs bg-gray-950 text-cyan-300 border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="<div>HTML da nota...</div>"
          />
        </div>
      ) : activeTab === 'css' ? (
        <div className="space-y-2">
          <textarea
            value={cssCode}
            onChange={(e) => {
              setCssCode(e.target.value);
              if (onSave) onSave(htmlCode, e.target.value, jsCode);
            }}
            rows={7}
            className="w-full p-3 font-mono text-xs bg-gray-950 text-pink-300 border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder=".estilo { color: blue; }"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={jsCode}
            onChange={(e) => {
              setJsCode(e.target.value);
              if (onSave) onSave(htmlCode, cssCode, e.target.value);
            }}
            rows={7}
            className="w-full p-3 font-mono text-xs bg-gray-950 text-amber-300 border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="// JavaScript interativo da nota"
          />
        </div>
      )}
    </div>
  );
};
