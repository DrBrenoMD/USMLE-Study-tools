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
  Image as ImageIcon
} from 'lucide-react';
import { cn, sanitizeHtml } from '../../lib/utils';

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
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [rawHtmlInput, setRawHtmlInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Debounced auto-save timer ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const HTML_TEMPLATES = [
    {
      name: '📊 Tabela Comparativa',
      description: 'Ideal para comparar patologias, fármacos ou critérios',
      html: `<div class="overflow-x-auto my-3 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xs">
  <table class="w-full border-collapse text-xs text-left">
    <thead>
      <tr class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <th class="p-2.5 font-bold border-b border-gray-200 dark:border-gray-700">Critério / Doença</th>
        <th class="p-2.5 font-bold border-b border-gray-200 dark:border-gray-700">Apresentação</th>
        <th class="p-2.5 font-bold border-b border-gray-200 dark:border-gray-700">Diagnóstico / Conduta</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
      <tr>
        <td class="p-2.5 font-bold text-blue-600">Condição A</td>
        <td class="p-2.5">Sintomas agudos, febre alta, dor localizada</td>
        <td class="p-2.5">Exame de imagem + Antibioticoterapia precoce</td>
      </tr>
      <tr>
        <td class="p-2.5 font-bold text-indigo-600">Condição B</td>
        <td class="p-2.5">Evolução insidiosa, afebril, sintomas difusos</td>
        <td class="p-2.5">Biópsia / Tratamento conservador</td>
      </tr>
    </tbody>
  </table>
</div>`
    },
    {
      name: '💡 Ponto-Chave High-Yield',
      description: 'Card destacado para lembretes essenciais da banca',
      html: `<div class="my-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-gray-800 dark:text-gray-200 shadow-xs">
  <div class="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs mb-1">
    <span>💡</span>
    <span>HIGH-YIELD PEARL / PEGADINHA DE BANCA:</span>
  </div>
  <p class="text-xs leading-relaxed">
    Lembre-se sempre de associar o achado X com a condição Y. Se houver hematúria microscópica isolada em paciente > 35 anos, a primeira conduta é cistoscopia + imagem do trato superior.
  </p>
</div>`
    },
    {
      name: '🔬 Fluxo Fisiopatológico',
      description: 'Passo a passo fisiopatológico ordenado',
      html: `<div class="my-3 p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs space-y-2">
  <span class="font-extrabold text-blue-700 dark:text-blue-300 uppercase tracking-wider text-[11px] block">🔬 Cascata Fisiopatológica:</span>
  <ol class="list-decimal list-inside space-y-1 text-gray-800 dark:text-gray-200 font-medium">
    <li><b>Estímulo Inicial:</b> Lesão endotelial ou sobrecarga hemodinâmica.</li>
    <li><b>Mecanismo Celular:</b> Ativação do eixo RAA e liberação de citocinas.</li>
    <li><b>Manifestação Clínica:</b> Retenção hidrossalina e remodelamento tecidual.</li>
    <li><b>Alvo Farmacológico:</b> Bloqueio com IECA / BRA diminui a progressão.</li>
  </ol>
</div>`
    },
    {
      name: '⚖️ Diagnóstico Diferencial',
      description: 'Grade de 2 colunas para diagnósticos diferenciais',
      html: `<div class="grid grid-cols-2 gap-2.5 my-3 text-xs">
  <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
    <span class="font-bold block mb-1">✅ Mais Provável:</span>
    <p>Quadro compatível com apresentação clássica e epidemiologia favorável.</p>
  </div>
  <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
    <span class="font-bold block mb-1">❌ Diagnóstico de Exclusão:</span>
    <p>Descartado por ausência de elevação enzimática ou marcadores negativos.</p>
  </div>
</div>`
    }
  ];

  const [showClozeModal, setShowClozeModal] = useState(false);
  const [clozeAnswerInput, setClozeAnswerInput] = useState('');
  const [clozeHintInput, setClozeHintInput] = useState('');

  const handleCreateCloze = () => {
    const sel = window.getSelection();
    let selectedText = '';
    if (sel && sel.rangeCount > 0) {
      selectedText = sel.toString().trim();
    }

    if (selectedText) {
      setClozeAnswerInput(selectedText);
      setClozeHintInput('');
      setShowClozeModal(true);
    } else {
      setClozeAnswerInput('');
      setClozeHintInput('');
      setShowClozeModal(true);
    }
  };

  const handleConfirmCloze = () => {
    if (!clozeAnswerInput.trim()) return;
    const ans = clozeAnswerInput.trim();
    const hint = clozeHintInput.trim();
    const displayHint = hint ? `[${hint}]` : '[...]';

    const clozeHtml = `<span class="cloze-hole" data-answer="${ans.replace(/"/g, '&quot;')}" ${hint ? `data-hint="${hint.replace(/"/g, '&quot;')}"` : ''} title="Clique para revelar / ocultar">${displayHint}</span>&nbsp;`;
    exec('insertHTML', clozeHtml);
    setShowClozeModal(false);
    setClozeAnswerInput('');
    setClozeHintInput('');
  };

  const handleInsertHtml = () => {
    if (!rawHtmlInput.trim()) return;
    const safeHtml = sanitizeHtml(rawHtmlInput);
    if (safeHtml) {
      exec('insertHTML', `<div class="embedded-custom-html my-2">${safeHtml}</div><br/>`);
      setRawHtmlInput('');
      setShowHtmlModal(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Alt + C or Ctrl + Shift + C for quick Cloze creation
    if ((e.altKey && (e.key === 'c' || e.key === 'C')) || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C'))) {
      e.preventDefault();
      handleCreateCloze();
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

        {/* Cloze (Oclusão) Tool */}
        <button
          type="button"
          onClick={handleCreateCloze}
          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800 text-[11px] cursor-pointer"
          title="Criar Cloze / Oclusão (Alt+C) - Oculte texto selecionado"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>[c] Cloze</span>
        </button>

        {/* Safe HTML Insertion Tool */}
        <button
          type="button"
          onClick={() => setShowHtmlModal(true)}
          className="px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono font-bold flex items-center gap-1 border border-gray-200 dark:border-gray-700 text-[11px] cursor-pointer"
          title="Inserir Código HTML Seguro (tabelas, cards, embeds)"
        >
          <Code className="w-3.5 h-3.5 text-indigo-500" />
          <span>&lt;/&gt; HTML</span>
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
        <span>💡 Salvamento automático contínuo ativado • <b>Ctrl+Z</b> desfaz • <b>Alt+C</b> faz Cloze</span>
        <span>Modo Edição Ágil</span>
      </div>

      {/* Safe HTML Insertion Modal */}
      {showHtmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-900 dark:text-gray-100">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-500" />
                <h4 className="font-extrabold text-base text-gray-900 dark:text-white">Inserir Código HTML Seguro</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowHtmlModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Insira ou personalize templates HTML estilizados (tabelas, cartões, fluxogramas). O código é processado com <b>DOMPurify</b> para garantir conformidade e segurança total.
            </p>

            {/* Quick Templates Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Modelos Rápidos Pré-configurados:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HTML_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => setRawHtmlInput(tpl.html)}
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 text-left transition-all group cursor-pointer"
                  >
                    <span className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 block truncate">
                      {tpl.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                      {tpl.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase">
                  Código HTML:
                </label>
                {rawHtmlInput && (
                  <button
                    type="button"
                    onClick={() => setRawHtmlInput('')}
                    className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <textarea
                value={rawHtmlInput}
                onChange={(e) => setRawHtmlInput(e.target.value)}
                placeholder="Exemplo: <table class='w-full'><tr><td>Item</td></tr></table>"
                rows={5}
                className="w-full font-mono text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {rawHtmlInput.trim() && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Pré-visualização Segura:</span>
                <div
                  className="p-3.5 max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50 text-xs"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtmlInput) }}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowHtmlModal(false)}
                className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInsertHtml}
                disabled={!rawHtmlInput.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Inserir na Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Cloze / Oclusão Modal */}
      {showClozeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-900 dark:text-gray-100">
          <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-gray-900 dark:text-white">Criar Cloze / Oclusão</h4>
                  <p className="text-[11px] text-gray-500">Oculte termos na nota para treino ativo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Texto Oculto (Resposta do Cloze) *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={clozeAnswerInput}
                  onChange={(e) => setClozeAnswerInput(e.target.value)}
                  placeholder="Ex: Vasculite de Churg-Strauss"
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Dica Visual (Opcional)
                </label>
                <input
                  type="text"
                  value={clozeHintInput}
                  onChange={(e) => setClozeHintInput(e.target.value)}
                  placeholder="Ex: epônimo, fármaco de 1ª linha..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Se preenchida, o cloze exibirá <span className="font-mono text-blue-600 dark:text-blue-400">[{clozeHintInput || 'dica'}]</span> em vez de <span className="font-mono text-blue-600 dark:text-blue-400">[...]</span>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Exemplo de visualização:</span>
              <p className="text-gray-800 dark:text-gray-200">
                O paciente apresenta quadro de{' '}
                <span className="cloze-hole" title="Clique para revelar">
                  {clozeHintInput ? `[${clozeHintInput}]` : '[...]'}
                </span>
                .
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowClozeModal(false)}
                className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCloze}
                disabled={!clozeAnswerInput.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Inserir Cloze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
