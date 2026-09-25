import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Enable CORS for Chrome Extension and cross-origin sync
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (_req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Cross-Tab / Cross-Origin Q-Bank Question Import Sync Queue
  let importedQuestionsQueue: any[] = [];

  app.post("/api/import-question", (req, res) => {
    try {
      const qData = req.body;
      if (!qData || (!qData.qid && !qData.questionId)) {
        return res.status(400).json({ error: "Invalid question data. QID is required." });
      }
      const qid = (qData.qid || qData.questionId).toString();
      const existingIdx = importedQuestionsQueue.findIndex(
        (q) => (q.qid || q.questionId || '').toString() === qid
      );

      if (existingIdx !== -1) {
        importedQuestionsQueue[existingIdx] = {
          ...importedQuestionsQueue[existingIdx],
          ...qData,
          timestamp: Date.now(),
        };
      } else {
        importedQuestionsQueue.push({
          ...qData,
          timestamp: Date.now(),
        });
      }

      if (importedQuestionsQueue.length > 500) {
        importedQuestionsQueue = importedQuestionsQueue.slice(-500);
      }

      res.json({ success: true, count: importedQuestionsQueue.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/imported-questions", (_req, res) => {
    res.json({ questions: importedQuestionsQueue });
  });

  app.delete("/api/imported-questions", (_req, res) => {
    importedQuestionsQueue = [];
    res.json({ success: true });
  });

  // In-memory catalog of cards with QIDs for instant extension lookups
  let cardsCatalog: any[] = [];
  let pendingCardActions: any[] = [];

  app.post("/api/cards-catalog", (req, res) => {
    try {
      const { cards } = req.body;
      if (Array.isArray(cards)) {
        cardsCatalog = cards;
      }
      res.json({ success: true, count: cardsCatalog.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/qbank-matching-cards", (req, res) => {
    try {
      const qid = (req.query.qid || '').toString().trim();
      if (!qid) {
        return res.json({ cards: [] });
      }
      const rawQid = qid;
      const cleanQid = rawQid.replace(/^(?:qid|id|q|#)[:\-_]*/i, '').trim();
      const numericQid = cleanQid.replace(/^0+/, '') || cleanQid;

      const matches = cardsCatalog.filter((c: any) => {
        if (!c) return false;

        // 1. Direct match in card.qids array
        if (c.qids && Array.isArray(c.qids)) {
          if (
            c.qids.includes(cleanQid) ||
            c.qids.includes(numericQid) ||
            c.qids.includes(rawQid)
          ) {
            return true;
          }
        }

        // 2. Direct questionId match
        if (c.questionId) {
          const cQid = c.questionId.toString().replace(/^(?:qid|id|q|#)[:\-_]*/i, '').trim();
          if (cQid === cleanQid || cQid === numericQid) return true;
        }

        // 3. Deck Name match (hierarchical deck e.g. "AnKing::Step 1::#UWorld::17499")
        if (c.deckName && typeof c.deckName === 'string') {
          const dLower = c.deckName.toLowerCase();
          if (
            dLower.includes(cleanQid.toLowerCase()) ||
            dLower.includes(numericQid.toLowerCase())
          ) {
            return true;
          }
        }

        // 4. Tags match (AnKing hierarchical tags, platform tags, created tags)
        if (c.tags && Array.isArray(c.tags)) {
          return c.tags.some((t: string) => {
            if (!t || typeof t !== 'string') return false;
            const tClean = t.trim();
            if (tClean.includes('::')) {
              const segs = tClean.split('::').map(s => s.trim());
              return segs.some(seg => {
                const sClean = seg.replace(/^(?:qid|id|uworld|amboss|comlex|combank|step|#)[:\-_]*/i, '').trim();
                return sClean === cleanQid || sClean === numericQid || seg === cleanQid;
              });
            }
            const directClean = tClean.replace(/^(?:qid|id|uworld|amboss|comlex|combank|#)[:\-_]*/i, '').trim();
            return (
              directClean === cleanQid ||
              directClean === numericQid ||
              tClean === `qid:${cleanQid}` ||
              tClean === cleanQid
            );
          });
        }

        // 5. Front or back text match if contains explicit QID pattern
        const fullText = `${c.frontPreview || c.front || ''} ${c.backPreview || c.back || ''}`;
        if (
          fullText.includes(`ID: ${cleanQid}`) ||
          fullText.includes(`ID:${cleanQid}`) ||
          fullText.includes(`QID: ${cleanQid}`) ||
          fullText.includes(`QID:${cleanQid}`)
        ) {
          return true;
        }

        return false;
      });
      res.json({ cards: matches });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/update-card-status", (req, res) => {
    try {
      const { cardId, action, qid } = req.body;
      if (!cardId || !action) {
        return res.status(400).json({ error: "cardId and action required" });
      }

      // Update in-memory catalog
      const card = cardsCatalog.find((c: any) => c.id === cardId);
      if (card) {
        if (action === 'activate_today' || action === 'activate_and_schedule_today') {
          card.isSuspended = false;
          card.nextReviewDate = Date.now() - 1000;
          card.isDue = true;
          if (qid) {
            card.questionId = qid;
            if (!card.qids) card.qids = [];
            if (!card.qids.includes(qid)) card.qids.push(qid);
          }
        } else if (action === 'unsuspend') {
          card.isSuspended = false;
        } else if (action === 'schedule_today') {
          card.nextReviewDate = Date.now() - 1000;
          card.isDue = true;
          card.isSuspended = false;
        } else if (action === 'associate' && qid) {
          card.questionId = qid;
          if (!card.qids) card.qids = [];
          if (!card.qids.includes(qid)) card.qids.push(qid);
        }
      }

      // Queue action for web app store synchronization
      pendingCardActions.push({
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        cardId,
        action,
        qid,
        timestamp: Date.now(),
      });

      if (pendingCardActions.length > 300) {
        pendingCardActions = pendingCardActions.slice(-300);
      }

      res.json({ success: true, updated: Boolean(card) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pending-card-actions", (_req, res) => {
    res.json({ actions: pendingCardActions });
  });

  app.delete("/api/pending-card-actions", (_req, res) => {
    pendingCardActions = [];
    res.json({ success: true });
  });

  // AI Study Material Generation
  app.post("/api/generate-study-material", async (req, res) => {
    try {
      const { text, explanation, alternatives, type } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
      }

      const ai = new GoogleGenAI({ apiKey });

      let prompt = `Você é um assistente de estudos para estudantes de medicina e gerador de materiais para flashcards e resumos médicos.
Analise a questão, suas alternativas e sua explicação detalhada.
`;
      if (type === "flashcards") {
        prompt += `Sintetize esse conhecimento em até 5 Flashcards objetivos (frente/verso).
Retorne ESTRITAMENTE um objeto JSON válido (sem tags markdown):
{
  "flashcards": [
    {
      "front": "string (pergunta ou conceito chave)",
      "back": "string (resposta objetiva e justificativa essencial)"
    }
  ]
}
`;
      } else {
        prompt += `Sintetize os conceitos essenciais em uma Nota (resumo de até 1000 caracteres formatado com HTML simples).
Retorne ESTRITAMENTE um objeto JSON válido (sem tags markdown):
{
  "note": "string (resumo com tags HTML como <b>, <p>, <ul>, <li>)"
}
`;
      }

      prompt += `
Dados de entrada:
Questão: ${text || ""}
Explicação: ${explanation || ""}
Alternativas: ${alternatives ? JSON.stringify(alternatives) : "[]"}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

      const result = JSON.parse(responseText);
      res.json(result);
    } catch (err: any) {
      console.error("Erro na geração de material de estudo:", err);
      res.status(500).json({ error: err.message || "Falha ao gerar material com IA." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
