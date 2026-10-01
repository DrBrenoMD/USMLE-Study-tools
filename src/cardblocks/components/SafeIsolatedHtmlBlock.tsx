import React, { useRef, useEffect, useState, useId } from 'react';
import { Code, RefreshCw, Trash2, Edit2, ShieldCheck, Play, Maximize2, Minimize2 } from 'lucide-react';

interface SafeIsolatedHtmlBlockProps {
  html: string;
  css?: string;
  js?: string;
  title?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const SafeIsolatedHtmlBlock: React.FC<SafeIsolatedHtmlBlockProps> = ({
  html,
  css = '',
  js = '',
  title = 'Bloco de HTML Seguro',
  onEdit,
  onDelete,
  className = ''
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blockId = useId();
  const [iframeHeight, setIframeHeight] = useState<number>(180);
  const [key, setKey] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escuta mensagem de redimensionamento do iframe para auto-ajustar altura
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'safe-block-resize' && event.data.blockId === blockId) {
        if (typeof event.data.height === 'number' && event.data.height > 20) {
          setIframeHeight(Math.min(1200, Math.max(120, event.data.height)));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [blockId]);

  // Gera o documento seguro com CSS e JS isolados
  const generateSrcDoc = () => {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Reset básico isolado dentro do iframe */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 12px;
      background: transparent;
      color: #1e293b;
      line-height: 1.5;
    }
    @media (prefers-color-scheme: dark) {
      body {
        color: #f1f5f9;
      }
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: rgba(148, 163, 184, 0.15);
      font-weight: bold;
    }
    input, select, button, textarea {
      font-family: inherit;
      font-size: 13px;
    }
    button {
      padding: 6px 12px;
      border-radius: 6px;
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: #1d4ed8;
    }
    /* Estilos customizados fornecidos pelo usuário */
    ${css || ''}
  </style>
</head>
<body>
  <div id="safe-isolated-root">
    ${html || ''}
  </div>

  <script>
    // Envia altura automaticamente para o pai
    function notifyHeight() {
      const root = document.getElementById('safe-isolated-root') || document.body;
      const h = Math.ceil(root.getBoundingClientRect().height) + 28;
      try {
        window.parent.postMessage({
          type: 'safe-block-resize',
          blockId: '${blockId}',
          height: h
        }, '*');
      } catch (e) {}
    }

    window.addEventListener('load', notifyHeight);
    window.addEventListener('resize', notifyHeight);
    if (window.MutationObserver) {
      const obs = new MutationObserver(notifyHeight);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    setTimeout(notifyHeight, 60);
    setTimeout(notifyHeight, 300);

    // Executa o script do usuário com captura segura de erros
    try {
      ${js || ''}
    } catch (error) {
      console.warn("Aviso no script do bloco HTML:", error);
      const errEl = document.createElement('div');
      errEl.style.cssText = "color: #dc2626; font-size: 11px; margin-top: 8px; padding: 6px; background: #fee2e2; border-radius: 4px; border: 1px solid #f87171;";
      errEl.innerText = "Erro no Script do Bloco: " + error.message;
      document.body.appendChild(errEl);
    }
  </script>
</body>
</html>
    `;
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden my-4 transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl flex flex-col' : className
      }`}
    >
      {/* Barra de título do bloco */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Code className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white truncate">{title}</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3 h-3" />
            <span>Sandbox Isolado</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setKey(k => k + 1)}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors"
            title="Recarregar Bloco"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors"
            title={isFullscreen ? 'Restaurar Tamanho' : 'Expandir Bloco'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors"
              title="Editar HTML / CSS / JS"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Remover Bloco"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Container com Iframe sandboxado */}
      <div className={`w-full overflow-hidden bg-white dark:bg-gray-900 ${isFullscreen ? 'flex-1' : ''}`}>
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={generateSrcDoc()}
          title={title}
          sandbox="allow-scripts"
          className="w-full border-0 block"
          style={{
            height: isFullscreen ? '100%' : `${iframeHeight}px`,
            minHeight: '80px',
            backgroundColor: 'transparent'
          }}
        />
      </div>
    </div>
  );
};
