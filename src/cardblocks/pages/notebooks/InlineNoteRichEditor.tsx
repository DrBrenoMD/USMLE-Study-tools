import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Palette,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Code,
  Link as LinkIcon,
  Save,
  X,
  Sparkles,
  ChevronDown,
  Layers,
  BookOpen,
  Volume2,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Brackets,
  ShieldCheck
} from 'lucide-react';
import { cn, sanitizeHtml, extractNextClozeIndex } from '../../lib/utils';
import { SafeHtmlInsertModal } from '../../components/SafeHtmlInsertModal';

interface InlineNoteRichEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const TEXT_COLORS = [
  { name: 'Padrão', color: 'inherit' },
  { name: 'Azul', color: '#2563eb' },
  { name: 'Vermelho', color: '#dc2626' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Âmbar / Laranja', color: '#d97706' },
  { name: 'Roxo', color: '#9333ea' },
  { name: 'Rosa', color: '#db2777' },
  { name: 'Ciano', color: '#0891b2' },
  { name: 'Cinza', color: '#64748b' }
];

const HIGHLIGHT_COLORS = [
  { name: 'Nenhum', color: 'transparent' },
  { name: 'Amarelo', color: '#fef08a' },
  { name: 'Verde', color: '#bbf7d0' },
  { name: 'Azul', color: '#bfdbfe' },
  { name: 'Rosa', color: '#fbcfe8' },
  { name: 'Roxo', color: '#e9d5ff' },
  { name: 'Laranja', color: '#fed7aa' }
];

export const InlineNoteRichEditor: React.FC<InlineNoteRichEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
  placeholder = 'Comece a digitar sua nota estruturada...',
  autoFocus = true
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(initialContent || '');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showHeadings, setShowHeadings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSafeHtmlModal, setShowSafeHtmlModal] = useState(false);
  const [showClozeModal, setShowClozeModal] = useState(false);
  const [clozeWord, setClozeWord] = useState('');
  const [clozeHint, setClozeHint] = useState('');

  // Debounced auto-save timer ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const insertCloze = useCallback(() => {
    const sel = window.getSelection();
    let text = '';
    const currentHtml = editorRef.current?.innerHTML || content;
    const nextIdx = extractNextClozeIndex(currentHtml);
    if (sel && sel.toString().trim()) {
      text = sel.toString().trim();
      exec('insertHTML', `{{c${nextIdx}::${text}}}`);
    } else {
      setShowClozeModal(true);
    }
  }, [content]);

  const handleConfirmCloze = (word: string, hint: string) => {
    if (!word.trim()) return;
    const currentHtml = editorRef.current?.innerHTML || content;
    const nextIdx = extractNextClozeIndex(currentHtml);
    const tag = hint.trim() ? `{{c${nextIdx}::${word.trim()}::${hint.trim()}}}` : `{{c${nextIdx}::${word.trim()}}}`;
    exec('insertHTML', tag);
    setShowClozeModal(false);
    setClozeWord('');
    setClozeHint('');
  };

  const handleInsertSafeHtml = (data: { title: string; html: string; css: string; js: string }) => {
    const blockPayload = `
<div class="safe-html-embed my-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" contenteditable="false" style="user-select:none;">
  <div style="font-size:11px;font-weight:bold;color:#4f46e5;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
    <span>⚡ Bloco HTML Seguro:</span> <span>${data.title}</span>
  </div>
  <iframe srcdoc="<!DOCTYPE html><html><head><meta charset='utf-8'><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}body{font-family:sans-serif;padding:12px;background:transparent;color:#1e293b;}${data.css || ''}</style></head><body><div>${data.html.replace(/"/g, '&quot;')}</div><script>try{${data.js || ''}}catch(e){console.error(e);}<\/script></body></html>" sandbox="allow-scripts" style="width:100%;min-height:160px;border:none;border-radius:8px;background:transparent;"></iframe>
</div><br/>`;
    exec('insertHTML', blockPayload);
  };

  // Initialize content
  useEffect(() => {
    if (editorRef.current) {
      // If initial content is placeholder text or empty, leave it truly empty so the user can type freely
      const isPlaceholder = initialContent.includes('Comece a escrever sua nota estruturada');
      const cleanContent = isPlaceholder ? '' : initialContent;
      
      editorRef.current.innerHTML = cleanContent;
      setContent(cleanContent);

      if (autoFocus) {
        editorRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, []);

  // Trigger debounced auto-save on content change
  const triggerAutoSave = useCallback((newHtml: string) => {
    setSaveStatus('saving');
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      onSave(newHtml);
      setSaveStatus('saved');
    }, 450);
  }, [onSave]);

  // Clean up on unmount and save final state
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      setContent(newHtml);
      triggerAutoSave(newHtml);
    }
  };

  const handleBlur = () => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      onSave(currentHtml);
      setSaveStatus('saved');
    }
  };

  const exec = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      const newHtml = editorRef.current.innerHTML;
      setContent(newHtml);
      triggerAutoSave(newHtml);
    }
  };

  const setTextColor = (color: string) => {
    exec('foreColor', color);
    setShowColorPicker(false);
  };

  const setHighlightColor = (color: string) => {
    if (color === 'transparent') {
      exec('removeFormat');
    } else {
      exec('hiliteColor', color);
    }
    setShowHighlightPicker(false);
  };

  const setHeading = (tag: string) => {
    exec('formatBlock', `<${tag}>`);
    setShowHeadings(false);
  };

  // Insert interactive checkbox / to-do item
  const insertCheckbox = () => {
    const checkboxHtml = `<div class="notion-todo-item flex items-center gap-2 my-1"><input type="checkbox" class="w-4 h-4 rounded text-blue-600 cursor-pointer" /> <span>Item a verificar...</span></div><br/>`;
    exec('insertHTML', checkboxHtml);
  };

  // Insert callout / quote block
  const insertCallout = () => {
    const calloutHtml = `<blockquote class="p-3 my-2 border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 rounded-r-lg text-sm italic text-gray-800 dark:text-gray-200">💡 <b>Ponto-chave:</b> Digite aqui...</blockquote><br/>`;
    exec('insertHTML', calloutHtml);
  };

  // Insert divider
  const insertDivider = () => {
    exec('insertHorizontalRule');
  };

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleInsertImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const imgHtml = `<img src="${dataUrl}" class="max-w-full rounded-xl my-2 shadow-xs border border-gray-200 dark:border-gray-700" style="max-height: 400px;" alt="Imagem inserida" /><br/>`;
          exec('insertHTML', imgHtml);
        }
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const imgHtml = `<img src="${dataUrl}" class="max-w-full rounded-xl my-2 shadow-xs border border-gray-200 dark:border-gray-700" style="max-height: 400px;" alt="Imagem colada" /><br/>`;
                exec('insertHTML', imgHtml);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl + Shift + C for Cloze Deletion
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      insertCloze();
      return;
    }
    // Ctrl + S / Cmd + S for explicit instant save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave(content);
      setSaveStatus('saved');
    }
    // Escape to finish editing
    if (e.key === 'Escape') {
      onSave(content);
      onCancel();
    }
  };

  return (
    <div className="border border-blue-400/80 dark:border-blue-500/80 rounded-2xl bg-white dark:bg-gray-900 shadow-md overflow-hidden animate-in fade-in duration-150">
      {/* Rich Formatting Toolbar */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-850 flex flex-wrap items-center gap-1 text-gray-700 dark:text-gray-200 text-xs">
        {/* Headings Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowHeadings(!showHeadings); setShowColorPicker(false); setShowHighlightPicker(false); }}
            className="px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-bold flex items-center gap-1 border border-gray-200 dark:border-gray-700"
            title="Tamanho do Texto / Título"
          >
            <span>Tamanho</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showHeadings && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setHeading('h1')}
                className="px-2.5 py-1.5 text-left text-base font-extrabold hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg"
              >
                Título 1 (H1)
              </button>
              <button
                type="button"
                onClick={() => setHeading('h2')}
                className="px-2.5 py-1.5 text-left text-sm font-bold hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg"
              >
                Título 2 (H2)
              </button>
              <button
                type="button"
                onClick={() => setHeading('h3')}
                className="px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg"
              >
                Título 3 (H3)
              </button>
              <button
                type="button"
                onClick={() => setHeading('p')}
                className="px-2.5 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg border-t border-gray-100 dark:border-gray-700"
              >
                Texto Normal (P)
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Basic Formats */}
        <button
          type="button"
          onClick={() => exec('bold')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-bold"
          title="Negrito (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 italic"
          title="Itálico (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 underline"
          title="Sublinhado (Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('strikeThrough')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 line-through"
          title="Tachado"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Text Color Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); setShowHeadings(false); }}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-0.5"
            title="Cor da Fonte"
          >
            <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 grid grid-cols-3 gap-1.5">
              {TEXT_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setTextColor(c.color)}
                  className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:scale-110 transition-transform text-xs font-bold"
                  style={{ color: c.color !== 'inherit' ? c.color : undefined }}
                  title={c.name}
                >
                  A
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlight Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); setShowHeadings(false); }}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-0.5"
            title="Marca-texto / Realce"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 grid grid-cols-3 gap-1.5">
              {HIGHLIGHT_COLORS.map(h => (
                <button
                  key={h.name}
                  type="button"
                  onClick={() => setHighlightColor(h.color)}
                  className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:scale-110 transition-transform text-xs"
                  style={{ backgroundColor: h.color !== 'transparent' ? h.color : '#fff' }}
                  title={h.name}
                >
                  {h.color === 'transparent' ? '✕' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Lists & Checkboxes */}
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Lista com Marcadores (Bullets)"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Lista Numerada (1, 2, 3)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={insertCheckbox}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
          title="Lista de Tarefas / Checkbox"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Quotes & Dividers */}
        <button
          type="button"
          onClick={insertCallout}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Citação / Destaque Notion"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={insertDivider}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Linha Divisória"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Cloze Deletion Button */}
        <button
          type="button"
          onClick={insertCloze}
          className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 transition-colors"
          title="Criar Omissão de Palavra / Cloze (Ctrl+Shift+C)"
        >
          <Brackets className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">Cloze</span>
        </button>

        {/* Inserir Bloco de HTML Seguro (Iframe Sandbox) */}
        <button
          type="button"
          onClick={() => setShowSafeHtmlModal(true)}
          className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 transition-colors"
          title="Inserir Bloco de HTML Seguro (Iframe Sandbox com CSS/JS)"
        >
          <Code className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">+ HTML Seguro</span>
        </button>

        <button
          type="button"
          onClick={handleInsertImageClick}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400"
          title="Inserir Imagem (ou cole com Ctrl+V)"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          className="hidden"
        />

        {/* Right save / auto-save status & close action */}
        <div className="ml-auto flex items-center gap-2">
          {/* Auto-save visual feedback */}
          <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Salvando...</span>
              </span>
            ) : saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="w-3 h-3" />
                <span>Salvo automaticamente</span>
              </span>
            ) : (
              <span className="text-gray-400 text-[10px]">Auto-save ativo</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onSave(content);
              onCancel();
            }}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Concluir</span>
          </button>
        </div>
      </div>

      {/* Editable Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="p-4 min-h-[140px] max-h-[500px] overflow-y-auto text-sm text-gray-900 dark:text-gray-100 focus:outline-none leading-relaxed prose dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
      />
      
      <div className="px-4 py-1.5 bg-gray-50/70 dark:bg-gray-850/70 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
        <span>💡 Salvamento automático contínuo ativado • <b>Ctrl+Shift+C</b> cria Cloze • <b>Ctrl+Z</b> desfaz</span>
        <span>Modo Edição Ágil</span>
      </div>

      {/* Modal para Omissão de Palavra / Cloze */}
      {showClozeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Brackets className="w-4 h-4 text-purple-600" />
                <span>Criar Omissão de Palavra (Cloze)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Texto ou Termo a Ocultar:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={clozeWord}
                  onChange={(e) => setClozeWord(e.target.value)}
                  placeholder="Ex: Insuficiência Cardíaca"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCloze(clozeWord, clozeHint);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Dica Opcional (visível quando oculto):
                </label>
                <input
                  type="text"
                  value={clozeHint}
                  onChange={(e) => setClozeHint(e.target.value)}
                  placeholder="Ex: Doença miocárdica comum"
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCloze(clozeWord, clozeHint);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!clozeWord.trim()}
                onClick={() => handleConfirmCloze(clozeWord, clozeHint)}
                className="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-50"
              >
                Inserir Cloze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Inserção de HTML Seguro (Iframe Sandbox) */}
      <SafeHtmlInsertModal
        isOpen={showSafeHtmlModal}
        onClose={() => setShowSafeHtmlModal(false)}
        onSave={handleInsertSafeHtml}
      />
    </div>
  );
};
