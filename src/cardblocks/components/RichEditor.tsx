import React, { useRef, useEffect, useState, ReactNode } from 'react';
import { Bold, Italic, Image as ImageIcon, Video, Music, Code, Brackets, Layers, XCircle } from 'lucide-react';
import { cn, sanitizeHtml } from '../lib/utils';
import { ImageOcclusionTool } from './ImageOcclusionTool';
import { motion, AnimatePresence } from 'motion/react';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function RichEditor({ value, onChange, placeholder, className, onKeyDown }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showOcclusion, setShowOcclusion] = useState<{show: boolean, initialUrl?: string, targetImg?: HTMLElement, initialRects?: any[]}>({show: false});
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [showMediaPrompt, setShowMediaPrompt] = useState<{type: 'image' | 'video' | 'audio'} | null>(null);

  const [showClozePrompt, setShowClozePrompt] = useState(false);

  // Sync incoming value only if it's different from what we currently have
  // (to avoid cursor jumps)
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

  const exec = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
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
    
    // Focus back on editor and execute
    if (editorRef.current) {
       editorRef.current.focus();
    }
    
    // Insert at end fallback if lost
    exec('insertHTML', html);
  };

  const insertCloze = () => {
    const sel = window.getSelection();
    let text = '';
    if (sel && sel.toString().trim()) {
      text = sel.toString().trim();
      exec('insertHTML', `{{c1::${text}}}`);
    } else {
      setShowClozePrompt(true);
    }
  };

  return (
    <div className={cn("flex flex-col bg-ui-surface border border-ui-border rounded-xl overflow-hidden focus-within:border-primary transition-colors", className)}>
      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-ui-border bg-ui-surface">
        <ToolbarButton onClick={() => exec('bold')} icon={<Bold className="w-4 h-4" />} title="Bold" />
        <ToolbarButton onClick={() => exec('italic')} icon={<Italic className="w-4 h-4" />} title="Italic" />
        <ToolbarButton onClick={insertCloze} icon={<Brackets className="w-4 h-4" />} title="Insert Cloze ({{c1::text}})" />
        <div className="w-px h-4 bg-ui-surface-hover mx-1" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'image'})} icon={<ImageIcon className="w-4 h-4" />} title="Insert Image" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'video'})} icon={<Video className="w-4 h-4" />} title="Insert Video" />
        <ToolbarButton onClick={() => setShowMediaPrompt({type: 'audio'})} icon={<Music className="w-4 h-4" />} title="Insert Audio" />
        <div className="w-px h-4 bg-ui-surface-hover mx-1" />
        <ToolbarButton onClick={() => setShowOcclusion({show: true})} icon={<Layers className="w-4 h-4" />} title="Image Occlusion" />
        <div className="w-px h-4 bg-ui-surface-hover mx-1" />
        <ToolbarButton 
          onClick={() => setShowHtmlEditor(true)} 
          icon={<Code className="w-4 h-4" />} 
          title="Edit HTML" 
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={(e) => {
           if (e.key === 'Tab') {
             e.preventDefault();
             const focusableSelector = 'input:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [contenteditable=""], [contenteditable]';
             const focusable = Array.from(document.querySelectorAll(focusableSelector)).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
             }) as HTMLElement[];
             
             const index = focusable.findIndex(el => el === editorRef.current);
             if (index > -1) {
               let nextIndex = index + (e.shiftKey ? -1 : 1);
               if (nextIndex >= 0 && nextIndex < focusable.length) {
                 setTimeout(() => focusable[nextIndex].focus(), 0);
               }
             }
           }
           onKeyDown?.(e);
        }}
        onClick={(e) => {
           if ((e.target as HTMLElement).tagName === 'IMG') {
             const imgElement = e.target as HTMLImageElement;
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
        className="p-3 min-h-[100px] text-ui-text focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-ui-muted custom-scrollbar text-[15px]"
        data-placeholder={placeholder}
      />
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
      className="p-1.5 text-ui-muted hover:text-ui-text hover:bg-ui-surface-hover rounded-lg transition-colors"
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
           <h2 className="text-lg font-bold text-ui-text">Insert Cloze</h2>
           <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover"><XCircle className="w-5 h-5"/></button>
        </div>
        <div className="p-4">
           <label className="block text-sm font-medium text-ui-muted mb-1">Text to hide</label>
           <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. Mitochondria" className="w-full p-2 border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none focus:border-primary" onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onInsert(val); }} />
        </div>
        <div className="p-4 border-t border-ui-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-medium text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg">Cancel</button>
          <button disabled={!val.trim()} onClick={() => onInsert(val)} className="px-4 py-2 font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50">Insert</button>
        </div>
      </motion.div>
    </div>
  );
}

function HTMLModal({ initialHtml, onClose, onSave }: { initialHtml: string, onClose: () => void, onSave: (html: string) => void }) {
  const [val, setVal] = useState(initialHtml);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-ui-border">
           <h2 className="text-lg font-bold text-ui-text">Edit HTML</h2>
           <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover"><XCircle className="w-5 h-5"/></button>
        </div>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-full h-80 p-4 bg-ui-background text-ui-text font-mono text-sm resize-none focus:outline-none"
        />
        <div className="p-4 border-t border-ui-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-medium text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg">Cancel</button>
          <button onClick={() => onSave(val)} className="px-4 py-2 font-medium bg-primary text-primary-foreground rounded-lg">Apply HTML</button>
        </div>
      </motion.div>
    </div>
  );
}

function MediaModal({ type, onClose, onInsert }: { type: string, onClose: () => void, onInsert: (url: string, width: string) => void }) {
  const [url, setUrl] = useState('');
  const [width, setWidth] = useState('');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-ui-surface border border-ui-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-ui-border">
           <h2 className="text-lg font-bold text-ui-text capitalize">Insert {type}</h2>
           <button onClick={onClose} className="p-1 text-ui-muted hover:text-ui-text rounded bg-ui-surface hover:bg-ui-surface-hover"><XCircle className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-4">
           <div>
             <label className="block text-sm font-medium text-ui-muted mb-1">URL</label>
             <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder={`https://example.com/asset.${type === 'image' ? 'png' : 'mp4'}`} className="w-full p-2 border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none focus:border-primary" />
           </div>
           <div>
             <label className="block text-sm font-medium text-ui-muted mb-1">Width (optional)</label>
             <input value={width} onChange={e => setWidth(e.target.value)} placeholder="e.g. 100%, 300px" className="w-full p-2 border border-ui-border bg-ui-background text-ui-text rounded-lg outline-none focus:border-primary" />
           </div>
        </div>
        <div className="p-4 border-t border-ui-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-medium text-ui-text hover:bg-ui-surface-hover border border-ui-border rounded-lg">Cancel</button>
          <button disabled={!url.trim()} onClick={() => onInsert(url, width)} className="px-4 py-2 font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50">Insert</button>
        </div>
      </motion.div>
    </div>
  );
}
