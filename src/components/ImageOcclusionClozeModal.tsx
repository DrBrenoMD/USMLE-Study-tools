import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Check,
  RotateCcw,
  Copy,
  BookOpen,
  ArrowRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useStore } from '../cardblocks/store/useStore';

export interface ImageOcclusionMask {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  clozeNum: number; // 1, 2, 3...
  hint?: string;
}

interface ImageOcclusionClozeModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onInsertIntoEditor?: (html: string) => void;
}

export const ImageOcclusionClozeModal: React.FC<ImageOcclusionClozeModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  onInsertIntoEditor
}) => {
  const { decks, createCard } = useStore();
  const [masks, setMasks] = useState<ImageOcclusionMask[]>([]);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'edit' | 'masked' | 'revealed'>('edit');
  const [revealedMasks, setRevealedMasks] = useState<Record<string, boolean>>({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || 'default');
  const [cardTitle, setCardTitle] = useState<string>('Oclusão de Imagem (Cloze)');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setMasks([]);
      setSelectedMaskId(null);
      setPreviewMode('edit');
      setRevealedMasks({});
      setSavedSuccess(false);
      if (decks.length > 0 && !decks.find(d => d.id === selectedDeckId)) {
        setSelectedDeckId(decks[0].id);
      }
    }
  }, [isOpen, imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (previewMode !== 'edit') return;
    if (!containerRef.current || !imageRef.current) return;

    // Check if clicked inside image bounding box
    const rect = imageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      return;
    }

    const startXPercent = (clickX / rect.width) * 100;
    const startYPercent = (clickY / rect.height) * 100;

    setIsDrawing(true);
    setDrawStart({ x: startXPercent, y: startYPercent });
    setCurrentDraw({ x: startXPercent, y: startYPercent, width: 0, height: 0 });
    setSelectedMaskId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const currentXPercent = (currentX / rect.width) * 100;
    const currentYPercent = (currentY / rect.height) * 100;

    const x = Math.min(drawStart.x, currentXPercent);
    const y = Math.min(drawStart.y, currentYPercent);
    const width = Math.abs(currentXPercent - drawStart.x);
    const height = Math.abs(currentYPercent - drawStart.y);

    setCurrentDraw({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDraw) return;
    setIsDrawing(false);

    // If drawn box is larger than 1.5% in dimensions, create mask
    if (currentDraw.width > 1.5 && currentDraw.height > 1.5) {
      const nextClozeNum = masks.length + 1;
      const newMask: ImageOcclusionMask = {
        id: 'mask-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        x: Math.round(currentDraw.x * 100) / 100,
        y: Math.round(currentDraw.y * 100) / 100,
        width: Math.round(currentDraw.width * 100) / 100,
        height: Math.round(currentDraw.height * 100) / 100,
        clozeNum: nextClozeNum
      };
      setMasks(prev => [...prev, newMask]);
      setSelectedMaskId(newMask.id);
    }

    setDrawStart(null);
    setCurrentDraw(null);
  };

  const handleDeleteMask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMasks(prev => prev.filter(m => m.id !== id));
    if (selectedMaskId === id) {
      setSelectedMaskId(null);
    }
  };

  const handleUpdateMaskClozeNum = (id: string, clozeNum: number) => {
    setMasks(prev => prev.map(m => m.id === id ? { ...m, clozeNum } : m));
  };

  const handleUpdateMaskHint = (id: string, hint: string) => {
    setMasks(prev => prev.map(m => m.id === id ? { ...m, hint } : m));
  };

  const toggleMaskReveal = (id: string) => {
    setRevealedMasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Generate HTML for inserting directly into note / editor
  const generateInteractiveImageHtml = () => {
    const masksHtml = masks.map(m => `
      <div 
        class="image-cloze-mask" 
        style="position: absolute; left: ${m.x}%; top: ${m.y}%; width: ${m.width}%; height: ${m.height}%; background-color: rgba(99, 102, 241, 0.88); border: 2px solid #4f46e5; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 11px; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
        onclick="this.style.backgroundColor = this.style.backgroundColor === 'transparent' ? 'rgba(99, 102, 241, 0.88)' : 'transparent'; this.style.color = this.style.color === 'transparent' ? '#ffffff' : 'transparent';"
        title="Clique para revelar / ocultar [c${m.clozeNum}] ${m.hint ? `(${m.hint})` : ''}"
      >
        [c${m.clozeNum}]
      </div>
    `).join('');

    return `
      <div class="interactive-image-occlusion-container" style="position: relative; display: inline-block; max-width: 100%; margin: 12px auto; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <img src="${imageUrl}" alt="Image Occlusion Cloze" style="max-width: 100%; height: auto; display: block;" />
        ${masksHtml}
      </div>
    `;
  };

  const handleSaveAsFlashcards = () => {
    if (masks.length === 0) return;

    // Group masks by clozeNum or generate one card per cloze group
    const uniqueClozeNums = Array.from(new Set(masks.map(m => m.clozeNum)));

    uniqueClozeNums.forEach(cNum => {
      const activeMasks = masks.filter(m => m.clozeNum === cNum);
      const otherMasks = masks.filter(m => m.clozeNum !== cNum);

      // Front: image with all masks, highlighting the current target cloze
      const frontMasksHtml = masks.map(m => {
        const isCurrent = m.clozeNum === cNum;
        const bg = isCurrent ? '#f59e0b' : '#3b82f6';
        const label = isCurrent ? `[c${m.clozeNum}] ?` : `[c${m.clozeNum}]`;
        return `
          <div style="position: absolute; left: ${m.x}%; top: ${m.y}%; width: ${m.width}%; height: ${m.height}%; background-color: ${bg}; border: 2px solid #ffffff; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 11px; z-index: 10;">
            ${label}
          </div>
        `;
      }).join('');

      // Back: image with current target cloze revealed (transparent with border), others still masked
      const backMasksHtml = masks.map(m => {
        const isCurrent = m.clozeNum === cNum;
        if (isCurrent) {
          return `
            <div style="position: absolute; left: ${m.x}%; top: ${m.y}%; width: ${m.width}%; height: ${m.height}%; background-color: transparent; border: 2px dashed #10b981; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #10b981; font-weight: bold; font-size: 11px; z-index: 10; background: rgba(16, 185, 129, 0.1);">
              ✓ [c${m.clozeNum}]
            </div>
          `;
        }
        return `
          <div style="position: absolute; left: ${m.x}%; top: ${m.y}%; width: ${m.width}%; height: ${m.height}%; background-color: #3b82f6; border: 2px solid #ffffff; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 11px; z-index: 10;">
            [c${m.clozeNum}]
          </div>
        `;
      }).join('');

      const frontHtml = `
        <div style="text-align: center; margin-bottom: 8px;">
          <span style="font-weight: bold; font-size: 14px; color: #d97706;">Identifique a oclusão [c${cNum}]</span>
        </div>
        <div style="position: relative; display: inline-block; max-width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <img src="${imageUrl}" style="max-width: 100%; height: auto; display: block;" />
          ${frontMasksHtml}
        </div>
      `;

      const backHtml = `
        <div style="text-align: center; margin-bottom: 8px;">
          <span style="font-weight: bold; font-size: 14px; color: #059669;">Resposta Oclusão [c${cNum}] Revelada</span>
        </div>
        <div style="position: relative; display: inline-block; max-width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <img src="${imageUrl}" style="max-width: 100%; height: auto; display: block;" />
          ${backMasksHtml}
        </div>
      `;

      createCard({
        deckId: selectedDeckId,
        front: frontHtml,
        back: backHtml,
        tags: ['image-occlusion', `cloze-${cNum}`]
      });
    });

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleInsertHtml = () => {
    if (onInsertIntoEditor) {
      const html = generateInteractiveImageHtml();
      onInsertIntoEditor(html);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Adicionar Clozes na Imagem (Image Occlusion)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Clique e arraste sobre a imagem para criar máscaras de oclusão [c1, c2, c3...].
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main Visual Canvas */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-950 p-4 overflow-auto flex flex-col items-center justify-center relative select-none">
            {/* Top Toolbar */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-md">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Modo:</span>
              <button
                onClick={() => setPreviewMode('edit')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  previewMode === 'edit'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                ✏️ Desenhar / Editar
              </button>
              <button
                onClick={() => setPreviewMode('masked')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  previewMode === 'masked'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 inline mr-1" />
                Oculto
              </button>
              <button
                onClick={() => setPreviewMode('revealed')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  previewMode === 'revealed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5 inline mr-1" />
                Revelar Todos
              </button>
            </div>

            {/* Canvas Box */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`relative max-w-full max-h-[65vh] inline-block rounded-xl overflow-hidden shadow-lg border border-gray-300 dark:border-gray-700 ${
                previewMode === 'edit' ? 'cursor-crosshair' : 'cursor-default'
              }`}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Occlusion Target"
                className="max-h-[65vh] w-auto object-contain block pointer-events-none"
                draggable={false}
              />

              {/* Rendered Existing Masks */}
              {masks.map(mask => {
                const isSelected = selectedMaskId === mask.id;
                const isRevealed = previewMode === 'revealed' || (previewMode === 'masked' && revealedMasks[mask.id]);

                return (
                  <div
                    key={mask.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (previewMode === 'edit') {
                        setSelectedMaskId(mask.id);
                      } else {
                        toggleMaskReveal(mask.id);
                      }
                    }}
                    style={{
                      left: `${mask.x}%`,
                      top: `${mask.y}%`,
                      width: `${mask.width}%`,
                      height: `${mask.height}%`
                    }}
                    className={`absolute rounded transition-all flex items-center justify-center font-bold text-xs shadow-md ${
                      isRevealed
                        ? 'bg-transparent border-2 border-dashed border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : isSelected
                        ? 'bg-indigo-600/90 border-2 border-white ring-2 ring-indigo-400 text-white'
                        : 'bg-indigo-500/85 hover:bg-indigo-600 border border-white text-white'
                    } ${previewMode === 'masked' ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-pointer'}`}
                    title={previewMode === 'masked' ? 'Clique para revelar / ocultar' : `Máscara [c${mask.clozeNum}]`}
                  >
                    {!isRevealed ? (
                      <span>[c{mask.clozeNum}]</span>
                    ) : (
                      <span className="text-[10px]">✓ [c{mask.clozeNum}]</span>
                    )}

                    {previewMode === 'edit' && isSelected && (
                      <button
                        onClick={(e) => handleDeleteMask(mask.id, e)}
                        className="absolute -top-3 -right-3 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer"
                        title="Remover máscara"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Current Active Drawing Box */}
              {isDrawing && currentDraw && (
                <div
                  style={{
                    left: `${currentDraw.x}%`,
                    top: `${currentDraw.y}%`,
                    width: `${currentDraw.width}%`,
                    height: `${currentDraw.height}%`
                  }}
                  className="absolute bg-indigo-500/40 border-2 border-indigo-500 border-dashed rounded pointer-events-none flex items-center justify-center text-xs font-semibold text-white shadow-xs"
                >
                  Novo Cloze...
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              💡 {masks.length === 0 ? 'Clique e arraste em cima de qualquer área ou texto da imagem para criar a primeira máscara de oclusão.' : `${masks.length} máscara(s) criada(s). Você pode criar mais ou alternar o modo para testar a oclusão.`}
            </p>
          </div>

          {/* Right Configuration Sidebar */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 p-5 flex flex-col justify-between bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Máscaras ({masks.length})
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Gerencie as áreas ocluídas
                </p>
              </div>

              {/* List of Masks */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {masks.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400">
                    Nenhuma máscara desenhada ainda.
                  </div>
                ) : (
                  masks.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMaskId(m.id)}
                      className={`p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between cursor-pointer ${
                        selectedMaskId === m.id
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                          c{m.clozeNum}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={m.clozeNum}
                          onChange={(e) => handleUpdateMaskClozeNum(m.id, parseInt(e.target.value) || 1)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-12 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center"
                          title="Número do cloze"
                        />
                      </div>
                      <button
                        onClick={(e) => handleDeleteMask(m.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Destination Deck & Card Settings */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Baralho de Destino
                  </label>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.name || 'Baralho sem título'}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
              <button
                onClick={handleSaveAsFlashcards}
                disabled={masks.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Cards Criados com Sucesso!
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Criar Flashcards de Cloze ({masks.length})
                  </>
                )}
              </button>

              {onInsertIntoEditor && (
                <button
                  onClick={handleInsertHtml}
                  disabled={masks.length === 0}
                  className="w-full py-2 px-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Inserir na Nota / Editor
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
