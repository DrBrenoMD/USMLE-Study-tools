import React, { useState } from 'react';
import { Flashcard } from '../store/useStore';
import { RichEditor } from './RichEditor';
import { renderCardText } from '../lib/utils';
import { Eye, EyeOff, Tag as TagIcon, Flag, X } from 'lucide-react';

export const CardEditor: React.FC<{ card: Flashcard, onUpdate: (id: string, f: string, b: string, d?: string, tags?: string[], flag?: string) => void }> = ({ card, onUpdate }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [f, setF] = useState(card.front);
  const [b, setB] = useState(card.back);
  const [d, setD] = useState(card.details || '');
  const [tagInput, setTagInput] = useState('');

  const FLAGS = [
    { value: '', label: 'None', color: 'bg-ui-surface-hover' },
    { value: 'red', label: 'Red', color: 'bg-red-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'green', label: 'Green', color: 'bg-green-500' },
    { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
    { value: 'purple', label: 'Purple', color: 'bg-purple-500' },
  ];

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      const currentTags = card.tags || [];
      if (!currentTags.includes(newTag)) {
        const nextTags = [...currentTags, newTag];
        onUpdate(card.id, f, b, d, nextTags, card.flag);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = card.tags || [];
    const nextTags = currentTags.filter(t => t !== tagToRemove);
    onUpdate(card.id, f, b, d, nextTags, card.flag);
  };

  const handleFlagChange = (flagValue: string) => {
    onUpdate(card.id, f, b, d, card.tags, flagValue || undefined);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-ui-surface p-3 rounded-xl border border-ui-border">
        <div className="flex flex-col gap-3 w-full">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <TagIcon className="w-4 h-4 text-ui-muted" />
            {(card.tags || []).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-xs">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-ui-text transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input 
              type="text" 
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag (Enter)..." 
              className="bg-transparent border-none text-xs text-ui-text placeholder-white/30 focus:outline-none focus:ring-0 w-32"
            />
          </div>
          
          {/* Flag */}
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-ui-muted" />
            <div className="flex gap-2">
              {FLAGS.map(flag => (
                <button
                  key={flag.value || 'none'}
                  onClick={() => handleFlagChange(flag.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${flag.color} ${(card.flag || '') === flag.value ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  title={flag.label}
                />
              ))}
            </div>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 bg-ui-surface hover:bg-ui-surface-hover rounded-lg text-xs text-ui-muted transition-colors ml-4"
        >
          {showPreview ? <><EyeOff className="w-3 h-3" /> Edit Mode</> : <><Eye className="w-3 h-3" /> Preview</>}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold text-ui-muted uppercase tracking-wider mb-2">Front</div>
          {showPreview ? (
               <div 
                 className="p-3 bg-ui-surface border border-ui-border rounded-lg min-h-[60px] text-ui-text prose prose-invert max-w-none text-sm"
                 dangerouslySetInnerHTML={{ __html: renderCardText(f) || '<span class="text-ui-muted">Empty</span>' }}
               />
            ) : (
              <RichEditor value={f} onChange={(val) => { setF(val); onUpdate(card.id, val, b, d, card.tags, card.flag); }} />
            )}
        </div>
        <div>
          <div className="text-xs font-bold text-ui-muted uppercase tracking-wider mb-2">Back</div>
          {showPreview ? (
               <div 
                 className="p-3 bg-ui-surface border border-ui-border rounded-lg min-h-[60px] text-ui-text prose prose-invert max-w-none text-sm"
                 dangerouslySetInnerHTML={{ __html: renderCardText(b) || '<span class="text-ui-muted">Empty</span>' }}
               />
            ) : (
              <RichEditor value={b} onChange={(val) => { setB(val); onUpdate(card.id, f, val, d, card.tags, card.flag); }} />
            )}
        </div>
        <div>
          <div className="text-xs font-bold text-ui-muted uppercase tracking-wider mb-2">Details</div>
          {showPreview ? (
               <div 
                 className="p-3 bg-ui-surface border border-ui-border rounded-lg min-h-[60px] text-ui-text prose prose-invert max-w-none text-sm"
                 dangerouslySetInnerHTML={{ __html: renderCardText(d) || '<span class="text-ui-muted">Empty</span>' }}
               />
            ) : (
              <RichEditor value={d} onChange={(val) => { setD(val); onUpdate(card.id, f, b, val, card.tags, card.flag); }} />
            )}
        </div>
      </div>
    </div>
  )
}
