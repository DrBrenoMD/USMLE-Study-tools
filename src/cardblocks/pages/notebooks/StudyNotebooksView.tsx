import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore, StudyNote, NotebookArea, NotebookSystem, NotebookSubject, NotebookTopic } from '../../store/useStore';
import { Page } from '../../App';
import {
  BookOpen,
  Plus,
  Search,
  FolderPlus,
  Tag,
  Pin,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Layers,
  HelpCircle,
  ExternalLink,
  Edit2,
  Trash2,
  MoreVertical,
  Filter,
  Grid,
  List,
  FileText,
  Printer,
  ChevronUp,
  GripVertical,
  Volume2,
  Video,
  Code,
  Check,
  X,
  Palette,
  Eye,
  EyeOff,
  Maximize2,
  Copy,
  Folder,
  Layers as LayersIcon,
  Sidebar as SidebarIcon,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  AlertTriangle,
  ArrowRight,
  Move,
  CornerDownRight,
  FolderTree
} from 'lucide-react';
import { sanitizeHtml, renderNoteContentWithClozes, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { PdfExportModal } from '../../components/PdfExportModal';
import { NoteAssociationsPreviewModal } from '../../components/NoteAssociationsPreviewModal';
import { EmbeddedFlashcardBlock } from '../../components/EmbeddedFlashcardBlock';
import { CodeSandboxRunner } from '../../components/CodeSandboxRunner';
import { VideoEmbedPlayer } from '../../components/VideoEmbedPlayer';
import { AudioVoiceRecorder } from '../../components/AudioVoiceRecorder';
import { InlineNoteRichEditor } from './InlineNoteRichEditor';

interface StudyNotebooksViewProps {
  onNavigate: (page: Page) => void;
  onOpenNote?: (noteId: string) => void;
  initialAreaId?: string;
  initialNoteId?: string;
}

const COLOR_PRESETS = [
  { name: 'Padrão / Neutro', hex: '', label: 'Sem destaque', border: '#e2e8f0', bg: '' },
  { name: 'Azul Destaque', hex: '#3b82f6', label: 'Azul', border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { name: 'Esmeralda Destaque', hex: '#10b981', label: 'Verde', border: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { name: 'Rosa Destaque', hex: '#ec4899', label: 'Rosa', border: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { name: 'Âmbar / Amarelo Destaque', hex: '#f59e0b', label: 'Amarelo', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { name: 'Roxo Destaque', hex: '#8b5cf6', label: 'Roxo', border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { name: 'Ciano Destaque', hex: '#06b6d4', label: 'Ciano', border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  { name: 'Laranja Destaque', hex: '#f97316', label: 'Laranja', border: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  { name: 'Vermelho Destaque', hex: '#ef4444', label: 'Vermelho', border: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
];

export const StudyNotebooksView: React.FC<StudyNotebooksViewProps> = ({
  onNavigate,
  onOpenNote,
  initialAreaId,
  initialNoteId
}) => {
  const {
    studyNotebooks,
    notebookAreas,
    notebookSystems,
    notebookSubjects,
    notebookTopics,
    studyNotes,
    cards,
    questions,
    createNotebookArea,
    updateNotebookArea,
    deleteNotebookArea,
    createNotebookSystem,
    deleteNotebookSystem,
    createNotebookSubject,
    deleteNotebookSubject,
    createNotebookTopic,
    deleteNotebookTopic,
    createStudyNote,
    deleteStudyNote,
    updateStudyNote,
    moveStudyNote,
    reorderStudyNotes
  } = useStore();

  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => initialAreaId || 'all');
  const [selectedSystemId, setSelectedSystemId] = useState<string>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lateral Navigation Bar Visibility Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Layout switcher: Document (default Notion continuous), Grid (Blocos), List
  const [viewLayout, setViewLayout] = useState<'document' | 'grid' | 'list'>('document');

  // Persisted Collapsed States (Notes & Sections)
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cardblocks_collapsed_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cardblocks_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save collapsed states to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('cardblocks_collapsed_notes', JSON.stringify(collapsedNotes));
    } catch (e) {}
  }, [collapsedNotes]);

  useEffect(() => {
    try {
      localStorage.setItem('cardblocks_collapsed_sections', JSON.stringify(collapsedSections));
    } catch (e) {}
  }, [collapsedSections]);

  // Inline Note Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Fast inline title editing
  const [editingTitleNoteId, setEditingTitleNoteId] = useState<string | null>(null);
  const [inlineTitleValue, setInlineTitleValue] = useState('');

  // Per-note Clozes Reveal state for active recall in notes
  const [revealedClozeNotes, setRevealedClozeNotes] = useState<Record<string, boolean>>({});

  const handleNoteContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const clozeSpan = target.closest('[data-note-cloze="true"]') as HTMLElement | null;
    if (clozeSpan) {
      e.stopPropagation();
      const isRevealed = clozeSpan.getAttribute('data-revealed') === 'true';
      const answer = clozeSpan.getAttribute('data-answer') || '';
      const hint = clozeSpan.getAttribute('data-hint') || '';
      if (isRevealed) {
        clozeSpan.setAttribute('data-revealed', 'false');
        clozeSpan.classList.remove('cloze-revealed', 'text-emerald-700', 'bg-emerald-100', 'dark:bg-emerald-950/60', 'dark:text-emerald-300', 'border-emerald-300', 'dark:border-emerald-800');
        clozeSpan.classList.add('text-blue-700', 'bg-blue-100', 'dark:bg-blue-950/60', 'dark:text-blue-300', 'border-blue-300', 'dark:border-blue-800');
        clozeSpan.innerHTML = hint ? `[${hint}]` : '[...]';
        clozeSpan.title = 'Clique para revelar a resposta';
      } else {
        clozeSpan.setAttribute('data-revealed', 'true');
        clozeSpan.classList.remove('text-blue-700', 'bg-blue-100', 'dark:bg-blue-950/60', 'dark:text-blue-300', 'border-blue-300', 'dark:border-blue-800');
        clozeSpan.classList.add('cloze-revealed', 'text-emerald-700', 'bg-emerald-100', 'dark:bg-emerald-950/60', 'dark:text-emerald-300', 'border-emerald-300', 'dark:border-emerald-800');
        clozeSpan.innerHTML = answer;
        clozeSpan.title = 'Clique para ocultar';
      }
    }
  };

  // Drag and Drop Reordering States
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ noteId: string; position: 'before' | 'after' } | null>(null);

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetType: 'note' | 'area' | 'system' | 'subject' | 'general';
    note?: StudyNote;
    area?: NotebookArea;
    system?: NotebookSystem;
    subject?: NotebookSubject;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetType: 'general'
  });

  // Hierarchy Hierarchy Assignment Modal (Assign note to Area/System/Subject/Topic)
  const [hierarchyModalNote, setHierarchyModalNote] = useState<StudyNote | null>(null);

  // Modals & Drawers
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<NotebookArea | null>(null);
  const [areaNameInput, setAreaNameInput] = useState('');
  const [areaColorInput, setAreaColorInput] = useState('#3b82f6');

  // Safe Area Deletion Modal State
  const [areaToDelete, setAreaToDelete] = useState<NotebookArea | null>(null);
  const [deleteAreaMode, setDeleteAreaMode] = useState<'move' | 'delete_all'>('move');
  const [destinationAreaId, setDestinationAreaId] = useState<string>('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // PDF Export Modal State
  const [pdfExportConfig, setPdfExportConfig] = useState<{
    isOpen: boolean;
    areaId?: string;
    noteId?: string;
  }>({ isOpen: false });

  // Fast Subcategory Add Modal
  const [isAddingCategory, setIsAddingCategory] = useState<{
    type: 'system' | 'subject' | 'topic';
    areaId: string;
    systemId?: string | null;
    subjectId?: string | null;
  } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Associations preview modal
  const [associationsModal, setAssociationsModal] = useState<{
    title: string;
    questionIds: string[];
    cardIds: string[];
  } | null>(null);

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.visible]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const toggleNoteCollapse = (noteId: string) => {
    setCollapsedNotes(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const handleExpandAllSections = (expand: boolean) => {
    const nextCollapsed: Record<string, boolean> = {};
    notebookAreas.forEach(a => {
      nextCollapsed[`area-${a.id}`] = !expand;
      notebookSystems.filter(s => s.areaId === a.id).forEach(s => {
        nextCollapsed[`sys-${s.id}`] = !expand;
        notebookSubjects.filter(sub => sub.systemId === s.id).forEach(sub => {
          nextCollapsed[`subj-${sub.id}`] = !expand;
        });
      });
    });
    setCollapsedSections(nextCollapsed);
  };

  const handleExpandAllNotes = (expand: boolean) => {
    const nextCollapsed: Record<string, boolean> = {};
    studyNotes.forEach(n => {
      nextCollapsed[n.id] = !expand;
    });
    setCollapsedNotes(nextCollapsed);
  };

  // Filtered areas based on selection
  const displayedAreas = useMemo(() => {
    if (selectedAreaId !== 'all') {
      return notebookAreas.filter(a => a.id === selectedAreaId);
    }
    return notebookAreas;
  }, [notebookAreas, selectedAreaId]);

  // All Tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    studyNotes.forEach(n => {
      n.tags?.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [studyNotes]);

  // Notes filtering
  const filterNoteMatch = (note: StudyNote) => {
    if (selectedTag !== 'all' && (!note.tags || !note.tags.includes(selectedTag))) return false;
    if (selectedSystemId !== 'all' && note.systemId !== selectedSystemId) return false;
    if (selectedSubjectId !== 'all' && note.subjectId !== selectedSubjectId) return false;
    if (selectedTopicId !== 'all' && note.topicId !== selectedTopicId) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(query);
      const matchContent = note.content.toLowerCase().includes(query);
      const matchTags = note.tags?.some(t => t.toLowerCase().includes(query));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    return true;
  };

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaNameInput.trim()) return;

    if (editingArea) {
      updateNotebookArea(editingArea.id, {
        name: areaNameInput.trim(),
        color: areaColorInput
      });
    } else {
      const newId = createNotebookArea(areaNameInput.trim(), areaColorInput);
      setSelectedAreaId(newId);
    }

    setEditingArea(null);
    setAreaNameInput('');
    setIsAreaModalOpen(false);
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingCategory || !newCategoryName.trim()) return;

    if (isAddingCategory.type === 'system') {
      createNotebookSystem(isAddingCategory.areaId, newCategoryName.trim());
    } else if (isAddingCategory.type === 'subject') {
      createNotebookSubject(isAddingCategory.areaId, newCategoryName.trim(), isAddingCategory.systemId || null);
    } else if (isAddingCategory.type === 'topic') {
      createNotebookTopic(isAddingCategory.areaId, newCategoryName.trim(), isAddingCategory.systemId || null, isAddingCategory.subjectId || null);
    }

    setIsAddingCategory(null);
    setNewCategoryName('');
  };

  // Safe Area Deletion Handler
  const handleConfirmDeleteArea = () => {
    if (!areaToDelete) return;

    const notesInArea = studyNotes.filter(n => n.areaId === areaToDelete.id);

    if (notesInArea.length > 0) {
      if (deleteAreaMode === 'move' && destinationAreaId) {
        notesInArea.forEach(note => {
          moveStudyNote(note.id, {
            areaId: destinationAreaId,
            systemId: null,
            subjectId: null,
            topicId: null
          });
        });
      } else {
        notesInArea.forEach(note => {
          deleteStudyNote(note.id);
        });
      }
    }

    deleteNotebookArea(areaToDelete.id);

    if (selectedAreaId === areaToDelete.id) {
      setSelectedAreaId('all');
    }

    setAreaToDelete(null);
    setDeleteConfirmInput('');
  };

  // Create note inline directly without cumbersome placeholder text
  const handleCreateNoteInline = (areaId: string, systemId: string | null = null, subjectId: string | null = null, topicId: string | null = null) => {
    const targetArea = areaId || (notebookAreas[0]?.id || 'area-clinica');
    const newNoteId = createStudyNote({
      areaId: targetArea,
      systemId,
      subjectId,
      topicId,
      title: 'Nova Nota',
      content: '',
      icon: '📝'
    });
    setCollapsedNotes(prev => ({ ...prev, [newNoteId]: false }));
    setEditingNoteId(newNoteId);
  };

  // Drag and Drop Note Handlers
  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNoteId(noteId);
  };

  const handleDragOverNote = (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedNoteId === targetNoteId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    setDragOverInfo({ noteId: targetNoteId, position });
  };

  const handleDragLeaveNote = () => {
    setDragOverInfo(null);
  };

  const handleDropOnNote = (e: React.DragEvent, targetNote: StudyNote) => {
    e.preventDefault();
    const sourceNoteId = e.dataTransfer.getData('text/plain') || draggedNoteId;

    if (!sourceNoteId || sourceNoteId === targetNote.id) {
      setDraggedNoteId(null);
      setDragOverInfo(null);
      return;
    }

    const sourceNote = studyNotes.find(n => n.id === sourceNoteId);
    if (!sourceNote) return;

    // If source note is from a different area/system, move it first to target hierarchy
    if (sourceNote.areaId !== targetNote.areaId || sourceNote.systemId !== targetNote.systemId) {
      moveStudyNote(sourceNoteId, {
        areaId: targetNote.areaId,
        systemId: targetNote.systemId,
        subjectId: targetNote.subjectId,
        topicId: targetNote.topicId
      });
    }

    // Reorder note IDs list
    const currentOrder = studyNotes.map(n => n.id);
    const sourceIdx = currentOrder.indexOf(sourceNoteId);
    if (sourceIdx !== -1) {
      currentOrder.splice(sourceIdx, 1);
    }

    const targetIdx = currentOrder.indexOf(targetNote.id);
    const insertIdx = dragOverInfo?.position === 'after' ? targetIdx + 1 : targetIdx;
    currentOrder.splice(insertIdx, 0, sourceNoteId);

    reorderStudyNotes(currentOrder);

    setDraggedNoteId(null);
    setDragOverInfo(null);
  };

  const handleDropOnSection = (e: React.DragEvent, areaId: string, systemId: string | null = null, subjectId: string | null = null, topicId: string | null = null) => {
    e.preventDefault();
    const sourceNoteId = e.dataTransfer.getData('text/plain') || draggedNoteId;
    if (sourceNoteId) {
      moveStudyNote(sourceNoteId, { areaId, systemId, subjectId, topicId });
    }
    setDraggedNoteId(null);
    setDragOverInfo(null);
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, targetType: 'note' | 'area' | 'system' | 'subject' | 'general', data?: { note?: StudyNote; area?: NotebookArea; system?: NotebookSystem; subject?: NotebookSubject }) => {
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, window.innerWidth - 250);
    const y = Math.min(e.clientY, window.innerHeight - 380);

    setContextMenu({
      visible: true,
      x,
      y,
      targetType,
      note: data?.note,
      area: data?.area,
      system: data?.system,
      subject: data?.subject
    });
  };

  // Duplicate Note
  const handleDuplicateNote = (note: StudyNote) => {
    createStudyNote({
      areaId: note.areaId,
      systemId: note.systemId,
      subjectId: note.subjectId,
      topicId: note.topicId,
      title: `${note.title} (Cópia)`,
      content: note.content,
      icon: note.icon,
      tags: note.tags ? [...note.tags] : [],
      color: note.color,
      associatedCardIds: note.associatedCardIds ? [...note.associatedCardIds] : [],
      associatedQuestionIds: note.associatedQuestionIds ? [...note.associatedQuestionIds] : [],
      embeddedFlashcardIds: note.embeddedFlashcardIds ? [...note.embeddedFlashcardIds] : []
    });
  };

  const handleSetNoteColor = (noteId: string, colorHex: string) => {
    updateStudyNote(noteId, { color: colorHex });
  };

  const handleSetAreaColor = (areaId: string, colorHex: string) => {
    updateNotebookArea(areaId, { color: colorHex });
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-5 max-w-[1600px] mx-auto pb-28 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* LATERAL NAVIGATION BAR (BARRA DE NAVEGAÇÃO LATERAL HIERÁRQUICA) */}
      {/* ========================================================================= */}
      <aside
        className={cn(
          "shrink-0 transition-all duration-300 z-20",
          isSidebarOpen
            ? "w-full lg:w-72 xl:w-80"
            : "w-full lg:w-14"
        )}
      >
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 shadow-xs sticky top-20 flex flex-col gap-4">
          {/* Sidebar Header & Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className={cn("flex items-center gap-2.5 overflow-hidden", !isSidebarOpen && "lg:hidden")}>
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-500/20">
                📚
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                  Hierarquia
                </h3>
                <p className="text-[11px] text-gray-400 truncate">
                  {notebookAreas.length} Áreas • {studyNotes.length} Notas
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors hidden lg:flex items-center justify-center cursor-pointer"
              title={isSidebarOpen ? "Recolher Barra Lateral" : "Expandir Barra Lateral"}
            >
              {isSidebarOpen ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Collapsed view icon button on desktop */}
          {!isSidebarOpen && (
            <div className="hidden lg:flex flex-col items-center gap-3 py-2">
              <button
                onClick={() => { setSelectedAreaId('all'); setIsSidebarOpen(true); }}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                  selectedAreaId === 'all' ? "bg-blue-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600"
                )}
                title="Todas as Áreas"
              >
                ♾️
              </button>
              {notebookAreas.map(area => (
                <button
                  key={area.id}
                  onClick={() => { setSelectedAreaId(area.id); setIsSidebarOpen(true); }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative border border-transparent hover:border-gray-300 cursor-pointer"
                  style={{ backgroundColor: `${area.color}20`, color: area.color }}
                  title={area.name}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: area.color }} />
                </button>
              ))}
            </div>
          )}

          {/* Full Sidebar Body with Complete 4-Level Nested Hierarchy */}
          {isSidebarOpen && (
            <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
              {/* "Todas as Áreas" Root Button */}
              <button
                onClick={() => {
                  setSelectedAreaId('all');
                  setSelectedSystemId('all');
                  setSelectedSubjectId('all');
                  setSelectedTopicId('all');
                }}
                className={cn(
                  "w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer",
                  selectedAreaId === 'all'
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>📖</span>
                  <span>Todas as Áreas</span>
                </div>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-extrabold",
                  selectedAreaId === 'all' ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                )}>
                  {studyNotes.length}
                </span>
              </button>

              {/* Hierarchy Tree by Area > System > Subject > Topic */}
              <div className="space-y-2">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
                  <span>Áreas de Estudo</span>
                  <button
                    onClick={() => {
                      setEditingArea(null);
                      setAreaNameInput('');
                      setAreaColorInput('#3b82f6');
                      setIsAreaModalOpen(true);
                    }}
                    className="hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded cursor-pointer flex items-center gap-1"
                    title="Adicionar Nova Área"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[10px] lowercase font-semibold">área</span>
                  </button>
                </div>

                {notebookAreas.map(area => {
                  const areaNotes = studyNotes.filter(n => n.areaId === area.id);
                  const isAreaSelected = selectedAreaId === area.id;
                  const systems = notebookSystems.filter(s => s.areaId === area.id);

                  return (
                    <div
                      key={area.id}
                      onContextMenu={(e) => handleContextMenu(e, 'area', { area })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnSection(e, area.id)}
                      className="rounded-2xl transition-colors group"
                    >
                      {/* Area Row */}
                      <div
                        onClick={() => {
                          setSelectedAreaId(isAreaSelected ? 'all' : area.id);
                          setSelectedSystemId('all');
                          setSelectedSubjectId('all');
                          setSelectedTopicId('all');
                        }}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border group/item",
                          isAreaSelected
                            ? "border-transparent text-white shadow-xs"
                            : "border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-200"
                        )}
                        style={isAreaSelected ? { backgroundColor: area.color || '#3b82f6' } : {}}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: isAreaSelected ? '#ffffff' : area.color }}
                          />
                          <span className="truncate font-bold">{area.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                            isAreaSelected ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                          )}>
                            {areaNotes.length}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const otherAreas = notebookAreas.filter(a => a.id !== area.id);
                              setDestinationAreaId(otherAreas[0]?.id || '');
                              setAreaToDelete(area);
                              setDeleteConfirmInput('');
                            }}
                            className={cn(
                              "p-1 rounded-md opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-500/20",
                              isAreaSelected ? "text-white" : "text-gray-400 hover:text-red-500"
                            )}
                            title="Excluir Área com segurança"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Nested Systems / Subjects Hierarchy */}
                      {isAreaSelected && (
                        <div className="pl-3.5 pr-1 py-1 space-y-1.5 mt-1 border-l-2 border-gray-200 dark:border-gray-800 ml-3.5 animate-in fade-in duration-150">
                          {/* Add System Fast Button */}
                          <button
                            onClick={() => {
                              setIsAddingCategory({ type: 'system', areaId: area.id });
                              setNewCategoryName('');
                            }}
                            className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Adicionar Sistema</span>
                          </button>

                          {systems.map(sys => {
                            const sysNotes = areaNotes.filter(n => n.systemId === sys.id);
                            const isSysSelected = selectedSystemId === sys.id;
                            const subjects = notebookSubjects.filter(sub => sub.systemId === sys.id);

                            return (
                              <div
                                key={sys.id}
                                onContextMenu={(e) => handleContextMenu(e, 'system', { area, system: sys })}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnSection(e, area.id, sys.id)}
                                className="space-y-1"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSystemId(isSysSelected ? 'all' : sys.id);
                                    setSelectedSubjectId('all');
                                    setSelectedTopicId('all');
                                  }}
                                  className={cn(
                                    "w-full px-2 py-1 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer font-medium",
                                    isSysSelected
                                      ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  )}
                                >
                                  <span className="truncate flex items-center gap-1">
                                    <span>🩺</span>
                                    <span>{sys.name}</span>
                                  </span>
                                  <span className="text-[10px] text-gray-400">{sysNotes.length}</span>
                                </button>

                                {/* Nested Subjects under System */}
                                {isSysSelected && (
                                  <div className="pl-3 pr-1 py-1 space-y-1 border-l border-blue-200 dark:border-blue-900 ml-2.5">
                                    <button
                                      onClick={() => {
                                        setIsAddingCategory({ type: 'subject', areaId: area.id, systemId: sys.id });
                                        setNewCategoryName('');
                                      }}
                                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>+ Matéria</span>
                                    </button>

                                    {subjects.map(subj => {
                                      const isSubjSelected = selectedSubjectId === subj.id;
                                      const subjNotes = sysNotes.filter(n => n.subjectId === subj.id);

                                      return (
                                        <button
                                          key={subj.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSubjectId(isSubjSelected ? 'all' : subj.id);
                                          }}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={(e) => handleDropOnSection(e, area.id, sys.id, subj.id)}
                                          className={cn(
                                            "w-full px-2 py-0.5 rounded text-[11px] flex items-center justify-between transition-colors cursor-pointer",
                                            isSubjSelected
                                              ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold"
                                              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                          )}
                                        >
                                          <span className="truncate">📚 {subj.name}</span>
                                          <span className="text-[9px] text-gray-400">{subjNotes.length}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tags Section */}
              {allTags.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                  <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Tags de Estudo
                  </div>
                  <div className="flex flex-wrap gap-1 px-1">
                    <button
                      onClick={() => setSelectedTag('all')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                        selectedTag === 'all'
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      )}
                    >
                      Todas
                    </button>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                          selectedTag === tag
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        )}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions at bottom of sidebar */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setEditingArea(null);
                    setAreaNameInput('');
                    setAreaColorInput('#3b82f6');
                    setIsAreaModalOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nova Área</span>
                </button>

                <button
                  onClick={() => setPdfExportConfig({ isOpen: true, areaId: selectedAreaId !== 'all' ? selectedAreaId : undefined })}
                  className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT CANVAS */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full min-w-0 space-y-5">
        {/* Main Content Control Bar */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-3xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  {selectedAreaId === 'all' ? 'Caderno Unificado' : notebookAreas.find(a => a.id === selectedAreaId)?.name || 'Caderno de Estudos'}
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  {viewLayout === 'document' ? 'Modo Documento Notion' : viewLayout === 'grid' ? 'Modo Blocos' : 'Modo Lista'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {studyNotes.filter(filterNoteMatch).length} notas no fluxo • Arraste o ícone ⠿ para reordenar • Auto-save ativo
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            {/* Search Input */}
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar no documento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Expand / Collapse All */}
            {viewLayout === 'document' && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { handleExpandAllSections(true); handleExpandAllNotes(true); }}
                  className="px-2 py-1 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1 transition-all cursor-pointer"
                  title="Expandir todas as notas e seções"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Expandir Tudo</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleExpandAllSections(false); handleExpandAllNotes(false); }}
                  className="px-2 py-1 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1 transition-all cursor-pointer"
                  title="Recolher todas as notas e seções"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Recolher Tudo</span>
                </button>
              </div>
            )}

            {/* Layout Mode Selector */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewLayout('document')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer",
                  viewLayout === 'document'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                )}
                title="Visualização em Documento Contínuo Notion"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Documento</span>
              </button>
              <button
                onClick={() => setViewLayout('grid')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer",
                  viewLayout === 'grid'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                )}
                title="Visualização em Blocos / Cards"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Blocos</span>
              </button>
              <button
                onClick={() => setViewLayout('list')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer",
                  viewLayout === 'list'
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                )}
                title="Visualização em Lista Compacta"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>

            {/* Nova Nota Button */}
            <button
              onClick={() => handleCreateNoteInline(selectedAreaId !== 'all' ? selectedAreaId : (notebookAreas[0]?.id || 'area-clinica'))}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Nota</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW MODE 1: DOCUMENTO NOTION WITH DRAG AND DROP & HIERARCHY */}
        {/* ========================================================================= */}
        {viewLayout === 'document' && (
          <div className="space-y-6">
            {displayedAreas.map(area => {
              const areaKey = `area-${area.id}`;
              const isAreaCollapsed = collapsedSections[areaKey] === true;
              const areaNotes = studyNotes.filter(n => n.areaId === area.id && filterNoteMatch(n));
              const areaSystems = notebookSystems.filter(s => s.areaId === area.id);

              return (
                <section
                  key={area.id}
                  onContextMenu={(e) => handleContextMenu(e, 'area', { area })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnSection(e, area.id)}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xs transition-all"
                >
                  {/* Area Collapsible Header */}
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800/60"
                    onClick={() => toggleSection(areaKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-xs shrink-0"
                        style={{ backgroundColor: area.color || '#3b82f6' }}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                            {area.name}
                          </h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {areaNotes.length} notas
                          </span>
                          {areaSystems.length > 0 && (
                            <span className="text-[11px] font-semibold text-gray-400">
                              • {areaSystems.length} sistemas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateNoteInline(area.id);
                        }}
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Adicionar Nota nesta Área"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Adicionar Nota</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const otherAreas = notebookAreas.filter(a => a.id !== area.id);
                          setDestinationAreaId(otherAreas[0]?.id || '');
                          setAreaToDelete(area);
                          setDeleteConfirmInput('');
                        }}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 rounded-xl text-xs transition-colors cursor-pointer"
                        title="Excluir Área"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="p-1 rounded-lg text-gray-400">
                        {isAreaCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Area Body */}
                  {!isAreaCollapsed && (
                    <div className="p-4 sm:p-6 space-y-4">
                      {areaNotes.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                          <p className="text-xs text-gray-400">Nenhuma nota encontrada nesta área.</p>
                          <button
                            onClick={() => handleCreateNoteInline(area.id)}
                            className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Criar primeira nota</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {areaNotes.map((note) => {
                            const isCollapsed = collapsedNotes[note.id] === true;
                            const isEditing = editingNoteId === note.id;
                            const isDragging = draggedNoteId === note.id;
                            const isDragOverBefore = dragOverInfo?.noteId === note.id && dragOverInfo.position === 'before';
                            const isDragOverAfter = dragOverInfo?.noteId === note.id && dragOverInfo.position === 'after';

                            // Resolve Hierarchy labels
                            const noteSystem = notebookSystems.find(s => s.id === note.systemId);
                            const noteSubject = notebookSubjects.find(s => s.id === note.subjectId);
                            const noteTopic = notebookTopics.find(t => t.id === note.topicId);

                            // Note Highlight Color calculations (Much more visible background wash & border)
                            const noteHighlightPreset = COLOR_PRESETS.find(c => c.hex && c.hex.toLowerCase() === note.color?.toLowerCase());
                            const customColorStyle = note.color ? {
                              borderLeft: `6px solid ${note.color}`,
                              borderColor: `${note.color}40`,
                              backgroundColor: `${note.color}15` // High visibility background highlight tint!
                            } : {};

                            return (
                              <div key={note.id} className="relative">
                                {/* Visual Drop Indicator Bar (Before) */}
                                {isDragOverBefore && (
                                  <div className="h-1.5 bg-blue-500 rounded-full my-1.5 shadow-md shadow-blue-500/50 animate-pulse transition-all" />
                                )}

                                <article
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, note.id)}
                                  onDragOver={(e) => handleDragOverNote(e, note.id)}
                                  onDragLeave={handleDragLeaveNote}
                                  onDrop={(e) => handleDropOnNote(e, note)}
                                  onContextMenu={(e) => handleContextMenu(e, 'note', { note, area })}
                                  className={cn(
                                    "border rounded-2xl transition-all group/note relative",
                                    isDragging && "opacity-40 scale-[0.98] border-dashed border-blue-400",
                                    isEditing
                                      ? "ring-2 ring-blue-500/60 shadow-lg bg-blue-50/25"
                                      : !note.color && "bg-white dark:bg-gray-850 hover:border-gray-300 dark:hover:border-gray-700 shadow-2xs"
                                  )}
                                  style={customColorStyle}
                                >
                                  {/* Note Header Row with Grip Handle & Hierarchy Badges */}
                                  <div
                                    className={cn(
                                      "p-3 sm:p-3.5 flex items-center justify-between gap-3 border-b rounded-t-2xl",
                                      note.color
                                        ? "border-b-black/5 dark:border-b-white/5"
                                        : "border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/30"
                                    )}
                                    style={note.color ? { backgroundColor: `${note.color}25` } : {}}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {/* Drag Handle Grip */}
                                      <div
                                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        title="Arraste para reordenar esta nota"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </div>

                                      {/* Collapse Toggle Chevron */}
                                      <button
                                        type="button"
                                        onClick={() => toggleNoteCollapse(note.id)}
                                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
                                        title={isCollapsed ? "Expandir nota" : "Recolher nota"}
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </button>

                                      {/* Icon */}
                                      <span className="text-base select-none">{note.icon || '📝'}</span>

                                      {/* Note Title */}
                                      {editingTitleNoteId === note.id ? (
                                        <input
                                          type="text"
                                          value={inlineTitleValue}
                                          autoFocus
                                          onChange={(e) => setInlineTitleValue(e.target.value)}
                                          onBlur={() => {
                                            if (inlineTitleValue.trim()) {
                                              updateStudyNote(note.id, { title: inlineTitleValue.trim() });
                                            }
                                            setEditingTitleNoteId(null);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              if (inlineTitleValue.trim()) {
                                                updateStudyNote(note.id, { title: inlineTitleValue.trim() });
                                              }
                                              setEditingTitleNoteId(null);
                                            }
                                            if (e.key === 'Escape') setEditingTitleNoteId(null);
                                          }}
                                          className="font-bold text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded-lg px-2 py-0.5 focus:outline-none flex-1"
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div
                                            onClick={() => {
                                              setEditingTitleNoteId(note.id);
                                              setInlineTitleValue(note.title);
                                            }}
                                            className="font-extrabold text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer truncate"
                                            title="Clique para renomear título"
                                          >
                                            {note.title}
                                          </div>

                                          {/* Breadcrumb Hierarchy Tags */}
                                          {(noteSystem || noteSubject || noteTopic) && (
                                            <div className="hidden md:flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
                                              {noteSystem && (
                                                <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-semibold border border-blue-200 dark:border-blue-900">
                                                  🩺 {noteSystem.name}
                                                </span>
                                              )}
                                              {noteSubject && (
                                                <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded font-semibold border border-indigo-200 dark:border-indigo-900">
                                                  📚 {noteSubject.name}
                                                </span>
                                              )}
                                              {noteTopic && (
                                                <span className="bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold border border-purple-200 dark:border-purple-900">
                                                  🎯 {noteTopic.name}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {note.isPinned && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded flex items-center gap-0.5 shrink-0">
                                          <Pin className="w-3 h-3" />
                                        </span>
                                      )}
                                    </div>

                                    {/* Right Note Action Buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* Quick Highlight Color Button */}
                                      <div className="relative group/color">
                                        <button
                                          type="button"
                                          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                                          title="Alterar Cor de Destaque da Nota"
                                        >
                                          <Palette className="w-3.5 h-3.5" style={{ color: note.color || undefined }} />
                                        </button>
                                        <div className="absolute right-0 top-full mt-1 hidden group-hover/color:flex bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-30 gap-1">
                                          {COLOR_PRESETS.map(c => (
                                            <button
                                              key={c.name}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetNoteColor(note.id, c.hex);
                                              }}
                                              className="w-4 h-4 rounded-full border border-gray-300 hover:scale-125 transition-transform cursor-pointer"
                                              style={{ backgroundColor: c.hex || '#e5e7eb' }}
                                              title={c.name}
                                            />
                                          ))}
                                        </div>
                                      </div>

                                      {/* Move in Hierarchy Button */}
                                      <button
                                        type="button"
                                        onClick={() => setHierarchyModalNote(note)}
                                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                        title="Definir Sistema / Matéria / Tema na Hierarquia"
                                      >
                                        <FolderTree className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Toggle Clozes na Nota para Estudo Ativo */}
                                      {note.content && /{{c\d*::/.test(note.content) && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRevealedClozeNotes(prev => ({ ...prev, [note.id]: !prev[note.id] }));
                                          }}
                                          className={cn(
                                            "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                                            revealedClozeNotes[note.id]
                                              ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-xs"
                                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-600"
                                          )}
                                          title={revealedClozeNotes[note.id] ? "Ocultar Clozes na nota (Modo Teste)" : "Revelar todos os Clozes na nota"}
                                        >
                                          {revealedClozeNotes[note.id] ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-purple-600" />}
                                          <span className="hidden sm:inline">{revealedClozeNotes[note.id] ? 'Ocultar Clozes' : 'Ver Clozes'}</span>
                                        </button>
                                      )}

                                      {/* Edit Button */}
                                      <button
                                        type="button"
                                        onClick={() => setEditingNoteId(isEditing ? null : note.id)}
                                        className={cn(
                                          "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                                          isEditing
                                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                                            : "hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200"
                                        )}
                                        title="Editar nota inline"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{isEditing ? 'Concluir' : 'Editar'}</span>
                                      </button>

                                      {/* Context Menu Trigger */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleContextMenu(e, 'note', { note, area })}
                                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                                        title="Opções da nota (botão direito)"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Note Body */}
                                  {!isCollapsed && (
                                    <div className="p-4 sm:p-5">
                                      {isEditing ? (
                                        <InlineNoteRichEditor
                                          initialContent={note.content}
                                          onSave={(updatedHtml) => {
                                            updateStudyNote(note.id, { content: updatedHtml });
                                          }}
                                          onCancel={() => setEditingNoteId(null)}
                                        />
                                      ) : (
                                        <div
                                          onDoubleClick={() => setEditingNoteId(note.id)}
                                          onClick={handleNoteContentClick}
                                          className="prose dark:prose-invert max-w-none text-sm text-gray-900 dark:text-gray-100 leading-relaxed cursor-text min-h-[32px]"
                                          dangerouslySetInnerHTML={{ __html: renderNoteContentWithClozes(note.content, Boolean(revealedClozeNotes[note.id])) || '<p class="text-gray-400 italic">Nota vazia. Clique duas vezes para escrever...</p>' }}
                                          title="Dê duplo clique para editar ou clique nas palavras ocultas para revelar"
                                        />
                                      )}

                                      {/* Embedded Flashcards in Note */}
                                      {note.embeddedFlashcardIds && note.embeddedFlashcardIds.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Flashcards Embutidos ({note.embeddedFlashcardIds.length})</span>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {note.embeddedFlashcardIds.map(cId => {
                                              const card = cards.find(c => c.id === cId);
                                              if (!card) return null;
                                              return (
                                                <EmbeddedFlashcardBlock
                                                  key={card.id}
                                                  card={card}
                                                  onNavigateToStudy={() => onNavigate({ type: 'study', cardIds: [card.id] })}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Associated Questions and Cards Footer Badges */}
                                      {((note.associatedQuestionIds && note.associatedQuestionIds.length > 0) || (note.associatedCardIds && note.associatedCardIds.length > 0)) && (
                                        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-2 flex-wrap text-xs">
                                          {note.associatedQuestionIds && note.associatedQuestionIds.length > 0 && (
                                            <button
                                              onClick={() => setAssociationsModal({
                                                title: `Questões de ${note.title}`,
                                                questionIds: note.associatedQuestionIds || [],
                                                cardIds: []
                                              })}
                                              className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                                            >
                                              <BookOpen className="w-3.5 h-3.5" />
                                              <span>{note.associatedQuestionIds.length} Questões Q-Bank</span>
                                            </button>
                                          )}

                                          {note.associatedCardIds && note.associatedCardIds.length > 0 && (
                                            <button
                                              onClick={() => setAssociationsModal({
                                                title: `Flashcards de ${note.title}`,
                                                questionIds: [],
                                                cardIds: note.associatedCardIds || []
                                              })}
                                              className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/60 flex items-center gap-1 hover:bg-purple-100 transition-colors cursor-pointer"
                                            >
                                              <Layers className="w-3.5 h-3.5" />
                                              <span>{note.associatedCardIds.length} Flashcards</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </article>

                                {/* Visual Drop Indicator Bar (After) */}
                                {isDragOverAfter && (
                                  <div className="h-1.5 bg-blue-500 rounded-full my-1.5 shadow-md shadow-blue-500/50 animate-pulse transition-all" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* VIEW MODE 2: BLOCOS (CARDS GRID) */}
        {viewLayout === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {studyNotes.filter(filterNoteMatch).map(note => {
              const area = notebookAreas.find(a => a.id === note.areaId);
              const customStyle = note.color ? {
                borderLeft: `5px solid ${note.color}`,
                backgroundColor: `${note.color}15`
              } : {};

              return (
                <div
                  key={note.id}
                  onContextMenu={(e) => handleContextMenu(e, 'note', { note, area })}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                  style={customStyle}
                  onClick={() => {
                    setViewLayout('document');
                    setCollapsedNotes(prev => ({ ...prev, [note.id]: false }));
                    setEditingNoteId(note.id);
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {area && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${area.color}20`, color: area.color }}
                        >
                          {area.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{format(note.updatedAt || Date.now(), 'dd/MM/yyyy')}</span>
                    </div>

                    <h3 className="font-black text-base text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <span>{note.icon || '📝'}</span>
                      <span className="truncate">{note.title}</span>
                    </h3>

                    <div
                      className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) || '<span class="text-gray-400 italic">Sem conteúdo ainda.</span>' }}
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Clique para abrir e editar</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW MODE 3: LISTA COMPACTA */}
        {viewLayout === 'list' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50/50 dark:bg-gray-800/30">
              <span>Título da Nota</span>
              <span>Área / Data</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {studyNotes.filter(filterNoteMatch).map(note => {
                const area = notebookAreas.find(a => a.id === note.areaId);

                return (
                  <div
                    key={note.id}
                    onContextMenu={(e) => handleContextMenu(e, 'note', { note, area })}
                    onClick={() => {
                      setViewLayout('document');
                      setCollapsedNotes(prev => ({ ...prev, [note.id]: false }));
                      setEditingNoteId(note.id);
                    }}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors text-xs"
                    style={note.color ? { borderLeft: `4px solid ${note.color}`, backgroundColor: `${note.color}10` } : {}}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span>{note.icon || '📝'}</span>
                      <span className="font-bold text-gray-900 dark:text-white truncate">{note.title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {area && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${area.color}20`, color: area.color }}
                        >
                          {area.name}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">{format(note.updatedAt || Date.now(), 'dd/MM')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* RIGHT-CLICK CONTEXT MENU */}
      {/* ========================================================================= */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-1.5 min-w-[240px] text-xs font-semibold text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Note Specific Context Actions */}
          {contextMenu.note && (
            <>
              <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700/60 pb-1 mb-1 truncate">
                Nota: {contextMenu.note.title}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) {
                    navigator.clipboard.writeText(contextMenu.note.content.replace(/<[^>]*>?/gm, ''));
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-blue-500" />
                <span>Copiar Conteúdo da Nota</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) handleDuplicateNote(contextMenu.note);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Duplicar Nota</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) setHierarchyModalNote(contextMenu.note);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer text-indigo-600 dark:text-indigo-400"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Mover na Hierarquia...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) {
                    toggleNoteCollapse(contextMenu.note.id);
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
              >
                {collapsedNotes[contextMenu.note.id] ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Expandir Esta Nota</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                    <span>Recolher Esta Nota</span>
                  </>
                )}
              </button>

              {/* Note Highlight Colors Palette */}
              <div className="px-2.5 py-1.5 border-t border-gray-100 dark:border-gray-700/60 my-1">
                <span className="text-[10px] text-gray-400 font-bold block mb-1.5">🎨 Cor de Destaque da Nota:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        if (contextMenu.note) handleSetNoteColor(contextMenu.note.id, c.hex);
                        setContextMenu(prev => ({ ...prev, visible: false }));
                      }}
                      className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer shadow-2xs"
                      style={{ backgroundColor: c.hex || '#e5e7eb' }}
                      title={c.name}
                    >
                      {contextMenu.note.color === c.hex && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) {
                    setPdfExportConfig({ isOpen: true, noteId: contextMenu.note.id });
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors text-purple-600 dark:text-purple-400 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Exportar Nota para PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note) {
                    updateStudyNote(contextMenu.note.id, { isPinned: !contextMenu.note.isPinned });
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                <span>{contextMenu.note.isPinned ? 'Desafixar Nota' : 'Fixar Nota no Topo'}</span>
              </button>

              <div className="h-px bg-gray-100 dark:bg-gray-700/60 my-1" />

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.note && confirm(`Excluir a nota "${contextMenu.note.title}"?`)) {
                    deleteStudyNote(contextMenu.note.id);
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Nota</span>
              </button>
            </>
          )}

          {/* Area Specific Context Actions */}
          {contextMenu.area && !contextMenu.note && (
            <>
              <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700/60 pb-1 mb-1 truncate">
                Área: {contextMenu.area.name}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.area) handleCreateNoteInline(contextMenu.area.id);
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors text-blue-600 dark:text-blue-400 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Nota nesta Área</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.area) {
                    setIsAddingCategory({ type: 'system', areaId: contextMenu.area.id });
                    setNewCategoryName('');
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                <span>Adicionar Sistema...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.area) {
                    setPdfExportConfig({ isOpen: true, areaId: contextMenu.area.id });
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors text-purple-600 dark:text-purple-400 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Exportar Área para PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (contextMenu.area) {
                    const otherAreas = notebookAreas.filter(a => a.id !== contextMenu.area!.id);
                    setDestinationAreaId(otherAreas[0]?.id || '');
                    setAreaToDelete(contextMenu.area);
                    setDeleteConfirmInput('');
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Área...</span>
              </button>
            </>
          )}

          {/* Global Expand/Collapse Options */}
          <div className="border-t border-gray-100 dark:border-gray-700/60 pt-1 mt-1">
            <button
              type="button"
              onClick={() => {
                handleExpandAllNotes(true);
                setContextMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expandir Todas as Notas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleExpandAllNotes(false);
                setContextMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Recolher Todas as Notas</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      {/* Hierarchy Assignment Modal (Mover nota entre Área, Sistema, Matéria, Tema) */}
      {hierarchyModalNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Hierarquia da Nota
                </h3>
              </div>
              <button onClick={() => setHierarchyModalNote(null)} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Organize a nota <b>"{hierarchyModalNote.title}"</b> na árvore de estudos:
            </p>

            <div className="space-y-3">
              {/* Área Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  1. Área (Obrigatória):
                </label>
                <select
                  value={hierarchyModalNote.areaId}
                  onChange={(e) => {
                    const newAreaId = e.target.value;
                    updateStudyNote(hierarchyModalNote.id, {
                      areaId: newAreaId,
                      systemId: null,
                      subjectId: null,
                      topicId: null
                    });
                    setHierarchyModalNote(prev => prev ? ({ ...prev, areaId: newAreaId, systemId: null, subjectId: null, topicId: null }) : null);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                >
                  {notebookAreas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Sistema Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  2. Sistema (Opcional):
                </label>
                <select
                  value={hierarchyModalNote.systemId || ''}
                  onChange={(e) => {
                    const newSysId = e.target.value || null;
                    updateStudyNote(hierarchyModalNote.id, {
                      systemId: newSysId,
                      subjectId: null,
                      topicId: null
                    });
                    setHierarchyModalNote(prev => prev ? ({ ...prev, systemId: newSysId, subjectId: null, topicId: null }) : null);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="">Nenhum Sistema vinculado</option>
                  {notebookSystems.filter(s => s.areaId === hierarchyModalNote.areaId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Matéria Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  3. Matéria / Disciplina (Opcional):
                </label>
                <select
                  value={hierarchyModalNote.subjectId || ''}
                  onChange={(e) => {
                    const newSubjId = e.target.value || null;
                    updateStudyNote(hierarchyModalNote.id, {
                      subjectId: newSubjId,
                      topicId: null
                    });
                    setHierarchyModalNote(prev => prev ? ({ ...prev, subjectId: newSubjId, topicId: null }) : null);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="">Nenhuma Matéria vinculada</option>
                  {notebookSubjects.filter(sub => sub.areaId === hierarchyModalNote.areaId && (!hierarchyModalNote.systemId || sub.systemId === hierarchyModalNote.systemId)).map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              {/* Tema Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  4. Tema / Tópico Específico (Opcional):
                </label>
                <select
                  value={hierarchyModalNote.topicId || ''}
                  onChange={(e) => {
                    const newTopicId = e.target.value || null;
                    updateStudyNote(hierarchyModalNote.id, { topicId: newTopicId });
                    setHierarchyModalNote(prev => prev ? ({ ...prev, topicId: newTopicId }) : null);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="">Nenhum Tema vinculado</option>
                  {notebookTopics.filter(t => t.areaId === hierarchyModalNote.areaId).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setHierarchyModalNote(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Fast Creation Modal (Sistema / Matéria / Tema) */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Adicionar {isAddingCategory.type === 'system' ? 'Novo Sistema' : isAddingCategory.type === 'subject' ? 'Nova Matéria' : 'Novo Tema'}
              </h3>
              <button onClick={() => setIsAddingCategory(null)} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubcategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nome do {isAddingCategory.type === 'system' ? 'Sistema' : isAddingCategory.type === 'subject' ? 'da Matéria' : 'do Tema'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={isAddingCategory.type === 'system' ? 'Ex: Cardiovascular, Respiratório, Gastrointestinal...' : 'Ex: Farmacologia, Fisiologia...'}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Area Create/Edit Modal */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                {editingArea ? 'Editar Área' : 'Nova Área de Estudo'}
              </h3>
              <button onClick={() => setIsAreaModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nome da Área</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pediatria, Clínica Médica, Cirurgia..."
                  value={areaNameInput}
                  onChange={(e) => setAreaNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Cor de Identificação</label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.filter(c => c.hex).map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setAreaColorInput(c.hex)}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
                        areaColorInput === c.hex ? "border-black dark:border-white scale-105 shadow-sm" : "border-gray-200 dark:border-gray-700 opacity-80"
                      )}
                      style={{ backgroundColor: `${c.hex}20`, color: c.hex }}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {editingArea && (
                  <button
                    type="button"
                    onClick={() => {
                      const otherAreas = notebookAreas.filter(a => a.id !== editingArea.id);
                      setDestinationAreaId(otherAreas[0]?.id || '');
                      setAreaToDelete(editingArea);
                      setIsAreaModalOpen(false);
                      setDeleteConfirmInput('');
                    }}
                    className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Área</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAreaModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm shadow-blue-500/25 cursor-pointer"
                  >
                    {editingArea ? 'Salvar Alterações' : 'Criar Área'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Area Deletion Confirmation Modal */}
      {areaToDelete && (() => {
        const notesInArea = studyNotes.filter(n => n.areaId === areaToDelete.id);
        const systemsInArea = notebookSystems.filter(s => s.areaId === areaToDelete.id);
        const otherAreas = notebookAreas.filter(a => a.id !== areaToDelete.id);
        const hasNotes = notesInArea.length > 0;
        const canSubmit = !hasNotes || deleteAreaMode === 'move' || deleteConfirmInput.trim().toLowerCase() === areaToDelete.name.toLowerCase();

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/60 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                    Excluir Área: {areaToDelete.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Prevenção de exclusão acidental. Esta área possui <b className="text-gray-900 dark:text-white">{notesInArea.length} notas</b> e <b className="text-gray-900 dark:text-white">{systemsInArea.length} sistemas</b> cadastrados.
                  </p>
                </div>
              </div>

              {hasNotes && (
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                    O que deseja fazer com as {notesInArea.length} notas existentes?
                  </span>

                  {otherAreas.length > 0 && (
                    <label className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      deleteAreaMode === 'move'
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}>
                      <input
                        type="radio"
                        name="delete_mode"
                        checked={deleteAreaMode === 'move'}
                        onChange={() => setDeleteAreaMode('move')}
                        className="mt-1 text-blue-600"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-bold text-gray-900 dark:text-white block">
                          Mover notas para outra Área (Recomendado)
                        </span>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          Todas as {notesInArea.length} notas serão preservadas e transferidas.
                        </p>

                        {deleteAreaMode === 'move' && (
                          <div className="mt-2.5">
                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">
                              Área de Destino:
                            </label>
                            <select
                              value={destinationAreaId}
                              onChange={(e) => setDestinationAreaId(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200"
                            >
                              {otherAreas.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </label>
                  )}

                  <label className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                    deleteAreaMode === 'delete_all'
                      ? "bg-red-50/70 dark:bg-red-950/40 border-red-300 dark:border-red-700"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}>
                    <input
                      type="radio"
                      name="delete_mode"
                      checked={deleteAreaMode === 'delete_all'}
                      onChange={() => setDeleteAreaMode('delete_all')}
                      className="mt-1 text-red-600"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-red-700 dark:text-red-400 block">
                        Excluir permanentemente a área e todas as suas notas
                      </span>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        Esta ação removerá {notesInArea.length} notas do seu caderno.
                      </p>

                      {deleteAreaMode === 'delete_all' && (
                        <div className="mt-2.5">
                          <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">
                            Digite <span className="font-mono text-red-600 font-bold">"{areaToDelete.name}"</span> para confirmar:
                          </label>
                          <input
                            type="text"
                            placeholder={areaToDelete.name}
                            value={deleteConfirmInput}
                            onChange={(e) => setDeleteConfirmInput(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded-xl text-xs text-gray-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setAreaToDelete(null); setDeleteConfirmInput(''); }}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleConfirmDeleteArea}
                  className={cn(
                    "px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer",
                    canSubmit
                      ? "bg-red-600 hover:bg-red-500 shadow-red-500/25"
                      : "bg-gray-400 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PDF Export Tool Modal */}
      <PdfExportModal
        isOpen={pdfExportConfig.isOpen}
        onClose={() => setPdfExportConfig({ isOpen: false })}
        defaultAreaId={pdfExportConfig.areaId}
        defaultNoteId={pdfExportConfig.noteId}
      />

      {/* Associated Questions and Flashcards Preview Modal */}
      <NoteAssociationsPreviewModal
        isOpen={Boolean(associationsModal)}
        onClose={() => setAssociationsModal(null)}
        title={associationsModal?.title || 'Itens Associados'}
        questionIds={associationsModal?.questionIds || []}
        cardIds={associationsModal?.cardIds || []}
        onNavigateToStudy={(cardIds) => {
          setAssociationsModal(null);
          onNavigate({ type: 'study', cardIds });
        }}
      />
    </div>
  );
};
