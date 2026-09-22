import React, { useState } from 'react';
import { useStore, Note } from '../store/useStore';
import { Page } from '../App';
import { StickyNote, Plus, Trash2, Edit2, ArrowLeft, Clock } from 'lucide-react';
import { RichEditor } from '../components/RichEditor';
import { format } from 'date-fns';
import { sanitizeHtml } from '../lib/utils';

export const NotepadView: React.FC<{ onNavigate: (p: Page) => void }> = ({ onNavigate }) => {
  const { notes, createNote, updateNote, deleteNote } = useStore();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id || null);
  const [activeContent, setActiveContent] = useState<string>('');

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const handleCreateNew = () => {
    const id = createNote({
      targetType: 'standalone',
      targetId: 'standalone-' + Date.now(),
      content: '<p>Nova anotação...</p>'
    });
    setSelectedNoteId(id);
    setActiveContent('<p>Nova anotação...</p>');
  };

  const handleContentChange = (content: string) => {
    setActiveContent(content);
    if (selectedNoteId) {
      updateNote(selectedNoteId, content);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'home' })}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <StickyNote className="w-6 h-6 text-amber-500" />
              Bloco de Notas (Scratchpad)
            </h2>
            <p className="text-xs text-gray-500">{notes.length} anotações salvas</p>
          </div>
        </div>

        <button
          onClick={handleCreateNew}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Nota
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[500px]">
        {/* Left: Notes list */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-xs space-y-2 overflow-y-auto max-h-[600px]">
          {notes.map(note => {
            const isSelected = note.id === selectedNoteId;
            return (
              <div
                key={note.id}
                onClick={() => {
                  setSelectedNoteId(note.id);
                  setActiveContent(note.content);
                }}
                className={`p-3 rounded-xl cursor-pointer transition-colors border flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div
                  className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content || 'Nota sem conteúdo') }}
                />
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(note.updatedAt || note.createdAt || Date.now(), 'dd/MM HH:mm')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Excluir esta nota?")) {
                        deleteNote(note.id);
                        if (selectedNoteId === note.id) {
                          setSelectedNoteId(null);
                        }
                      }
                    }}
                    className="p-1 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {notes.length === 0 && (
            <p className="text-center py-12 text-xs text-gray-500">Nenhuma anotação criada ainda.</p>
          )}
        </div>

        {/* Right: Note editor */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xs flex flex-col">
          {selectedNote ? (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="text-xs text-gray-400">
                Última alteração: {format(selectedNote.updatedAt || Date.now(), 'dd/MM/yyyy HH:mm:ss')}
              </div>
              <div className="flex-1">
                <RichEditor
                  value={activeContent || selectedNote.content}
                  onChange={handleContentChange}
                  placeholder="Escreva suas anotações médicas, resumos ou dúvidas aqui..."
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-xs">
              Selecione uma anotação à esquerda ou clique em "Nova Nota" para começar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
