import JSZip from 'jszip';
import localforage from 'localforage';
import { saveAs } from 'file-saver';
import { useStore, cardblocksDataStore, StoreState } from '../cardblocks/store/useStore';
import { mediaStorage } from '../cardblocks/lib/mediaStorage';
import { flashcardStore } from './flashcardStore';

export interface FullBackupManifest {
  version: number;
  appName: string;
  createdAt: string;
  counts: {
    questions: number;
    questionBanks: number;
    decks: number;
    cards: number;
    notebooks: number;
    notes: number;
    studyNotebooks: number;
    studyNotes: number;
    studyDeskSessions: number;
    studyLogs: number;
    resources: number;
    scores: number;
    mediaFiles: number;
    totalMediaBytes: number;
  };
}

export interface BackupInspection {
  isValid: boolean;
  manifest?: FullBackupManifest;
  error?: string;
  filename: string;
  fileSizeBytes: number;
  mediaCount: number;
  mediaTotalBytes: number;
  zipInstance?: JSZip;
  cardblocksState?: any;
  trackerAndScores?: any;
  localStorageAll?: Record<string, string>;
  legacyFlashcards?: any;
}

const mediaStore = localforage.createInstance({
  name: 'cardblocks_media'
});

/**
 * Coleta todos os dados e mídias do aplicativo e empacota em um arquivo .usmlebak (ZIP compactado)
 */
export async function generateFullBackup(
  onProgress?: (progress: number, message: string) => void
): Promise<{ blob: Blob; filename: string; manifest: FullBackupManifest }> {
  const zip = new JSZip();

  onProgress?.(5, 'Coletando dados do banco de questões, flashcards e cadernos...');

  // 1. Estado principal do CardBlocks / Questions / Flashcards / Notebooks
  const cardblocksState = useStore.getState();
  const cardblocksJson = JSON.stringify({
    decks: cardblocksState.decks || [],
    cards: cardblocksState.cards || [],
    reviewHistory: cardblocksState.reviewHistory || [],
    reviewLog: cardblocksState.reviewLog || [],
    questions: cardblocksState.questions || [],
    questionBanks: cardblocksState.questionBanks || [],
    notebooks: cardblocksState.notebooks || [],
    notebookHistory: cardblocksState.notebookHistory || [],
    notes: cardblocksState.notes || [],
    studyNotebooks: cardblocksState.studyNotebooks || [],
    notebookAreas: cardblocksState.notebookAreas || [],
    notebookSystems: cardblocksState.notebookSystems || [],
    notebookSubjects: cardblocksState.notebookSubjects || [],
    notebookTopics: cardblocksState.notebookTopics || [],
    studyNotes: cardblocksState.studyNotes || [],
    studyDeskSessions: cardblocksState.studyDeskSessions || [],
    settings: cardblocksState.settings,
    exportedAt: new Date().toISOString()
  }, null, 2);

  zip.file('database/cardblocks_state.json', cardblocksJson);

  onProgress?.(15, 'Coletando planejamentos, registros de estudo e métricas...');

  // 2. Snapshot de LocalStorage completo (Study Tracker, Scores, Temas, Preferências)
  const localStorageAll: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        localStorageAll[key] = val;
      }
    }
  }

  // Dados específicos do Study Tracker e Scores estruturados
  const trackerAndScores = {
    mode: localStorage.getItem('usmle_mode_v4') || 'by_date',
    examDateStr: localStorage.getItem('usmle_examDate_v4') || '',
    bufferDays: Number(localStorage.getItem('usmle_bufferDays_v4')) || 14,
    daysOff: JSON.parse(localStorage.getItem('usmle_daysOff_v4') || '[0]'),
    specificDaysOff: JSON.parse(localStorage.getItem('usmle_specificDaysOff_v4') || '[]'),
    customDateMarks: JSON.parse(localStorage.getItem('usmle_customDateMarks_v4') || '{}'),
    defaultQuestionsByDayOfWeek: JSON.parse(localStorage.getItem('usmle_defaultQuestionsByDayOfWeek_v4') || '{}'),
    resources: JSON.parse(localStorage.getItem('usmle_resources_v4') || '[]'),
    studyLogs: JSON.parse(localStorage.getItem('usmle_study_logs_v4') || '[]'),
    scores: JSON.parse(localStorage.getItem('usmle_scores_v1') || '[]'),
    themeId: localStorage.getItem('app-theme-id') || 'dark-default',
    exportedAt: new Date().toISOString()
  };

  zip.file('database/tracker_and_scores.json', JSON.stringify(trackerAndScores, null, 2));
  zip.file('database/localstorage_all.json', JSON.stringify(localStorageAll, null, 2));

  // 3. Simulados e flashcards legados se houver
  onProgress?.(25, 'Coletando simulados e históricos legados...');
  const legacySimulados: Record<string, any> = {};
  try {
    const simList = await flashcardStore.getSimuladosList();
    for (const simName of simList) {
      const simData = await flashcardStore.getSimulado(simName);
      legacySimulados[simName] = simData;
    }
  } catch (e) {
    console.warn('Erro ao ler simulados legados:', e);
  }
  zip.file('database/legacy_flashcards.json', JSON.stringify(legacySimulados, null, 2));

  // 4. Coletar todas as mídias salvas no IndexedDB (Imagens, Áudios, Diagramas, Anexos)
  onProgress?.(35, 'Coletando arquivos de imagem, áudio e mídias salvas...');
  const mediaFolder = zip.folder('media');
  let mediaCount = 0;
  let totalMediaBytes = 0;

  try {
    const mediaKeys = await mediaStore.keys();
    const totalKeys = mediaKeys.length;

    for (let i = 0; i < totalKeys; i++) {
      const key = mediaKeys[i];
      const blob = await mediaStore.getItem<Blob>(key);
      if (blob && mediaFolder) {
        mediaFolder.file(key, blob);
        mediaCount++;
        totalMediaBytes += blob.size;
      }
      if (totalKeys > 0 && i % 10 === 0) {
        const pct = 35 + Math.round((i / totalKeys) * 35);
        onProgress?.(pct, `Empacotando mídias (${i + 1}/${totalKeys})...`);
      }
    }
  } catch (e) {
    console.warn('Erro ao empacotar mídias:', e);
  }

  // 5. Criar Manifesto de Backup
  const manifest: FullBackupManifest = {
    version: 1,
    appName: 'USMLE Study Tools Full Backup',
    createdAt: new Date().toISOString(),
    counts: {
      questions: cardblocksState.questions?.length || 0,
      questionBanks: cardblocksState.questionBanks?.length || 0,
      decks: cardblocksState.decks?.length || 0,
      cards: cardblocksState.cards?.length || 0,
      notebooks: cardblocksState.notebooks?.length || 0,
      notes: cardblocksState.notes?.length || 0,
      studyNotebooks: cardblocksState.studyNotebooks?.length || 0,
      studyNotes: cardblocksState.studyNotes?.length || 0,
      studyDeskSessions: cardblocksState.studyDeskSessions?.length || 0,
      studyLogs: trackerAndScores.studyLogs?.length || 0,
      resources: trackerAndScores.resources?.length || 0,
      scores: trackerAndScores.scores?.length || 0,
      mediaFiles: mediaCount,
      totalMediaBytes: totalMediaBytes
    }
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  onProgress?.(75, 'Gerando arquivo de backup compactado (.usmlebak)...');

  // 6. Gerar o ZIP Blob final
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      const pct = 75 + Math.round((metadata.percent / 100) * 24);
      onProgress?.(pct, `Compactando dados e mídias (${Math.round(metadata.percent)}%)...`);
    }
  );

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `usmle_full_backup_${dateStr}_${timeStr}.usmlebak`;

  onProgress?.(100, 'Backup gerado com sucesso!');

  return { blob, filename, manifest };
}

/**
 * Executa o download direto do backup gerado
 */
export async function downloadFullBackup(
  onProgress?: (progress: number, message: string) => void
): Promise<{ filename: string; manifest: FullBackupManifest }> {
  const { blob, filename, manifest } = await generateFullBackup(onProgress);
  saveAs(blob, filename);
  return { filename, manifest };
}

/**
 * Inspeciona um arquivo de backup antes de restaurar, retornando metadados e estatísticas
 */
export async function inspectBackupFile(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<BackupInspection> {
  try {
    onProgress?.(20, 'Lendo estrutura do arquivo...');
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    onProgress?.(50, 'Validando manifesto e bancos de dados...');

    // 1. Tentar ler o manifest.json
    let manifest: FullBackupManifest | undefined;
    const manifestFile = loadedZip.file('manifest.json');
    if (manifestFile) {
      const manifestText = await manifestFile.async('text');
      manifest = JSON.parse(manifestText);
    }

    // 2. Tentar ler cardblocks_state.json
    let cardblocksState: any;
    const cardblocksFile = loadedZip.file('database/cardblocks_state.json');
    if (cardblocksFile) {
      const text = await cardblocksFile.async('text');
      cardblocksState = JSON.parse(text);
    }

    // 3. Tentar ler tracker_and_scores.json
    let trackerAndScores: any;
    const trackerFile = loadedZip.file('database/tracker_and_scores.json');
    if (trackerFile) {
      const text = await trackerFile.async('text');
      trackerAndScores = JSON.parse(text);
    }

    // 4. Tentar ler localstorage_all.json
    let localStorageAll: Record<string, string> | undefined;
    const lsFile = loadedZip.file('database/localstorage_all.json');
    if (lsFile) {
      const text = await lsFile.async('text');
      localStorageAll = JSON.parse(text);
    }

    // 5. Tentar ler legacy_flashcards.json
    let legacyFlashcards: any;
    const legacyFile = loadedZip.file('database/legacy_flashcards.json');
    if (legacyFile) {
      const text = await legacyFile.async('text');
      legacyFlashcards = JSON.parse(text);
    }

    // 6. Contar mídias
    let mediaCount = 0;
    let mediaTotalBytes = 0;
    const mediaFiles = Object.keys(loadedZip.files).filter(path => path.startsWith('media/') && !loadedZip.files[path].dir);
    mediaCount = mediaFiles.length;

    // Se o manifesto não existia, reconstruir com base nos arquivos reais
    if (!manifest) {
      manifest = {
        version: 1,
        appName: 'Backup Importado',
        createdAt: cardblocksState?.exportedAt || trackerAndScores?.exportedAt || new Date().toISOString(),
        counts: {
          questions: cardblocksState?.questions?.length || 0,
          questionBanks: cardblocksState?.questionBanks?.length || 0,
          decks: cardblocksState?.decks?.length || 0,
          cards: cardblocksState?.cards?.length || 0,
          notebooks: cardblocksState?.notebooks?.length || 0,
          notes: cardblocksState?.notes?.length || 0,
          studyNotebooks: cardblocksState?.studyNotebooks?.length || 0,
          studyNotes: cardblocksState?.studyNotes?.length || 0,
          studyDeskSessions: cardblocksState?.studyDeskSessions?.length || 0,
          studyLogs: trackerAndScores?.studyLogs?.length || 0,
          resources: trackerAndScores?.resources?.length || 0,
          scores: trackerAndScores?.scores?.length || 0,
          mediaFiles: mediaCount,
          totalMediaBytes: 0
        }
      };
    }

    onProgress?.(100, 'Arquivo validado com sucesso!');

    return {
      isValid: true,
      manifest,
      filename: file.name,
      fileSizeBytes: file.size,
      mediaCount,
      mediaTotalBytes,
      zipInstance: loadedZip,
      cardblocksState,
      trackerAndScores,
      localStorageAll,
      legacyFlashcards
    };
  } catch (err: any) {
    console.error('Erro ao inspecionar arquivo de backup:', err);
    return {
      isValid: false,
      error: err.message || 'Arquivo corrompido ou formato de backup inválido.',
      filename: file.name,
      fileSizeBytes: file.size,
      mediaCount: 0,
      mediaTotalBytes: 0
    };
  }
}

/**
 * Restaura todos os dados e mídias a partir do arquivo inspecionado
 */
export async function restoreFullBackup(
  inspection: BackupInspection,
  options: {
    mode: 'replace' | 'merge';
    onProgress?: (progress: number, message: string) => void;
  }
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const { zipInstance, cardblocksState, trackerAndScores, localStorageAll, legacyFlashcards } = inspection;

    if (!zipInstance) {
      throw new Error('Arquivo de backup não carregado na memória.');
    }

    const isReplace = options.mode === 'replace';

    options.onProgress?.(10, 'Restaurando arquivos de mídia (imagens e áudios)...');

    // 1. Restaurar Mídias no IndexedDB (cardblocks_media)
    if (isReplace) {
      await mediaStorage.clearMediaStorage();
    }

    const mediaFiles = Object.keys(zipInstance.files).filter(path => path.startsWith('media/') && !zipInstance.files[path].dir);
    const totalMedia = mediaFiles.length;

    for (let i = 0; i < totalMedia; i++) {
      const path = mediaFiles[i];
      const filename = path.replace(/^media\//, '');
      if (filename) {
        const fileObj = zipInstance.file(path);
        if (fileObj) {
          const blob = await fileObj.async('blob');
          await mediaStorage.saveMedia(filename, blob);
        }
      }
      if (totalMedia > 0 && i % 10 === 0) {
        const pct = 10 + Math.round((i / totalMedia) * 30);
        options.onProgress?.(pct, `Restaurando mídias (${i + 1}/${totalMedia})...`);
      }
    }

    options.onProgress?.(45, 'Restaurando dados do CardBlocks, Questões e Flashcards...');

    // 2. Restaurar Estado do CardBlocks (useStore / cardblocksDataStore)
    if (cardblocksState) {
      const currentState = useStore.getState();

      if (isReplace) {
        useStore.setState({
          decks: cardblocksState.decks || [],
          cards: cardblocksState.cards || [],
          reviewHistory: cardblocksState.reviewHistory || [],
          reviewLog: cardblocksState.reviewLog || [],
          questions: cardblocksState.questions || [],
          questionBanks: cardblocksState.questionBanks || [],
          notebooks: cardblocksState.notebooks || [],
          notebookHistory: cardblocksState.notebookHistory || [],
          notes: cardblocksState.notes || [],
          studyNotebooks: cardblocksState.studyNotebooks || [],
          notebookAreas: cardblocksState.notebookAreas || [],
          notebookSystems: cardblocksState.notebookSystems || [],
          notebookSubjects: cardblocksState.notebookSubjects || [],
          notebookTopics: cardblocksState.notebookTopics || [],
          studyNotes: cardblocksState.studyNotes || [],
          studyDeskSessions: cardblocksState.studyDeskSessions || [],
          settings: cardblocksState.settings || currentState.settings
        });

        await cardblocksDataStore.setItem('cardblocks-storage', {
          state: {
            decks: cardblocksState.decks || [],
            cards: cardblocksState.cards || [],
            reviewHistory: cardblocksState.reviewHistory || [],
            reviewLog: cardblocksState.reviewLog || [],
            questions: cardblocksState.questions || [],
            questionBanks: cardblocksState.questionBanks || [],
            notebooks: cardblocksState.notebooks || [],
            notebookHistory: cardblocksState.notebookHistory || [],
            notes: cardblocksState.notes || [],
            studyNotebooks: cardblocksState.studyNotebooks || [],
            notebookAreas: cardblocksState.notebookAreas || [],
            notebookSystems: cardblocksState.notebookSystems || [],
            notebookSubjects: cardblocksState.notebookSubjects || [],
            notebookTopics: cardblocksState.notebookTopics || [],
            studyNotes: cardblocksState.studyNotes || [],
            studyDeskSessions: cardblocksState.studyDeskSessions || [],
            settings: cardblocksState.settings || currentState.settings
          },
          version: 0
        });
      } else {
        // Merge Mode: Unir decks, cards, questions, notes evitando duplicatas de ID
        const mergeById = <T extends { id: string | number }>(current: T[] = [], incoming: T[] = []): T[] => {
          const map = new Map<string | number, T>();
          current.forEach(item => map.set(item.id, item));
          incoming.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        };

        const mergedDecks = mergeById(currentState.decks, cardblocksState.decks);
        const mergedCards = mergeById(currentState.cards, cardblocksState.cards);
        const mergedQuestions = mergeById(currentState.questions, cardblocksState.questions);
        const mergedBanks = mergeById(currentState.questionBanks, cardblocksState.questionBanks);
        const mergedNotebooks = mergeById(currentState.notebooks, cardblocksState.notebooks);
        const mergedNotes = mergeById(currentState.notes, cardblocksState.notes);
        const mergedStudyNotebooks = mergeById(currentState.studyNotebooks, cardblocksState.studyNotebooks);
        const mergedNotebookAreas = mergeById(currentState.notebookAreas, cardblocksState.notebookAreas);
        const mergedNotebookSystems = mergeById(currentState.notebookSystems, cardblocksState.notebookSystems);
        const mergedNotebookSubjects = mergeById(currentState.notebookSubjects, cardblocksState.notebookSubjects);
        const mergedNotebookTopics = mergeById(currentState.notebookTopics, cardblocksState.notebookTopics);
        const mergedStudyNotes = mergeById(currentState.studyNotes, cardblocksState.studyNotes);
        const mergedStudyDeskSessions = mergeById(currentState.studyDeskSessions, cardblocksState.studyDeskSessions);

        useStore.setState({
          decks: mergedDecks,
          cards: mergedCards,
          questions: mergedQuestions,
          questionBanks: mergedBanks,
          notebooks: mergedNotebooks,
          notes: mergedNotes,
          studyNotebooks: mergedStudyNotebooks,
          notebookAreas: mergedNotebookAreas,
          notebookSystems: mergedNotebookSystems,
          notebookSubjects: mergedNotebookSubjects,
          notebookTopics: mergedNotebookTopics,
          studyNotes: mergedStudyNotes,
          studyDeskSessions: mergedStudyDeskSessions,
          reviewHistory: [...(currentState.reviewHistory || []), ...(cardblocksState.reviewHistory || [])],
          reviewLog: [...(currentState.reviewLog || []), ...(cardblocksState.reviewLog || [])],
          notebookHistory: [...(currentState.notebookHistory || []), ...(cardblocksState.notebookHistory || [])]
        });

        await cardblocksDataStore.setItem('cardblocks-storage', {
          state: useStore.getState(),
          version: 0
        });
      }
    }

    options.onProgress?.(70, 'Restaurando Study Tracker, Cronogramas e Históricos...');

    // 3. Restaurar LocalStorage (Study Tracker, Logs, Resources, Scores)
    if (localStorageAll && isReplace) {
      Object.entries(localStorageAll).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, v);
        } catch (e) {}
      });
    } else if (trackerAndScores) {
      if (trackerAndScores.mode) localStorage.setItem('usmle_mode_v4', trackerAndScores.mode);
      if (trackerAndScores.examDateStr) localStorage.setItem('usmle_examDate_v4', trackerAndScores.examDateStr);
      if (trackerAndScores.bufferDays !== undefined) localStorage.setItem('usmle_bufferDays_v4', String(trackerAndScores.bufferDays));
      if (trackerAndScores.daysOff) localStorage.setItem('usmle_daysOff_v4', JSON.stringify(trackerAndScores.daysOff));
      if (trackerAndScores.specificDaysOff) localStorage.setItem('usmle_specificDaysOff_v4', JSON.stringify(trackerAndScores.specificDaysOff));
      if (trackerAndScores.customDateMarks) localStorage.setItem('usmle_customDateMarks_v4', JSON.stringify(trackerAndScores.customDateMarks));
      if (trackerAndScores.defaultQuestionsByDayOfWeek) localStorage.setItem('usmle_defaultQuestionsByDayOfWeek_v4', JSON.stringify(trackerAndScores.defaultQuestionsByDayOfWeek));

      if (isReplace) {
        if (trackerAndScores.resources) localStorage.setItem('usmle_resources_v4', JSON.stringify(trackerAndScores.resources));
        if (trackerAndScores.studyLogs) localStorage.setItem('usmle_study_logs_v4', JSON.stringify(trackerAndScores.studyLogs));
        if (trackerAndScores.scores) localStorage.setItem('usmle_scores_v1', JSON.stringify(trackerAndScores.scores));
        if (trackerAndScores.themeId) localStorage.setItem('app-theme-id', trackerAndScores.themeId);
      } else {
        // Merge Tracker Resources & Logs
        const curRes = JSON.parse(localStorage.getItem('usmle_resources_v4') || '[]');
        const incRes = trackerAndScores.resources || [];
        const resMap = new Map();
        curRes.forEach((r: any) => resMap.set(r.id, r));
        incRes.forEach((r: any) => resMap.set(r.id, r));
        localStorage.setItem('usmle_resources_v4', JSON.stringify(Array.from(resMap.values())));

        const curLogs = JSON.parse(localStorage.getItem('usmle_study_logs_v4') || '[]');
        const incLogs = trackerAndScores.studyLogs || [];
        const logMap = new Map();
        curLogs.forEach((l: any) => logMap.set(l.id, l));
        incLogs.forEach((l: any) => logMap.set(l.id, l));
        localStorage.setItem('usmle_study_logs_v4', JSON.stringify(Array.from(logMap.values())));

        const curScores = JSON.parse(localStorage.getItem('usmle_scores_v1') || '[]');
        const incScores = trackerAndScores.scores || [];
        const scoreMap = new Map();
        curScores.forEach((s: any) => scoreMap.set(s.id || `${s.examType}_${s.date}`, s));
        incScores.forEach((s: any) => scoreMap.set(s.id || `${s.examType}_${s.date}`, s));
        localStorage.setItem('usmle_scores_v1', JSON.stringify(Array.from(scoreMap.values())));
      }
    }

    // 4. Restaurar Flashcards legados se houver
    if (legacyFlashcards && typeof legacyFlashcards === 'object') {
      for (const [simName, simData] of Object.entries(legacyFlashcards)) {
        await flashcardStore.saveSimulado(simName, simData as any);
      }
    }

    options.onProgress?.(90, 'Reindexando mídias e atualizando interface...');
    await mediaStorage.init();

    // 5. Notificar todas as abas e componentes que os dados foram restaurados
    window.dispatchEvent(new CustomEvent('usmle-data-restored', { detail: { mode: options.mode } }));
    window.dispatchEvent(new Event('storage'));

    options.onProgress?.(100, 'Restauração concluída com sucesso!');

    return {
      success: true,
      message: isReplace ? 'Todos os dados e mídias foram completamente restaurados!' : 'Dados e mídias foram mesclados com sucesso!'
    };
  } catch (err: any) {
    console.error('Erro na restauração de backup:', err);
    return {
      success: false,
      message: 'Falha ao restaurar o arquivo de backup.',
      error: err.message || 'Erro desconhecido durante a restauração.'
    };
  }
}
