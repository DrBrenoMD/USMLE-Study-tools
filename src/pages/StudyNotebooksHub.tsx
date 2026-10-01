import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../cardblocks/store/useStore';
import { StudyNotebooksView } from '../cardblocks/pages/notebooks/StudyNotebooksView';
import { StudyNoteEditor } from '../cardblocks/pages/notebooks/StudyNoteEditor';
import { CardCreationModal } from '../cardblocks/components/CardCreationModal';
import { Page } from '../cardblocks/App';
import { useQBankSync } from '../hooks/useQBankSync';

export default function StudyNotebooksHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { studyNotes, createStudyNote, createNoteFromQuestion, notebookAreas } = useStore();

  useQBankSync();

  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    return searchParams.get('noteId') || null;
  });

  const [cardCreatorData, setCardCreatorData] = useState<any>(null);

  // Escuta parâmetros de URL para criação ou abertura de nota
  useEffect(() => {
    const noteIdParam = searchParams.get('noteId');
    const createForQid = searchParams.get('createForQid') || searchParams.get('qid');
    const areaIdParam = searchParams.get('areaId');

    if (noteIdParam) {
      setActiveNoteId(noteIdParam);
    } else {
      const pendingFocus = localStorage.getItem('pending_note_focus');
      if (pendingFocus) {
        setActiveNoteId(pendingFocus);
        localStorage.removeItem('pending_note_focus');
      }
    }

    if (createForQid) {
      const qid = createForQid.trim();
      const existing = studyNotes.find(n => n.associatedQuestionIds?.includes(qid));
      if (existing) {
        setActiveNoteId(existing.id);
      } else {
        const targetArea = areaIdParam || notebookAreas[0]?.id || 'area-clinica';
        const newId = createNoteFromQuestion({ qid, stem: `Questão QID: ${qid}` }, targetArea);
        setActiveNoteId(newId);
      }
    }

    // Checa se há nota pendente exportada recentemente via localStorage
    try {
      const pendingNote = localStorage.getItem('pending_note_import');
      if (pendingNote) {
        const parsed = JSON.parse(pendingNote);
        if (parsed) {
          const targetArea = areaIdParam || notebookAreas[0]?.id || 'area-clinica';
          const newId = createNoteFromQuestion(parsed, targetArea);
          setActiveNoteId(newId);
          localStorage.removeItem('pending_note_import');
        }
      }
    } catch(e) {}
  }, [searchParams, studyNotes, createNoteFromQuestion, notebookAreas]);

  // Listener global para criação de nota vinda da extensão ou de outras partes do app
  useEffect(() => {
    const handleIncomingNoteCreation = (e: any) => {
      const detail = e.detail || e.data;
      if (detail && (detail.type === 'CREATE_NOTE_FROM_QUESTION' || detail.action === 'create_note_from_question') && (detail.question || detail.questionData)) {
        const qData = detail.question || detail.questionData;
        const targetArea = detail.areaId || notebookAreas[0]?.id || 'area-clinica';
        const noteId = createNoteFromQuestion(qData, targetArea, detail.customTitle);
        setActiveNoteId(noteId);
      } else if (e.type === 'usmle_note_created' && e.detail?.noteId) {
        setActiveNoteId(e.detail.noteId);
      }
    };

    window.addEventListener('usmle_create_note', handleIncomingNoteCreation as EventListener);
    window.addEventListener('usmle_note_created', handleIncomingNoteCreation as EventListener);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('usmle_qbank_sync');
      bc.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'CREATE_NOTE_FROM_QUESTION' || event.data.action === 'create_note_from_question') {
          handleIncomingNoteCreation(event);
        }
      };
    } catch(e) {}

    return () => {
      window.removeEventListener('usmle_create_note', handleIncomingNoteCreation as EventListener);
      window.removeEventListener('usmle_note_created', handleIncomingNoteCreation as EventListener);
      if (bc) bc.close();
    };
  }, [createNoteFromQuestion, notebookAreas]);

  const handleNavigateCardblocks = (p: Page) => {
    if (p.type === 'deck') {
      navigate(`/flashcards?deckId=${p.deckId}`);
    } else if (p.type === 'study') {
      navigate(`/flashcards?deckId=${p.deckId || ''}&tab=study`);
    } else if (p.type === 'banks' || p.type === 'bank') {
      navigate(`/questions?bankId=${(p as any).bankId || ''}`);
    } else if (p.type === 'question') {
      navigate(`/questions?qid=${(p as any).questionId || ''}`);
    } else if (p.type === 'home') {
      navigate('/');
    }
  };

  return (
    <div className="flex-1 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
      {activeNoteId ? (
        <StudyNoteEditor
          noteId={activeNoteId}
          onNavigate={handleNavigateCardblocks}
          onBack={() => {
            setActiveNoteId(null);
            setSearchParams({});
          }}
        />
      ) : (
        <StudyNotebooksView
          onNavigate={handleNavigateCardblocks}
          onOpenNote={(noteId) => {
            setActiveNoteId(noteId);
            setSearchParams({ noteId });
          }}
        />
      )}

      {/* Modal para criar card se solicitado dentro do editor */}
      {cardCreatorData && (
        <CardCreationModal
          onClose={() => setCardCreatorData(null)}
          initialData={cardCreatorData}
        />
      )}
    </div>
  );
}
