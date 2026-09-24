import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Zap,
  Download,
  ExternalLink,
  X,
  Radio,
  Clock,
  ShieldCheck,
  EyeOff
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { downloadExtensionZip } from '../../utils/downloadExtension';

interface QBankDiagnosticModalProps {
  onClose: () => void;
}

export const QBankDiagnosticModal: React.FC<QBankDiagnosticModalProps> = ({ onClose }) => {
  const { questionBanks, questions } = useStore();
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'timeout'>('idle');
  const [lastSyncData, setLastSyncData] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('last_synced_question') || localStorage.getItem('pending_question_import');
      if (stored) {
        setLastSyncData(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const handleTestPing = () => {
    setPingStatus('testing');
    const channel = new BroadcastChannel('usmle_qbank_sync');
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        setPingStatus('timeout');
        channel.close();
      }
    }, 2500);

    channel.onmessage = (event) => {
      if (event.data && (event.data.type === 'QBANK_QUESTION_SYNC' || event.data.type === 'PONG')) {
        responded = true;
        clearTimeout(timeout);
        setPingStatus('success');
        channel.close();
      }
    };

    channel.postMessage({ type: 'PING', timestamp: Date.now() });
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await downloadExtensionZip();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Diagnóstico de Captura & Sincronização
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verifique por que as questões podem não estar sendo importadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm">
          {/* Status Geral */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Canal de Sincronia</span>
                <Radio className="w-3.5 h-3.5 text-green-500 animate-pulse" />
              </div>
              <div className="font-bold text-green-600 dark:text-green-400 mt-1">Ativo e Escutando</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Broadcast + HTTP Queue</div>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Total de Questões</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="font-bold text-gray-900 dark:text-white mt-1">{questions.length} questões</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Em {questionBanks.length} bancos</div>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Último Recebimento</span>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="font-bold text-gray-900 dark:text-white mt-1">
                {lastSyncData?.questionId ? `QID: ${lastSyncData.questionId}` : 'Nenhum recente'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {lastSyncData?.system || 'Aguardando captura'}
              </div>
            </div>
          </div>

          {/* Teste de Ping com a Extensão */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-blue-900 dark:text-blue-200 text-xs sm:text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Testar Comunicação com a Aba da Extensão</span>
              </div>
              <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                Envia um sinal em tempo real para verificar se a extensão está ativa no navegador.
              </p>
            </div>
            <button
              onClick={handleTestPing}
              disabled={pingStatus === 'testing'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin' : ''}`} />
              <span>{pingStatus === 'testing' ? 'Testando...' : 'Testar Comunicação'}</span>
            </button>
          </div>

          {pingStatus === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span><b>Comunicação bem-sucedida!</b> O navegador e a extensão estão conectados.</span>
            </div>
          )}

          {pingStatus === 'timeout' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Nenhum retorno recebido. Verifique se a extensão está aberta e atualizada na aba do Q-Bank.</span>
            </div>
          )}

          {/* Checklist de Diagnóstico: Por que os dados não foram importados? */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Checklist de Requisitos Obrigatórios:
            </h3>

            <div className="space-y-2">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1 flex-1">
                  <div className="font-bold text-gray-900 dark:text-gray-100">
                    1. A questão precisa estar respondida/submetida
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    No UWorld e Amboss, o gabarito, a <b>explicação completa</b> e o <b>Educational Objective</b> ficam ocultos até que o usuário clique em <i>Submit</i>. A extensão agora bloqueia importações incompletas para não poluir o banco com questões sem gabarito ou sem explicação.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-3">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg mt-0.5">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1 flex-1">
                  <div className="font-bold text-gray-900 dark:text-gray-100">
                    2. O "System" não pode estar em "Click to Show"
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    O UWorld esconde o sistema para evitar dar spoiler sobre a patologia da questão. Você deve clicar no botão <b>"Click to Show"</b> ao lado de <i>System</i> na questão, ou clicar no botão <b>"🔍 Revelar 'Click to Show'"</b> na barra lateral flutuante da extensão.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-3">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 rounded-lg mt-0.5">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1 flex-1">
                  <div className="font-bold text-gray-900 dark:text-gray-100">
                    3. Recarregar a Extensão após atualizações
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    Se você atualizou o aplicativo ou baixou o novo ZIP da extensão, lembre-se de ir em <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-blue-500">chrome://extensions</code> e clicar no botão <b>Recarregar (⟳)</b> na extensão.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{isDownloading ? 'Gerando...' : 'Baixar Extensão Atualizada (.ZIP)'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
