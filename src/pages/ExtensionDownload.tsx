import React, { useState } from 'react';
import { 
  Download, 
  Chrome, 
  Mic, 
  Activity, 
  Headphones, 
  Keyboard, 
  CheckCircle2, 
  Copy, 
  FileCode, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { downloadExtensionZip } from '../utils/downloadExtension';
import { 
  EXTENSION_VERSION, 
  manifestJson, 
  contentJs, 
  popupHtml, 
  popupJs 
} from '../extension_source/extensionFiles';
import { Link } from 'react-router-dom';

export default function ExtensionDownload() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [activeFileTab, setActiveFileTab] = useState<'manifest' | 'content' | 'popupHtml' | 'popupJs'>('content');
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadExtensionZip();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 4000);
    } catch (err) {
      console.error('Erro ao gerar o zip da extensão:', err);
    } finally {
      setDownloading(false);
    }
  };

  const getActiveCode = () => {
    switch (activeFileTab) {
      case 'manifest': return manifestJson;
      case 'content': return contentJs;
      case 'popupHtml': return popupHtml;
      case 'popupJs': return popupJs;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Header Hero Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Extensão Oficial • Versão {EXTENSION_VERSION}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Assistente de Questões & Pacer
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">
                Leitura de enunciados em voz alta, seleção de alternativas por voz, atalhos inteligentes e sincronização automática direta com o <strong>Question Pacer</strong> no UWorld e Amboss.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 min-w-[240px]">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold shadow-md hover:shadow-lg transition-all transform active:scale-98 disabled:opacity-75 cursor-pointer"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gerando .ZIP...</span>
                  </>
                ) : downloaded ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    <span>Baixado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Baixar Extensão (.zip)</span>
                  </>
                )}
              </button>

              <div className="text-center text-[11px] text-gray-400">
                Chrome, Edge, Brave, Opera
              </div>
            </div>
          </div>
        </div>

        {/* Principais Recursos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-xl shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Pacer no Popup & Site</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Roda diretamente na janela do popup sem abrir janelas extras, ou em tela cheia pelo site com sincronização automática.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-xl shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Comandos de Voz</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Diga &quot;próxima&quot;, &quot;marcar A&quot;, &quot;ler questão&quot; ou &quot;enviar&quot; com reconhecimento em tempo real.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-xl shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800">
              <Headphones className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Leitura Natural</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Leitura de enunciados, alternativas e objetivos com vozes neurais e destaque de palavras na tela.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-xl shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800">
              <Keyboard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Atalhos Customizáveis</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Controle navegação e áudio diretamente pelo teclado com combinações práticas como Alt+N e Alt+Enter.
            </p>
          </div>
        </div>

        {/* Guia de Instalação Passo a Passo */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Chrome className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-gray-900 dark:text-white">Como Instalar no seu Navegador</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Leva menos de 1 minuto e só precisa ser feito uma vez.</p>
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar .zip
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3.5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Descompacte o arquivo</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Clique no botão azul acima para baixar o arquivo <code>Assistente-UWorld-Pacer.zip</code> e extraia seu conteúdo em uma pasta de sua preferência.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">2</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Abra a página de Extensões</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Na barra de endereços do Chrome, digite <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px]">chrome://extensions</code> e tecle Enter (no Edge use <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px]">edge://extensions</code>).
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">3</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Ative o Modo do Desenvolvedor</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  No canto superior direito da página de extensões, ative a chavinha <strong>Modo do desenvolvedor</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">4</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Carregar sem compactação</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Clique no botão <strong>Carregar sem compactação</strong> (canto superior esquerdo) e selecione a pasta onde você descompactou os arquivos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transparência e Visualizador de Código */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-gray-500" />
              <h2 className="font-bold text-base text-gray-900 dark:text-white">Código-Fonte dos Arquivos</h2>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setActiveFileTab('content')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeFileTab === 'content' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  content.js
                </button>
                <button
                  onClick={() => setActiveFileTab('popupHtml')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeFileTab === 'popupHtml' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  popup.html
                </button>
                <button
                  onClick={() => setActiveFileTab('popupJs')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeFileTab === 'popupJs' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  popup.js
                </button>
                <button
                  onClick={() => setActiveFileTab('manifest')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeFileTab === 'manifest' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  manifest.json
                </button>
              </div>

              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto max-h-80 border border-gray-800">
              <code>{getActiveCode()}</code>
            </pre>
          </div>
        </div>

        {/* Link para voltar ao Pacer */}
        <div className="flex items-center justify-between pt-2">
          <Link
            to="/pacer"
            className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Activity className="w-4 h-4" />
            <span>Ir para o Question Pacer</span>
          </Link>
          <Link
            to="/"
            className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Voltar para o Início
          </Link>
        </div>

      </div>
    </div>
  );
}
