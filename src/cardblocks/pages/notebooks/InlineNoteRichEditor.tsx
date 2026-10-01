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
  ShieldCheck,
  Eye,
  Check,
  HelpCircle
} from 'lucide-react';
import { cn, sanitizeHtml } from '../../lib/utils';
import { IsolatedHtml } from '../../components/IsolatedHtml';

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

  // Cloze & HTML modal states
  const [showClozeModal, setShowClozeModal] = useState(false);
  const [clozeModalText, setClozeModalText] = useState('');
  const [clozeModalHint, setClozeModalHint] = useState('');
  const [clozeModalNum, setClozeModalNum] = useState<number>(1);

  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [rawHtmlInput, setRawHtmlInput] = useState('');
  const [htmlPreviewTab, setHtmlPreviewTab] = useState<'code' | 'preview'>('code');

  // Debounced auto-save timer ref and content ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>(initialContent || '');

  // Initialize content
  useEffect(() => {
    if (editorRef.current) {
      // If initial content is placeholder text or empty, leave it truly empty so the user can type freely
      const isPlaceholder = initialContent.includes('Comece a escrever sua nota estruturada');
      const cleanContent = isPlaceholder ? '' : initialContent;
      
      editorRef.current.innerHTML = cleanContent;
      setContent(cleanContent);
      contentRef.current = cleanContent;

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
    contentRef.current = newHtml;
    setSaveStatus('saving');
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      onSave(newHtml);
      setSaveStatus('saved');
    }, 400);
  }, [onSave]);

  // Clean up on unmount and flush pending save
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (contentRef.current !== initialContent) {
        onSave(contentRef.current);
      }
    };
  }, [onSave, initialContent]);

  const handleInput = () => {
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      contentRef.current = newHtml;
      setContent(newHtml);
      triggerAutoSave(newHtml);
    }
  };

  const handleBlur = () => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      contentRef.current = currentHtml;
      onSave(currentHtml);
      setSaveStatus('saved');
    }
  };

  const exec = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      const newHtml = editorRef.current.innerHTML;
      contentRef.current = newHtml;
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
    // 1. Imagens coladas
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

    // 2. Colagem de código HTML / JS / Tabelas / Widgets
    const plainText = e.clipboardData?.getData('text/plain') || '';
    if (plainText && /<(?:div|table|script|style|p|span|h[1-6]|ul|ol|iframe|blockquote|canvas|svg|form|section|article|button|input|pre|code)\b/i.test(plainText.trim())) {
      e.preventDefault();
      const hasInteractive = /<(?:script|style|canvas|svg|iframe)\b/i.test(plainText) || /on\w+\s*=/i.test(plainText);
      const htmlToInsert = hasInteractive
        ? `<div class="interactive-note-widget my-3 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50 max-w-full overflow-hidden" data-html-widget="true">${plainText.trim()}</div><p><br/></p>`
        : plainText.trim();
      exec('insertHTML', htmlToInsert);
      return;
    }
  };

  const getNextClozeNumber = () => {
    if (!editorRef.current) return 1;
    const text = editorRef.current.innerHTML;
    const matches = Array.from(text.matchAll(/{{c(\d+)::/g));
    if (matches.length === 0) return 1;
    const maxNum = Math.max(...matches.map(m => parseInt(m[1], 10) || 1));
    return maxNum + 1;
  };

  const handleInsertCloze = () => {
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim();
    if (selectedText) {
      const nextNum = getNextClozeNumber();
      exec('insertHTML', `{{c${nextNum}::${selectedText}}}`);
    } else {
      setClozeModalNum(getNextClozeNumber());
      setClozeModalText('');
      setClozeModalHint('');
      setShowClozeModal(true);
    }
  };

  const handleConfirmClozeModal = () => {
    if (!clozeModalText.trim()) return;
    const hintPart = clozeModalHint.trim() ? `::${clozeModalHint.trim()}` : '';
    const clozeCode = `{{c${clozeModalNum || 1}::${clozeModalText.trim()}${hintPart}}}`;
    exec('insertHTML', clozeCode);
    setShowClozeModal(false);
  };

  const handleInsertSafeHtml = (rawHtml: string) => {
    if (!rawHtml.trim()) return;
    const hasInteractive = /<(?:script|style|canvas|svg|iframe)\b/i.test(rawHtml) || /on\w+\s*=/i.test(rawHtml);
    const widgetHtml = hasInteractive
      ? `<div class="interactive-note-widget my-3 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50 max-w-full overflow-hidden" data-html-widget="true">${rawHtml.trim()}</div><p><br/></p>`
      : rawHtml.trim();
    exec('insertHTML', widgetHtml);
    setShowHtmlModal(false);
    setRawHtmlInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl + S / Cmd + S for explicit instant save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave(content);
      setSaveStatus('saved');
    }
    // Ctrl + Shift + C / Cmd + Shift + C for instant Cloze insertion
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      handleInsertCloze();
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

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Cloze & Safe HTML Insertion Buttons */}
        <button
          type="button"
          onClick={handleInsertCloze}
          className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 transition-colors"
          title="Inserir Ocultação / Cloze (Ctrl+Shift+C)"
        >
          <Brackets className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono text-[11px]">Cloze</span>
        </button>

        <button
          type="button"
          onClick={() => setShowHtmlModal(true)}
          className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 transition-colors"
          title="Inserir Código HTML Seguro (Sanitizado com DOMPurify)"
        >
          <Code className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono text-[11px]">HTML</span>
        </button>

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
        <span>💡 Salvamento automático contínuo ativado • <b>Ctrl+Shift+C</b> cria cloze • <b>Ctrl+Z</b> desfaz</span>
        <span>Modo Edição Ágil</span>
      </div>

      {/* Modal Inserir Ocultação / Cloze */}
      {showClozeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                  <Brackets className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Inserir Ocultação (Cloze)</h3>
                  <p className="text-[11px] text-gray-500">Oculte palavras-chave para estudo ativo na nota</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Texto ou Termo Oculto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="ex: Insuficiência Cardíaca, Aspirina..."
                  value={clozeModalText}
                  onChange={(e) => setClozeModalText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmClozeModal();
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Número do Cloze
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={clozeModalNum}
                    onChange={(e) => setClozeModalNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Dica Opcional
                  </label>
                  <input
                    type="text"
                    placeholder="ex: fármaco, diagnóstico..."
                    value={clozeModalHint}
                    onChange={(e) => setClozeModalHint(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-[11px] text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 text-purple-600" />
                <span>
                  Sintaxe gerada: <code className="font-mono font-bold">{`{{c${clozeModalNum}::${clozeModalText || '...'}${clozeModalHint ? `::${clozeModalHint}` : ''}}}`}</code>
                </span>
              </div>
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!clozeModalText.trim()}
                onClick={handleConfirmClozeModal}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Inserir Cloze</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inserir HTML / JS Interativo */}
      {showHtmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Inserir Código HTML / JS Interativo</h3>
                  <p className="text-[11px] text-gray-500">Suporte completo para códigos HTML, estilos CSS, scripts JavaScript, tabelas e calculadoras clínicas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHtmlModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Presets Rápidos */}
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 overflow-x-auto text-[11px]">
              <span className="font-bold text-gray-500 shrink-0">Modelos prontos:</span>
              <button
                type="button"
                onClick={() => setRawHtmlInput(`<div style="padding: 14px; background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; border-radius: 12px; font-family: system-ui, sans-serif;">
  <h4 style="margin: 0 0 8px 0; color: #2563eb; font-size: 14px; font-weight: bold;">🧮 Calculadora de Osmolaridade Plasmática</h4>
  <p style="margin: 0 0 10px 0; font-size: 12px; opacity: 0.85;">Fórmula: 2 × Na + Glicose/18 + BUN/2.8</p>
  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
    <input id="na_val" type="number" placeholder="Na (ex: 140)" value="140" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 110px; font-size: 12px; background: #fff; color: #1e293b;" />
    <input id="gli_val" type="number" placeholder="Glicose (ex: 90)" value="90" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 120px; font-size: 12px; background: #fff; color: #1e293b;" />
    <input id="bun_val" type="number" placeholder="BUN (ex: 14)" value="14" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 110px; font-size: 12px; background: #fff; color: #1e293b;" />
  </div>
  <button id="btn_calc" style="padding: 6px 14px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">Calcular</button>
  <div id="res_osm" style="margin-top: 10px; font-weight: bold; color: #059669; font-size: 13px;"></div>
  <script>
    document.getElementById('btn_calc').onclick = function() {
      var na = parseFloat(document.getElementById('na_val').value) || 140;
      var gli = parseFloat(document.getElementById('gli_val').value) || 90;
      var bun = parseFloat(document.getElementById('bun_val').value) || 14;
      var osm = (2 * na) + (gli / 18) + (bun / 2.8);
      document.getElementById('res_osm').innerText = 'Osmolaridade: ' + osm.toFixed(1) + ' mOsm/kg (Normal: 275-295)';
    };
  </script>
</div>`)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 font-medium shrink-0 cursor-pointer"
              >
                🧮 Calculadora Clínica (com JS)
              </button>

              <button
                type="button"
                onClick={() => setRawHtmlInput(`<table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px;">
  <thead>
    <tr style="background: #eff6ff; border-bottom: 2px solid #93c5fd;">
      <th style="padding: 8px; text-align: left; color: #1e40af;">Condição Clínica</th>
      <th style="padding: 8px; text-align: left; color: #1e40af;">Fisiopatologia</th>
      <th style="padding: 8px; text-align: left; color: #1e40af;">Tratamento 1ª Linha</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px; font-weight: bold;">Estenose Aórtica</td>
      <td style="padding: 8px;">Calcificação progressiva valvar</td>
      <td style="padding: 8px;">Troca valvar (TAVI / Cirúrgica)</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Insuficiência Aórtica</td>
      <td style="padding: 8px;">Dilatação da raiz aórtica / endocardite</td>
      <td style="padding: 8px;">Vasodilatadores / Correção cirúrgica</td>
    </tr>
  </tbody>
</table>`)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 font-medium shrink-0 cursor-pointer"
              >
                📊 Tabela Comparativa
              </button>

              <button
                type="button"
                onClick={() => setRawHtmlInput(`<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px; border-radius: 8px; margin: 8px 0; color: #14532d;">
  <b style="color: #15803d; font-size: 14px;">✅ Pérola USMLE (High-Yield):</b>
  <p style="margin: 4px 0 0 0; font-size: 13px;">A tríade clássica de dor torácica, síncope e dispneia aos esforços indica estenose aórtica grave descompensada.</p>
</div>`)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 font-medium shrink-0 cursor-pointer"
              >
                💡 Card High-Yield
              </button>

              <button
                type="button"
                onClick={() => setRawHtmlInput(`<div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 10px 14px; border-radius: 10px; margin: 8px 0; color: #9f1239; font-size: 13px;">
  <b>⚠️ Pegadinha Frequente:</b> Não administrar betabloqueadores em pacientes com feocromocitoma antes de bloqueio alfa-adrenérgico completo!
</div>`)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 font-medium shrink-0 cursor-pointer"
              >
                ⚠️ Alerta / Pegadinha
              </button>
            </div>

            {/* Abas Código vs Preview */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHtmlPreviewTab('code')}
                className={cn(
                  "py-2 px-3 border-b-2 transition-colors cursor-pointer",
                  htmlPreviewTab === 'code' ? "border-emerald-600 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800"
                )}
              >
                Código HTML / JS
              </button>
              <button
                type="button"
                onClick={() => setHtmlPreviewTab('preview')}
                className={cn(
                  "py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer",
                  htmlPreviewTab === 'preview' ? "border-emerald-600 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pré-visualização Interativa (com JS ativo)</span>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto min-h-[220px]">
              {htmlPreviewTab === 'code' ? (
                <div className="space-y-2">
                  <textarea
                    rows={8}
                    value={rawHtmlInput}
                    onChange={(e) => setRawHtmlInput(e.target.value)}
                    placeholder="Cole ou digite seu código HTML/JS aqui (tabelas, scripts, calculadoras interativas, estilos CSS, etc.)..."
                    className="w-full p-3 font-mono text-xs bg-gray-900 text-emerald-400 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ambiente seguro e isolado: tags de script, CSS e tabelas são executados com contenção automática.</span>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 min-h-[180px] max-w-full overflow-hidden">
                  {rawHtmlInput.trim() ? (
                    <IsolatedHtml
                      html={rawHtmlInput}
                      className="w-full max-w-full rounded-xl overflow-hidden min-h-[160px]"
                    />
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-8">Nenhum código HTML/JS informado ainda.</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium">
                Execução interativa habilitada
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHtmlModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!rawHtmlInput.trim()}
                  onClick={() => handleInsertSafeHtml(rawHtmlInput)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Inserir na Nota</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
