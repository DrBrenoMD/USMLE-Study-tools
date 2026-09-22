import { flashcardStore, FlashcardQuestion } from "./flashcardStore";
import { useStore } from "../cardblocks/store/useStore";
import { notify } from "../cardblocks/lib/toast";

export async function exportSimuladoToCardblocksDeck(
  simName: string,
  onlyWrong: boolean = false
): Promise<string | null> {
  const store = useStore.getState();
  const simData = await flashcardStore.getSimulado(simName);
  const questions = Object.values(simData) as FlashcardQuestion[];

  if (questions.length === 0) {
    notify("Nenhuma questão encontrada neste simulado.", "warning");
    return null;
  }

  const targetQuestions = onlyWrong
    ? questions.filter((q) => q.result === 0)
    : questions;

  if (targetQuestions.length === 0) {
    notify("Nenhuma questão errada encontrada para exportar.", "info");
    return null;
  }

  const deckName = onlyWrong
    ? `Erros: ${simName}`
    : `Simulado: ${simName}`;

  // Check if deck already exists or create new
  let deck = store.decks.find((d) => d.name.toLowerCase() === deckName.toLowerCase());
  let deckId = deck?.id;
  if (!deckId) {
    deckId = store.createDeck(deckName);
  }

  let cardsCreated = 0;
  for (const q of targetQuestions) {
    let front = q.front || "";
    let back = q.back || "";

    // If front is empty, synthesize a meaningful flashcard front
    if (!front.trim()) {
      const temaStr = q.tema ? `[${q.tema}] ` : "";
      const motivoStr = q.motivo_erro ? ` (${q.motivo_erro})` : "";
      front = `<p><b>${temaStr}Questão #${q.id}${motivoStr}</b></p>`;
    }

    // If IO cards exist, append images to back
    if (q.io_cards && q.io_cards.length > 0) {
      q.io_cards.forEach((cardImg) => {
        back += `<div class="card-io-preview"><img src="${cardImg}" style="max-width:100%; border-radius: 8px; margin-top: 8px;" /></div>`;
      });
    }

    if (!back.trim()) {
      back = `<p>Subtema: ${q.subtema || "Geral"}</p><p>Motivo do Erro: ${q.motivo_erro || "Não especificado"}</p>`;
    }

    const tags: string[] = ["simulado", simName.replace(/\s+/g, "-")];
    if (q.tema) tags.push(q.tema.trim());
    if (q.subtema) tags.push(q.subtema.trim());
    if (q.motivo_erro) {
      q.motivo_erro.split(",").forEach((m) => tags.push(m.trim()));
    }
    if (q.result === 0) tags.push("errei");
    if (q.result === 1) tags.push("acertei");

    store.createCard(deckId, front, back, undefined, tags);
    cardsCreated++;
  }

  notify(`Criados ${cardsCreated} flashcards no baralho "${deckName}"!`, "success");
  return deckId;
}

export function saveQuestionToCardblocks(
  q: FlashcardQuestion,
  deckId?: string
): string | null {
  const store = useStore.getState();
  let targetDeckId = deckId;

  if (!targetDeckId) {
    if (store.decks.length > 0) {
      targetDeckId = store.decks[0].id;
    } else {
      targetDeckId = store.createDeck("Simulados & Revisões");
    }
  }

  let front = q.front || `<p><b>Questão #${q.id}</b> - ${q.tema || "Conceito"}</p>`;
  let back = q.back || "";
  if (q.io_cards && q.io_cards.length > 0) {
    q.io_cards.forEach((cardImg) => {
      back += `<div class="card-io-preview"><img src="${cardImg}" style="max-width:100%; border-radius: 8px; margin-top: 8px;" /></div>`;
    });
  }
  if (!back.trim()) {
    back = `<p>${q.motivo_erro || "Explicação da questão"}</p>`;
  }

  const tags: string[] = ["simulado"];
  if (q.tema) tags.push(q.tema.trim());
  if (q.subtema) tags.push(q.subtema.trim());
  if (q.motivo_erro) {
    q.motivo_erro.split(",").forEach((m) => tags.push(m.trim()));
  }

  store.createCard(targetDeckId, front, back, undefined, tags);
  const deckName = store.decks.find((d) => d.id === targetDeckId)?.name || "Baralho";
  notify(`Questão salva com sucesso no baralho "${deckName}"!`, "success");
  return targetDeckId;
}
