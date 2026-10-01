import React, { useState, useMemo } from 'react';
import { useStore, StudyNote, NotebookArea, NotebookSystem, NotebookSubject, NotebookTopic } from '../store/useStore';
import {
  FileText,
  Printer,
  Download,
  X,
  Check,
  Layers,
  Sparkles,
  BookOpen,
  ChevronRight,
  Settings2,
  FileDown
} from 'lucide-react';
import { sanitizeHtml } from '../lib/utils';
import { format } from 'date-fns';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAreaId?: string;
  defaultNoteId?: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  defaultAreaId,
  defaultNoteId
}) => {
  const {
    studyNotebooks,
    notebookAreas,
    notebookSystems,
    notebookSubjects,
    notebookTopics,
    studyNotes,
    questions,
    cards
  } = useStore();

  const [exportScope, setExportScope] = useState<'notebook' | 'area' | 'system' | 'note'>(() => {
    if (defaultNoteId) return 'note';
    if (defaultAreaId && defaultAreaId !== 'all') return 'area';
    return 'notebook';
  });

  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => defaultAreaId || notebookAreas[0]?.id || '');
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(() => defaultNoteId || studyNotes[0]?.id || '');

  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includeAssociatedQuestions, setIncludeAssociatedQuestions] = useState(true);
  const [includeAssociatedCards, setIncludeAssociatedCards] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);

  if (!isOpen) return null;

  // Filter notes based on scope
  const targetNotes = useMemo(() => {
    if (exportScope === 'note') {
      return studyNotes.filter(n => n.id === selectedNoteId);
    }
    if (exportScope === 'system') {
      return studyNotes.filter(n => n.areaId === selectedAreaId && n.systemId === selectedSystemId);
    }
    if (exportScope === 'area') {
      return studyNotes.filter(n => n.areaId === selectedAreaId);
    }
    return studyNotes;
  }, [studyNotes, exportScope, selectedAreaId, selectedSystemId, selectedNoteId]);

  const targetAreas = useMemo(() => {
    if (exportScope === 'area' || exportScope === 'system') {
      return notebookAreas.filter(a => a.id === selectedAreaId);
    }
    if (exportScope === 'note') {
      const note = studyNotes.find(n => n.id === selectedNoteId);
      return notebookAreas.filter(a => a.id === note?.areaId);
    }
    return notebookAreas;
  }, [notebookAreas, exportScope, selectedAreaId, selectedNoteId, studyNotes]);

  // Generate complete printable HTML
  const generatePrintableHtml = () => {
    const notebookName = studyNotebooks[0]?.name || 'Caderno de Estudos';
    const nowStr = format(new Date(), 'dd/MM/yyyy HH:mm');

    // Build hierarchical document HTML
    let bodyHtml = '';

    // 1. Cover / Title
    bodyHtml += `
      <div class="print-cover">
        <h1 class="print-main-title">📚 ${notebookName}</h1>
        <p class="print-subtitle">Relatório Consolidado de Anotações e Estudos Clínicos</p>
        <div class="print-meta">
          <span><b>Gerado em:</b> ${nowStr}</span> • 
          <span><b>Total de Notas:</b> ${targetNotes.length}</span> •
          <span><b>Âmbito:</b> ${
            exportScope === 'notebook' ? 'Caderno Completo' :
            exportScope === 'area' ? `Área: ${targetAreas[0]?.name || ''}` :
            exportScope === 'system' ? 'Sistema Específico' : 'Nota Individual'
          }</span>
        </div>
      </div>
    `;

    // 2. Table of Contents
    if (includeTableOfContents && targetNotes.length > 1) {
      bodyHtml += `
        <div class="print-toc">
          <h2 class="print-toc-title">📋 Sumário do Documento</h2>
          <div class="print-toc-list">
      `;
      targetAreas.forEach(area => {
        const areaNotes = targetNotes.filter(n => n.areaId === area.id);
        if (areaNotes.length === 0) return;

        bodyHtml += `
          <div class="print-toc-area">
            <span class="print-toc-area-name" style="border-left: 4px solid ${area.color || '#3b82f6'}; padding-left: 6px;">
              <b>${area.name}</b> (${areaNotes.length} notas)
            </span>
            <ul class="print-toc-sublist">
        `;
        areaNotes.forEach(n => {
          bodyHtml += `<li>${n.icon || '📝'} ${n.title}</li>`;
        });
        bodyHtml += `</ul></div>`;
      });
      bodyHtml += `</div></div><div class="page-break"></div>`;
    }

    // 3. Hierarchical Notes Sections
    targetAreas.forEach(area => {
      const areaNotes = targetNotes.filter(n => n.areaId === area.id);
      if (areaNotes.length === 0) return;

      bodyHtml += `
        <div class="print-area-section">
          <div class="print-area-header" style="border-bottom: 2px solid ${area.color || '#3b82f6'};">
            <h2 class="print-area-title" style="color: ${area.color || '#3b82f6'};">
              ${area.name}
            </h2>
            <span class="print-badge" style="background: ${area.color || '#3b82f6'}20; color: ${area.color || '#3b82f6'};">
              ${areaNotes.length} nota(s)
            </span>
          </div>
      `;

      // Group by System
      const areaSystems = notebookSystems.filter(s => s.areaId === area.id);
      const notesWithoutSystem = areaNotes.filter(n => !n.systemId);

      // Render notes without system
      notesWithoutSystem.forEach(note => {
        bodyHtml += renderNoteBlockHtml(note);
      });

      // Render notes by system
      areaSystems.forEach(sys => {
        const sysNotes = areaNotes.filter(n => n.systemId === sys.id);
        if (sysNotes.length === 0) return;

        bodyHtml += `
          <div class="print-system-section">
            <h3 class="print-system-title">↳ Sistema: ${sys.name}</h3>
        `;

        sysNotes.forEach(note => {
          bodyHtml += renderNoteBlockHtml(note);
        });

        bodyHtml += `</div>`;
      });

      bodyHtml += `</div>`;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>${notebookName} - Exportação PDF</title>
        <style>
          @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            font-size: 13px;
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .print-cover {
            text-align: center;
            padding: 40px 20px;
            margin-bottom: 30px;
            border-bottom: 2px solid #e2e8f0;
          }
          .print-main-title {
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 8px 0;
          }
          .print-subtitle {
            font-size: 14px;
            color: #64748b;
            margin: 0 0 16px 0;
          }
          .print-meta {
            font-size: 11px;
            color: #94a3b8;
          }
          .print-toc {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
          }
          .print-toc-title {
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 12px 0;
            color: #0f172a;
          }
          .print-toc-area {
            margin-bottom: 10px;
          }
          .print-toc-area-name {
            font-size: 13px;
            color: #1e293b;
          }
          .print-toc-sublist {
            margin: 4px 0 8px 20px;
            padding: 0;
            font-size: 12px;
            color: #475569;
          }
          .print-area-section {
            margin-bottom: 40px;
          }
          .print-area-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 8px;
            margin-bottom: 20px;
          }
          .print-area-title {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
          }
          .print-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
          }
          .print-system-title {
            font-size: 15px;
            font-weight: 700;
            color: #334155;
            margin: 20px 0 12px 0;
            border-left: 3px solid #94a3b8;
            padding-left: 8px;
          }
          .print-note-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .print-note-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .print-note-title {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .print-note-tags {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          .print-tag {
            font-size: 10px;
            background: #f1f5f9;
            color: #475569;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
          .print-note-content {
            font-size: 13px;
            color: #334155;
            line-height: 1.6;
          }
          .print-note-content h1, .print-note-content h2, .print-note-content h3 {
            color: #0f172a;
            margin-top: 14px;
            margin-bottom: 6px;
          }
          .print-note-content blockquote {
            border-left: 4px solid #3b82f6;
            background: #f0f9ff;
            padding: 8px 12px;
            margin: 8px 0;
            border-radius: 4px;
            color: #0369a1;
          }
          .print-note-content pre, .print-note-content code {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            padding: 2px 4px;
          }
          .print-note-content img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 8px 0;
          }
          .print-assoc-box {
            margin-top: 14px;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 11px;
          }
          .print-assoc-questions {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1e40af;
          }
          .print-assoc-cards {
            background: #faf5ff;
            border: 1px solid #e9d5ff;
            color: #6b21a8;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;
  };

  const renderNoteBlockHtml = (note: StudyNote) => {
    // Questões vinculadas
    let assocQuestionsHtml = '';
    if (includeAssociatedQuestions && note.associatedQuestionIds && note.associatedQuestionIds.length > 0) {
      assocQuestionsHtml = `
        <div class="print-assoc-box print-assoc-questions">
          <b>🎯 Questões Associadas (${note.associatedQuestionIds.length}):</b>
          <div style="margin-top: 4px;">
            ${note.associatedQuestionIds.map(qid => {
              const qObj = questions.find(q => q.qid === qid || q.id === qid);
              return `<div style="margin-bottom: 2px;">• <b>QID: ${qid}</b> ${qObj?.educationalObjective ? ` - <i>${qObj.educationalObjective}</i>` : ''}</div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Flashcards vinculados
    let assocCardsHtml = '';
    if (includeAssociatedCards) {
      const allCardIds = Array.from(new Set([...(note.associatedCardIds || []), ...(note.embeddedFlashcardIds || [])]));
      if (allCardIds.length > 0) {
        assocCardsHtml = `
          <div class="print-assoc-box print-assoc-cards">
            <b>⚡ Flashcards Associados (${allCardIds.length}):</b>
            <div style="margin-top: 4px;">
              ${allCardIds.map(cid => {
                const cObj = cards.find(c => c.id === cid);
                return `<div style="margin-bottom: 2px;">• <b>Frente:</b> ${cObj ? cObj.front.replace(/<[^>]+>/g, '').substring(0, 80) : cid} ${cObj?.back ? `| <b>Verso:</b> ${cObj.back.replace(/<[^>]+>/g, '').substring(0, 60)}` : ''}</div>`;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    let tagsHtml = '';
    if (note.tags && note.tags.length > 0) {
      tagsHtml = `
        <div class="print-note-tags">
          ${note.tags.map(t => `<span class="print-tag">#${t}</span>`).join('')}
        </div>
      `;
    }

    return `
      <div class="print-note-card">
        <div class="print-note-header">
          <h4 class="print-note-title">${note.icon || '📝'} ${note.title || 'Sem Título'}</h4>
          <span style="font-size: 10px; color: #94a3b8;">${note.updatedAt ? format(note.updatedAt, 'dd/MM/yyyy') : ''}</span>
        </div>
        <div class="print-note-content">
          ${sanitizeHtml(note.content || '<p><i>Sem conteúdo textual.</i></p>')}
        </div>
        ${assocQuestionsHtml}
        ${assocCardsHtml}
        ${tagsHtml}
      </div>
    `;
  };

  const handlePrintPdf = () => {
    const htmlContent = generatePrintableHtml();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  const handleDownloadHtml = () => {
    const htmlContent = generatePrintableHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caderno-estudos-${format(new Date(), 'yyyy-MM-dd')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Exportar para PDF / Impressão
              </h3>
              <p className="text-xs text-gray-500">
                Gere um documento estruturado com formatação de alta resolução.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Escopo da Exportação */}
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider text-[11px]">
              1. Selecionar Escopo da Exportação:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'notebook', label: 'Todo o Caderno', icon: '📚' },
                { id: 'area', label: 'Área Específica', icon: '🗂️' },
                { id: 'system', label: 'Sistema / Subárea', icon: '↳' },
                { id: 'note', label: 'Nota Atual', icon: '📝' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExportScope(opt.id as any)}
                  className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    exportScope === opt.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-base mb-0.5">{opt.icon}</div>
                  <div className="text-[11px] truncate">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Seletores Específicos se escopo exigir */}
          {(exportScope === 'area' || exportScope === 'system') && (
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Escolha a Área:
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {notebookAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {exportScope === 'system' && (
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Escolha o Sistema:
              </label>
              <select
                value={selectedSystemId}
                onChange={(e) => setSelectedSystemId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um sistema...</option>
                {notebookSystems.filter(s => s.areaId === selectedAreaId).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {exportScope === 'note' && (
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Escolha a Nota:
              </label>
              <select
                value={selectedNoteId}
                onChange={(e) => setSelectedNoteId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {studyNotes.map(n => (
                  <option key={n.id} value={n.id}>{n.icon || '📝'} {n.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Opções de Inclusão no Documento */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider text-[11px]">
              2. Conteúdos e Metadados do PDF:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTableOfContents}
                  onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Incluir Sumário / Índice Estruturado
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAssociatedQuestions}
                  onChange={(e) => setIncludeAssociatedQuestions(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Incluir Resumo das Questões Associadas (QID & Educational Objectives)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAssociatedCards}
                  onChange={(e) => setIncludeAssociatedCards(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Incluir Resumo dos Flashcards Associados
                </span>
              </label>
            </div>
          </div>

          {/* Resumo do Documento */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-300 font-semibold">
              Notas selecionadas para impressão:
            </span>
            <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
              {targetNotes.length} nota(s)
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Baixar arquivo HTML standalone completo"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Baixar HTML</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={targetNotes.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 disabled:opacity-40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
