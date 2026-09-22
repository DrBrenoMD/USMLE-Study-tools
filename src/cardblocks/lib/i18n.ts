import { useStore } from '../store/useStore';

export const translations = {
  en: {
    home: {
      decks: "Decks",
      newDeck: "New Deck",
      deckNameLabel: "Deck Name",
      createDeck: "Create Deck",
      search: "Search decks...",
      noDecks: "No decks found. Create one to get started!",
      addDeck: "Add Deck"
    },
    menu: {
      browse: "Browse",
      settings: "Settings",
      home: "Home"
    },
    common: {
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      update: "Update",
      rename: "Rename"
    },
    deck: {
      studyNow: "Study Now",
      addCards: "Add Cards",
      manageDeck: "Manage Deck",
      due: "Due",
      new: "New",
      totalCards: "total cards",
      frontLabel: "Front (Question)",
      backLabel: "Back (Answer)",
      detailsLabel: "Extra Details / Explanation",
      addCard: "Add Card",
      editingCard: "Editing Card",
      doneEditing: "Done Editing",
      exportDeck: "Export Deck",
      importDeck: "Import Deck"
    },
    study: {
      sessionComplete: "Session Complete!",
      noCardsDue: "No cards due in this deck right now.",
      backToDecks: "Back to Decks",
      showAnswer: "Show Answer",
      again: "Again",
      hard: "Hard",
      good: "Good",
      easy: "Easy"
    },
    settings: {
      general: "General Settings",
      theme: "Theme",
      language: "Language",
      light: "Light",
      dark: "Dark",
      midnight: "Midnight",
      forest: "Forest",
      dracula: "Dracula",
      ocean: "Ocean",
      sunset: "Sunset",
      english: "English",
      portuguese: "Portuguese",
      sm2Config: "SM-2 Algorithm Configuration",
      cardsPerBlock: "Cards Per Block",
      cardOrder: "Card Presentation Order",
      orderNewFirst: "New/Learning First",
      orderReviewsFirst: "Reviews First",
      orderRandom: "Random",
      saveSettings: "Save Settings"
    }
  },
  pt: {
    home: {
      decks: "Baralhos",
      newDeck: "Novo Baralho",
      deckNameLabel: "Nome do Baralho",
      createDeck: "Criar Baralho",
      search: "Procurar baralhos...",
      noDecks: "Nenhum baralho encontrado. Crie um para começar!",
      addDeck: "Adicionar Baralho"
    },
    menu: {
      browse: "Navegar",
      settings: "Configurações",
      home: "Início"
    },
    common: {
      cancel: "Cancelar",
      save: "Salvar",
      delete: "Excluir",
      edit: "Editar",
      update: "Atualizar",
      rename: "Renomear"
    },
    deck: {
      studyNow: "Estudar Agora",
      addCards: "Adicionar Cartões",
      manageDeck: "Gerenciar Baralho",
      due: "Revisar",
      new: "Novo",
      totalCards: "cartões",
      frontLabel: "Frente (Pergunta)",
      backLabel: "Verso (Resposta)",
      detailsLabel: "Detalhes Extras / Explicação",
      addCard: "Adicionar Cartão",
      editingCard: "Editando Cartão",
      doneEditing: "Concluído",
      exportDeck: "Exportar Baralho",
      importDeck: "Importar Baralho"
    },
    study: {
      sessionComplete: "Sessão Concluída!",
      noCardsDue: "Nenhum cartão para revisar agora.",
      backToDecks: "Voltar",
      showAnswer: "Mostrar Resposta",
      again: "Errei",
      hard: "Difícil",
      good: "BOM",
      easy: "Fácil"
    },
    settings: {
      general: "Configurações Gerais",
      theme: "Tema",
      language: "Idioma",
      light: "Claro",
      dark: "Escuro",
      midnight: "Meia-noite",
      forest: "Floresta",
      dracula: "Drácula",
      ocean: "Oceano",
      sunset: "Pôr do Sol",
      english: "Inglês",
      portuguese: "Português",
      sm2Config: "Configuração do Algoritmo SM-2",
      cardsPerBlock: "Cartões por Bloco",
      cardOrder: "Ordem de Apresentação",
      orderNewFirst: "Novos/Aprendizagem Primeiro",
      orderReviewsFirst: "Revisões Primeiro",
      orderRandom: "Aleatório",
      saveSettings: "Salvar Configurações"
    }
  }
};

export function useTranslation() {
  const language = useStore(state => state.settings?.language || 'en');
  const t = translations[language] || translations.en;
  return { t, lang: language };
}
