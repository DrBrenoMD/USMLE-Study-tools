import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
