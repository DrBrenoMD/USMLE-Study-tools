import React, { useRef, useEffect, useState, ReactNode } from 'react';
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
  Image as ImageIcon,
  Video,
  Music,
  Code,
  Brackets,
  Layers,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { cn, sanitizeHtml } from '../lib/utils';
import { ImageOcclusionTool } from './ImageOcclusionTool';
import { IsolatedHtml } from './IsolatedHtml';
import { motion, AnimatePresence } from 'motion/react';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
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

export function RichEditor({ value, onChange, placeholder, className, minHeight, onKeyDown }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showOcclusion, setShowOcclusion] = useState<{show: boolean, initialUrl?: string, targetImg?: HTMLElement, initialRects?: any[]}>({show: false});
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [showMediaPrompt, setShowMediaPrompt] = useState<{type: 'image' | 'video' | 'audio'} | null>(null);
  const [showClozePrompt, setShowClozePrompt] = useState(false);

  // Dropdowns
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showHeadings, setShowHeadings] = useState(false);

  // Sync incoming value only if it's different from what we currently have
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (value === '' || value === '<br>') {
        editorRef.current.innerHTML = value;
      } else {
        if (value !== editorRef.current.innerHTML) {
          editorRef.current.innerHTML = value;
        }
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
  };

  const setTextColor = (color: string) => {
    if (color === 'inherit') {
      exec('removeFormat');
    } else {
      exec('foreColor', color);
    }
    setShowColorPicker(false);
  };

  const setHighlightColor = (color: string) => {
    if (color === 'transparent') {
      exec('hiliteColor', 'transparent');
    } else {
      exec('hiliteColor', color);
    }
    setShowHighlightPicker(false);
  };

  const insertHeading = (tag: 'h1' | 'h2' | 'h3' | 'p' | 'small') => {
    if (tag === 'small') {
      exec('fontSize', '2');
    } else {
      exec('formatBlock', `<${tag}>`);
    }
    setShowHeadings(false);
  };

  const insertChecklist = () => {
    const checkHtml = `<div class="notion-checkbox-row" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 4px; cursor: pointer; transform: scale(1.1);" /><span contenteditable="true" style="flex: 1;">Item de verificação...</span></div>`;
    exec('insertHTML', checkHtml);
  };

  const insertDivider = () => {
    exec('insertHorizontalRule');
  };

  const insertMediaHtml = (type: 'image' | 'video' | 'audio', url: string, width: string) => {
    if (!width || !width.trim()) {
      width = "100%";
    } else {
      width = width.trim();
    }

    let html = '';
    if (type === 'image') {
      html = `<img src="${url}" alt="image" style="width: ${width}; max-width: 100%; border-radius: 8px; margin-top: 8px; object-fit: contain;" />`;
    } else if (type === 'video') {
      html = `<video controls src="${url}" style="width: ${width}; max-width: 100%; border-radius: 8px; margin-top: 8px;"></video>`;
    } else if (type === 'audio') {
      html = `<audio controls src="${url}" style="width: ${width === '100%' ? '100%' : width}; max-width: 100%; margin-top: 8px;"></audio>`;
    }
    
    if (editorRef.current) {
      editorRef.current.focus();
    }
    exec('insertHTML', html);
  };

  const insertCloze = () => {
    const sel = window.getSelection();
    let text = '';
    const content = editorRef.current?.innerHTML || '';
    const matches = Array.from(content.matchAll(/{{c(\d+)::/g));
    const nextNum = matches.length === 0 ? 1 : Math.max(...matches.map(m => parseInt(m[1], 10) || 1)) + 1;

    if (sel && sel.toString().trim()) {
      text = sel.toString().trim();
      exec('insertHTML', `{{c${nextNum}::${text}}}`);
    } else {
      setShowClozePrompt(true);
    }
  };

  return (
    <div className={cn("flex flex-col bg-ui-surface border border-ui-border rounded-2xl overflow-hidden focus-within:border-primary transition-colors", className)}>
      {/* Rich Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-ui-border bg-gray-50/80 dark:bg-gray-850 select-none text-xs">
        {/* Headings Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowHeadings(!showHeadings); setShowColorPicker(false); setShowHighlightPicker(false); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Tamanho da Fonte / Cabeçalho"
          >
            <span>Texto</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showHeadings && (
            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-1.5 w-40 animate-in fade-in zoom-in-95">
              <button onClick={() => insertHeading('h1')} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-extrabold text-base">Título 1 (H1)</button>
              <button onClick={() => insertHeading('h2')} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-sm">Título 2 (H2)</button>
              <button onClick={() => insertHeading('h3')} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-xs">Título 3 (H3)</button>
              <button onClick={() => insertHeading('p')} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-xs">Parágrafo Normal</button>
              <button onClick={() => insertHeading('small')} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] text-gray-500">Texto Pequeno</button>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Basic Styles */}
        <ToolbarButton onClick={() => exec('bold')} icon={<Bold className="w-3.5 h-3.5" />} title="Negrito (Ctrl+B)" />
        <ToolbarButton onClick={() => exec('italic')} icon={<Italic className="w-3.5 h-3.5" />} title="Itálico (Ctrl+I)" />
        <ToolbarButton onClick={() => exec('underline')} icon={<Underline className="w-3.5 h-3.5" />} title="Sublinhado (Ctrl+U)" />
        <ToolbarButton onClick={() => exec('strikeThrough')} icon={<Strikethrough className="w-3.5 h-3.5" />} title="Tachado" />

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Color Palette Dropdown */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); setShowHeadings(false); }}
            icon={<Palette className="w-3.5 h-3.5" />}
            title="Cor do Texto"
          />
          {showColorPicker && (
            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-2 w-44 space-y-1 animate-in fade-in zoom-in-95">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-1">Cor do Texto</span>
              {TEXT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setTextColor(c.color)}
                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: c.color }} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Dropdown */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); setShowHeadings(false); }}
            icon={<Highlighter className="w-3.5 h-3.5 text-amber-500" />}
            title="Marca-texto / Highlight"
          />
          {showHighlightPicker && (
            <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-2 w-44 space-y-1 animate-in fade-in zoom-in-95">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-1">Marca-texto</span>
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setHighlightColor(c.color)}
                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded border border-gray-300 shrink-0" style={{ backgroundColor: c.color }} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Lists & Checks */}
        <ToolbarButton onClick={() => exec('insertUnorderedList')} icon={<List className="w-3.5 h-3.5" />} title="Lista com Marcadores" />
        <ToolbarButton onClick={() => exec('insertOrderedList')} icon={<ListOrdered className="w-3.5 h-3.5" />} title="Lista Numerada" />
        <ToolbarButton onClick={insertChecklist} icon={<CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />} title="Lista de Verificação (Checkbox)" />
        <ToolbarButton onClick={() => exec('formatBlock', '<blockquote>')} icon={<Quote className="w-3.5 h-3.5" />} title="Citação / Callout" />
        <ToolbarButton onClick={insertDivider} icon={<Minus className="w-3.5 h-3.5" />} title="Divisor Horizontal" />

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5" />

        {/* Cloze & Media */}
        <ToolbarButton onClick={insertCloze} icon={<Brackets className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />} title="Ocultação / Cloze ({{c1::texto}})" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'image'})} icon={<ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />} title="Inserir Imagem" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'video'})} icon={<Video className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />} title="Inserir Vídeo" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'audio'})} icon={<Music className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />} title="Inserir Áudio" />
        <ToolbarButton onClick={() => setShowOcclusion({show: true})} icon={<Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />} title="Image Occlusion" />
        <ToolbarButton onClick={() => setShowHtmlEditor(true)} icon={<Code className="w-3.5 h-3.5 text-gray-500" />} title="Editar Código HTML" />
      </div>

      {/* ContentEditable Editor Body */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={(e) => {
          const plainText = e.clipboardData?.getData('text/plain') || '';
          if (plainText && /<(?:div|table|script|style|p|span|h[1-6]|ul|ol|iframe|blockquote|canvas|svg|form|section|article|button|input|pre|code)\b/i.test(plainText.trim())) {
            e.preventDefault();
            const hasInteractive = /<(?:script|style|canvas|svg|iframe)\b/i.test(plainText) || /on\w+\s*=/i.test(plainText);
            const htmlToInsert = hasInteractive
              ? `<div class="interactive-note-widget my-3 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50 max-w-full overflow-hidden" data-html-widget="true">${plainText.trim()}</div><p><br/></p>`
              : plainText.trim();
            exec('insertHTML', htmlToInsert);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
          }
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
            e.preventDefault();
            insertCloze();
          }
          onKeyDown?.(e);
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            const isChecked = (target as HTMLInputElement).checked;
            if (isChecked) {
              target.setAttribute('checked', 'checked');
            } else {
              target.removeAttribute('checked');
            }
            handleInput();
            return;
          }

          if (target && target.tagName === 'IMG') {
            const imgElement = target as HTMLImageElement;
            const src = imgElement.src;
            let container = imgElement.parentElement;
            let initialRects: any[] = [];
            let targetReplaceNode: HTMLElement = imgElement;

            if (container && container.querySelector('.occlusion-mask')) {
              targetReplaceNode = container;
              const masks = container.querySelectorAll('.occlusion-mask');
              masks.forEach(m => {
                const t = (m as HTMLElement).style.top.replace('%', '');
                const l = (m as HTMLElement).style.left.replace('%', '');
                const w = (m as HTMLElement).style.width.replace('%', '');
                const h = (m as HTMLElement).style.height.replace('%', '');
                initialRects.push({
                  y: parseFloat(t) || 0,
                  x: parseFloat(l) || 0,
                  w: parseFloat(w) || 0,
                  h: parseFloat(h) || 0
                });
              });
            }
            
            setShowOcclusion({show: true, initialUrl: src, targetImg: targetReplaceNode, initialRects});
          }
        }}
        className="p-4 min-h-[140px] text-ui-text focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ui-muted custom-scrollbar text-sm leading-relaxed"
        style={minHeight ? { minHeight } : undefined}
        data-placeholder={placeholder}
      />

      {/* Image Occlusion Modal */}
      {showOcclusion.show && (
        <ImageOcclusionTool 
          initialUrl={showOcclusion.initialUrl}
          initialRects={showOcclusion.initialRects}
          onCancel={() => setShowOcclusion({show: false})}
          onInsert={(html) => {
            const img = showOcclusion.targetImg;
            if (img && img.parentNode) {
              const temp = document.createElement('div');
              temp.innerHTML = html.trim();
              const payload = temp.firstElementChild;
              if (payload) {
                img.parentNode.replaceChild(payload, img);
              } else {
                exec('insertHTML', html);
              }
            } else {
              exec('insertHTML', html);
            }
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            setShowOcclusion({show: false});
          }}
        />
      )}
      
      {/* HTML Editor Modal */}
      <AnimatePresence>
        {showHtmlEditor && (
          <HTMLModal 
            initialHtml={value}
            onClose={() => setShowHtmlEditor(false)}
            onSave={(html) => {
              onChange(html);
              setShowHtmlEditor(false);
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Media Prompt Modal */}
      <AnimatePresence>
        {showMediaPrompt && (
          <MediaModal
            type={showMediaPrompt.type}
            onClose={() => setShowMediaPrompt(null)}
            onInsert={(url, width) => {
              insertMediaHtml(showMediaPrompt.type, url, width);
              setShowMediaPrompt(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Cloze Prompt Modal */}
      <AnimatePresence>
        {showClozePrompt && (
          <ClozeModal
            onClose={() => setShowClozePrompt(false)}
            onInsert={(text) => {
              exec('insertHTML', `{{c1::${text}}}`);
              setShowClozePrompt(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolbarButton({ onClick, icon, title }: { onClick: () => void, icon: ReactNode, title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
    >
      {icon}
    </button>
  );
}

function ClozeModal({ onClose, onInsert }: { onClose: () => void, onInsert: (t: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-ui-border">
          <h2 className="text-lg font-bold text-ui-text">Inserir Ocultação / Cloze</h2>
          <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover"><XCircle className="w-5 h-5"/></button>
        </div>
        <div className="p-4">
          <label className="block text-sm font-medium text-ui-muted mb-1">Texto a ocultar</label>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="ex: Mitocôndria" className="w-full p-2 border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none focus:border-primary" onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onInsert(val); }} />
        </div>
        <div className="p-4 border-t border-ui-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-medium text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg">Cancelar</button>
          <button disabled={!val.trim()} onClick={() => onInsert(val)} className="px-4 py-2 font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50">Inserir</button>
        </div>
      </motion.div>
    </div>
  );
}

function HTMLModal({ initialHtml, onClose, onSave }: { initialHtml: string, onClose: () => void, onSave: (html: string) => void }) {
  const [val, setVal] = useState(initialHtml);
  const [tab, setTab] = useState<'code' | 'preview'>('code');

  const handleApply = () => {
    if (!val.trim()) {
      onSave('');
      return;
    }
    const hasInteractive = /<(?:script|style|canvas|svg|iframe)\b/i.test(val) || /on\w+\s*=/i.test(val);
    const payload = hasInteractive
      ? `<div class="interactive-note-widget my-3 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50 max-w-full overflow-hidden" data-html-widget="true">${val.trim()}</div><p><br/></p>`
      : val.trim();
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-ui-border">
          <div>
            <h2 className="text-base font-bold text-ui-text">Editar Código HTML / JS Interativo</h2>
            <p className="text-xs text-ui-muted">Ambiente isolado para tags HTML, formatação CSS e execução de scripts JS</p>
          </div>
          <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover cursor-pointer"><XCircle className="w-5 h-5"/></button>
        </div>

        <div className="flex border-b border-ui-border bg-ui-background px-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('code')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${tab === 'code' ? 'border-primary text-primary' : 'border-transparent text-ui-muted'}`}
          >
            Código HTML / JS
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${tab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-ui-muted'}`}
          >
            Pré-visualização Interativa (com JS ativo)
          </button>
        </div>

        <div className="p-4 flex-1">
          {tab === 'code' ? (
            <textarea
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="w-full h-72 p-3 bg-gray-900 text-emerald-400 font-mono text-xs rounded-lg resize-none focus:outline-none border border-gray-700"
              placeholder="Cole seu código HTML/JS aqui (tabelas, scripts, estilos CSS, etc.)..."
            />
          ) : (
            <div className="h-72 p-2 border border-ui-border rounded-lg overflow-y-auto bg-ui-background max-w-full overflow-hidden">
              {val.trim() ? (
                <IsolatedHtml html={val} className="w-full max-w-full rounded-xl overflow-hidden min-h-[220px]" />
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-8">Nenhum código HTML informado ainda.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-ui-border bg-ui-surface flex items-center justify-between">
          <span className="text-[11px] text-ui-muted">Contenção e execução isolada ativas</span>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg cursor-pointer">Cancelar</button>
            <button onClick={handleApply} className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg cursor-pointer">Aplicar na Nota</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MediaModal({ type, onClose, onInsert }: { type: string, onClose: () => void, onInsert: (url: string, width: string) => void }) {
  const [url, setUrl] = useState('');
  const [width, setWidth] = useState('100%');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) setUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-ui-border">
          <h2 className="text-base font-bold text-ui-text capitalize">Inserir {type === 'image' ? 'Imagem' : type === 'video' ? 'Vídeo' : 'Áudio'}</h2>
          <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover"><XCircle className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-ui-muted mb-1">URL / Link Direto</label>
            <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full p-2 text-xs border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ui-muted mb-1">Ou Carregar Arquivo Local</label>
            <input type="file" accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*'} onChange={handleFileUpload} className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          {type === 'image' && (
            <div>
              <label className="block text-xs font-semibold text-ui-muted mb-1">Largura</label>
              <select value={width} onChange={e => setWidth(e.target.value)} className="w-full p-2 text-xs border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none">
                <option value="100%">100% (Largura total)</option>
                <option value="75%">75%</option>
                <option value="50%">50%</option>
                <option value="300px">300px</option>
              </select>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-ui-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg">Cancelar</button>
          <button disabled={!url.trim()} onClick={() => onInsert(url, width)} className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg disabled:opacity-50">Inserir</button>
        </div>
      </motion.div>
    </div>
  );
}
