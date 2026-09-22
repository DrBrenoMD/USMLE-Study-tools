import { useState, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { X, Check } from 'lucide-react';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageOcclusionToolProps {
  onInsert: (html: string) => void;
  onCancel: () => void;
  initialUrl?: string;
  initialRects?: Rect[];
}

export function ImageOcclusionTool({ onInsert, onCancel, initialUrl, initialRects = [] }: ImageOcclusionToolProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [loadedUrl, setLoadedUrl] = useState(initialUrl || '');
  const [rects, setRects] = useState<Rect[]>(initialRects);
  const [drawing, setDrawing] = useState<Rect | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const startDraw = (e: ReactMouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDrawing({ x, y, w: 0, h: 0 });
  };

  const doDraw = (e: ReactMouseEvent) => {
    if (!drawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ex = ((e.clientX - rect.left) / rect.width) * 100;
    const ey = ((e.clientY - rect.top) / rect.height) * 100;
    setDrawing({
      x: Math.min(drawing.x, ex),
      y: Math.min(drawing.y, ey),
      w: Math.abs(ex - drawing.x),
      h: Math.abs(ey - drawing.y),
    });
  };

  const endDraw = () => {
    if (drawing && drawing.w > 2 && drawing.h > 2) {
      setRects([...rects, drawing]);
    }
    setDrawing(null);
  };

  const handleSave = () => {
    if (!loadedUrl) return;
    
    // Generate the HTML snippet
    let html = `<div style="position:relative; display:inline-block; max-width:100%;">\n`;
    html += `  <img src="${loadedUrl}" style="max-width:100%; display:block;" />\n`;
    
    rects.forEach(r => {
      html += `  <div class="occlusion-mask" style="position:absolute; top:${r.y}%; left:${r.x}%; width:${r.w}%; height:${r.h}%; background:#2563eb; cursor:pointer;" onclick="this.classList.toggle('revealed')"></div>\n`;
    });
    
    html += `</div>`;
    onInsert(html);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-ui-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
         <div className="flex items-center justify-between p-4 border-b border-ui-border">
           <h3 className="text-lg font-bold text-ui-text">Image Occlusion</h3>
           <button onClick={onCancel} className="text-ui-muted hover:text-ui-text"><X className="w-5 h-5" /></button>
         </div>
         
         <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
           {!loadedUrl ? (
             <div className="flex gap-2">
               <input 
                 type="text" 
                 placeholder="Paste image URL here..." 
                 className="flex-1 bg-ui-surface border border-ui-border rounded p-2 text-ui-text"
                 value={url}
                 onChange={e => setUrl(e.target.value)}
               />
               <button onClick={() => setLoadedUrl(url)} className="bg-primary px-4 py-2 rounded text-ui-text font-medium hover:bg-primary-hover">
                 Load
               </button>
             </div>
           ) : (
             <div className="flex flex-col gap-2 items-center">
               <p className="text-xs text-ui-muted mb-2">Click and drag on the image to draw occlusion masks.</p>
               <div 
                 ref={containerRef}
                 className="relative inline-block select-none shadow-lg border border-ui-border"
                 style={{ cursor: 'crosshair', maxWidth: '100%' }}
                 onMouseDown={startDraw}
                 onMouseMove={doDraw}
                 onMouseUp={endDraw}
                 onMouseLeave={endDraw}
               >
                 <img src={loadedUrl} alt="To occlude" className="block max-w-full" draggable={false} />
                 
                 {rects.map((r, i) => (
                   <div 
                     key={i} 
                     onMouseDown={(e) => {
                       e.stopPropagation();
                       setRects(rects.filter((_, idx) => idx !== i));
                     }}
                     style={{
                       position: 'absolute', top: `${r.y}%`, left: `${r.x}%`, width: `${r.w}%`, height: `${r.h}%`,
                       backgroundColor: 'rgba(37, 99, 235, 0.8)', border: '2px solid #60a5fa', cursor: 'pointer'
                     }}
                     title="Click to remove"
                   >
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-red-500/20 text-white">
                       <X className="w-4 h-4 shadow-sm" />
                     </div>
                   </div>
                 ))}
                 
                 {drawing && (
                   <div 
                     style={{
                       position: 'absolute', top: `${drawing.y}%`, left: `${drawing.x}%`, width: `${drawing.w}%`, height: `${drawing.h}%`,
                       backgroundColor: 'rgba(37, 99, 235, 0.4)', border: '1px dashed #93c5fd'
                     }}
                   />
                 )}
               </div>
               
               <div className="flex items-center gap-4 mt-4 w-full justify-between">
                 <button onClick={() => setRects([])} className="text-red-400 text-sm hover:underline">Clear Masks</button>
                 <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-ui-text px-6 py-2 rounded-xl font-medium flex items-center gap-2">
                   <Check className="w-5 h-5" /> Insert into Card
                 </button>
               </div>
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
