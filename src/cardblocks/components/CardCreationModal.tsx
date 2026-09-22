import React, { useState } from 'react';
import { useStore, Question } from '../store/useStore';
import { X, Save, Sparkles, PlusCircle } from 'lucide-react';
import { RichEditor } from './RichEditor';

export const CardCreationModal: React.FC<{ 
  onClose: () => void;
  sourceQuestion?: Question;
}> = ({ onClose, sourceQuestion }) => {
  const { decks, createDeck, createCard } = useStore();
  const [deckId, setDeckId] = useState<string>('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState<string>(sourceQuestion?.tags?.join(', ') || '');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<{front: string, back: string}[]>([]);

  React.useEffect(() => {
    const genDeck = decks.find(d => d.name === "Generated Cards");
    if (genDeck) {
      setDeckId(genDeck.id);
    } else if (decks.length > 0) {
      setDeckId(decks[0].id);
    }
  }, [decks]);

  const getFinalDeckId = () => {
    let finalDeckId = deckId;
    if (!finalDeckId) {
      if (decks.length === 0) {
        finalDeckId = createDeck("Default Deck");
      } else {
        return null;
      }
    }
    return finalDeckId;
  };

  const handleCreate = () => {
    const finalDeckId = getFinalDeckId();
    if (!finalDeckId) return;
    
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    
    createCard(finalDeckId, front, back, undefined, tagArray, undefined, sourceQuestion?.id);
    
    setFront('');
    setBack('');
    alert("Card saved!");
  };

  const handleSaveGeneratedCard = (card: {front: string, back: string}, index: number) => {
    const finalDeckId = getFinalDeckId();
    if (!finalDeckId) {
       alert("Please select a deck.");
       return;
    }
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!tagArray.includes("ai-generated")) tagArray.push("ai-generated");
    
    createCard(finalDeckId, card.front, card.back, undefined, tagArray, undefined, sourceQuestion?.id);
    
    setGeneratedCards(prev => prev.filter((_, i) => i !== index));
    alert("AI Generated Card saved!");
  };

  const handlePullExplanation = () => {
    if (!sourceQuestion) return;
    
    const explanation = sourceQuestion.explanation;
    if (explanation) {
      setBack(prev => {
         const newText = `<p><b>Explanation:</b></p>${explanation}`;
         return prev.trim() ? prev + "<br/><br/>" + newText : newText;
      });
    } else {
      alert("No explanation available for this question.");
    }
  };

  const handleAiGenerate = async () => {
    if (!sourceQuestion) {
      alert("No source question to generate cards from.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-study-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceQuestion.text,
          explanation: sourceQuestion.explanation,
          alternatives: sourceQuestion.alternatives,
          type: 'flashcards'
        })
      });

      if (!response.ok) throw new Error("API request failed");
      
      const rawText = await response.text();
      const data = JSON.parse(rawText);
      
      if (data.flashcards && Array.isArray(data.flashcards)) {
        setGeneratedCards(data.flashcards);
      } else {
         alert("AI did not return the expected format.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to generate AI flashcards.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-ui-background border border-ui-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-ui-border shrink-0 text-ui-text">
          <h2 className="text-xl font-bold">Create Flashcard</h2>
          <button onClick={onClose} className="p-2 hover:bg-ui-surface rounded-full text-ui-muted hover:text-ui-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-ui-text">
          {sourceQuestion && (
            <div className="bg-ui-surface p-4 rounded-xl border border-ui-border flex flex-col gap-4">
              <div className="flex justify-between items-center gap-4">
                <p className="text-sm text-ui-muted flex-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: sourceQuestion.text }} />
                <button 
                  onClick={handlePullExplanation}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors border border-primary/20 shrink-0 text-sm"
                >
                  Pull Explanation
                </button>
              </div>
              
              <div className="border-t border-ui-border py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> AI Suggestions
                  </h3>
                  <button
                    onClick={handleAiGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-bold shadow hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {isGenerating ? "Generating..." : "Generate Cards"}
                  </button>
                </div>
                
                {generatedCards.length > 0 && (
                  <div className="space-y-4">
                    {generatedCards.map((card, i) => (
                      <div key={i} className="flex gap-4 p-4 border border-indigo-500/30 bg-indigo-500/5 rounded-xl text-sm">
                        <div className="flex-1 space-y-2">
                          <div>
                            <span className="font-bold text-indigo-400 text-xs uppercase tracking-wider">Front</span>
                            <div className="bg-ui-background p-2 rounded border border-ui-border" dangerouslySetInnerHTML={{ __html: card.front }} />
                          </div>
                          <div>
                            <span className="font-bold text-indigo-400 text-xs uppercase tracking-wider">Back</span>
                            <div className="bg-ui-background p-2 rounded border border-ui-border" dangerouslySetInnerHTML={{ __html: card.back }} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 justify-center shrink-0 border-l border-indigo-500/20 pl-4 w-32">
                          <button
                            onClick={() => { setFront(card.front); setBack(card.back); }}
                            className="px-3 py-1.5 bg-ui-surface border-ui-border border hover:bg-ui-surface-hover rounded font-bold text-xs shadow-sm transition-colors text-center"
                          >
                            Edit Manually
                          </button>
                          <button
                            onClick={() => handleSaveGeneratedCard(card, i)}
                            className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1"
                          >
                            <PlusCircle className="w-3 h-3" /> Save Card
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ui-muted mb-2">Deck</label>
              <select 
                value={deckId} 
                onChange={e => setDeckId(e.target.value)}
                className="w-full bg-ui-surface border border-ui-border rounded-lg px-4 py-2 text-ui-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="" disabled>Select a deck...</option>
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ui-muted mb-2">Front</label>
              <div className="bg-ui-surface border border-ui-border rounded-lg overflow-hidden relative">
                <RichEditor value={front} onChange={setFront} className="min-h-[120px] p-4" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ui-muted mb-2">Back</label>
              <div className="bg-ui-surface border border-ui-border rounded-lg overflow-hidden relative">
                <RichEditor value={back} onChange={setBack} className="min-h-[120px] p-4" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ui-muted mb-2">Tags (comma separated)</label>
              <input 
                type="text" 
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full bg-ui-surface border border-ui-border rounded-lg px-4 py-2 text-ui-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. biology, exam2024"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-ui-border flex justify-between items-center shrink-0">
          <p className="text-sm text-ui-muted font-medium">Any changes will be saved to the selected deck.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-ui-muted font-bold hover:text-ui-text transition-colors">
              Close
            </button>
            <button 
              onClick={handleCreate}
              disabled={!deckId && decks.length > 0 || !front || !back}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              Save Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
