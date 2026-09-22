import React, { useState, useEffect } from 'react';
import { useStore, Note, Question, Flashcard } from '../store/useStore';
import { X, Save, Trash2, Clock, Sparkles } from 'lucide-react';
import { RichEditor } from './RichEditor';
import { format } from 'date-fns';
import { sanitizeHtml } from '../lib/utils';

export const NotepadModal: React.FC<{ 
  onClose: () => void;
  targetId: string;
  targetType: 'question' | 'card' | 'standalone';
  bankId?: string;
}> = ({ onClose, targetId, targetType, bankId }) => {
  const { notes, createNote, updateNote, deleteNote, questions, cards } = useStore();
  
  const existingNote = notes.find(n => n.targetId === targetId && n.targetType === targetType);
  const [content, setContent] = useState(existingNote?.content || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSave = () => {
    if (existingNote) {
      updateNote(existingNote.id, content);
    } else {
      createNote({
        targetType,
        targetId,
        bankId,
        content
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (existingNote && confirm("Are you sure you want to delete this note?")) {
      deleteNote(existingNote.id);
      onClose();
    }
  };

  const getTargetQuestion = () => {
    if (targetType === 'question') {
      return questions.find(q => q.id === targetId);
    } else if (targetType === 'card') {
      const c = cards.find(c => c.id === targetId);
      if (c?.sourceQuestionId) {
         return questions.find(q => q.id === c.sourceQuestionId);
      }
    }
    return null;
  }

  const handlePullExplanation = () => {
    if (targetType === 'standalone') return;
    
    const q = getTargetQuestion();
    const explanation = q?.explanation;

    if (explanation) {
      setContent(prev => {
         if (prev.trim()) {
            return prev + "<br/><br/><p><b>Explanation:</b></p>" + explanation;
         }
         return "<p><b>Explanation:</b></p>" + explanation;
      });
    } else {
       alert("No explanation found for this item.");
    }
  };

  const handleAiGenerate = async () => {
    const q = getTargetQuestion();
    if (!q) {
      alert("No question content found to generate AI notes.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-study-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: q.text,
          explanation: q.explanation,
          alternatives: q.alternatives,
          type: 'note'
        })
      });

      if (!response.ok) throw new Error("API request failed");
      
      const rawText = await response.text();
      const data = JSON.parse(rawText);
      
      if (data.note) {
        setContent(prev => {
          const newText = `<p><strong>AI Synth:</strong><br/>${sanitizeHtml(data.note)}</p>`;
          return prev.trim() ? prev + "<br/><br/>" + newText : newText;
        });
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to generate AI note.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-ui-background border border-ui-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-ui-border shrink-0 text-ui-text">
          <div>
            <h2 className="text-xl font-bold">Notes</h2>
            {existingNote && (
              <p className="text-xs text-ui-muted flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> Last updated: {format(existingNote.updatedAt, 'MMM d, yyyy HH:mm')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {targetType !== 'standalone' && (
              <>
                <button 
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 font-bold rounded-lg transition-colors border border-indigo-500/20 text-xs disabled:opacity-50"
                  title="Generate automatically from question"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? "Generating..." : "AI Generate"}
                </button>
                <button 
                  onClick={handlePullExplanation}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors border border-primary/20 text-xs mr-2"
                >
                  Pull Explanation
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-ui-surface rounded-full text-ui-muted hover:text-ui-text transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-0 overflow-hidden flex-1 flex flex-col relative h-full">
          <div className="flex-1 overflow-y-auto bg-ui-surface p-6">
            <RichEditor value={content} onChange={setContent} placeholder="Start typing your notes here..." className="min-h-[200px]" />
          </div>
        </div>

        <div className="p-4 border-t border-ui-border flex justify-between items-center shrink-0 bg-ui-background">
          {existingNote ? (
            <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-ui-muted font-bold hover:text-ui-text transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Save className="w-5 h-5" />
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
