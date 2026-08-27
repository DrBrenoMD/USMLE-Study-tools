import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { flashcardStore } from "../services/flashcardStore";
import { MouseInteractiveBackground } from "../components/MouseInteractiveBackground";
import { BookOpen, Plus, ArrowRight } from "lucide-react";

export default function FlashcardsLobby() {
  const [simulados, setSimulados] = useState<string[]>([]);
  const [newSimName, setNewSimName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadSimulados();
  }, []);

  const loadSimulados = async () => {
    const list = await flashcardStore.getSimuladosList();
    setSimulados(list);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSimName.trim()) return;
    navigate(`/flashcards/editor?sim=${encodeURIComponent(newSimName.trim())}`);
  };

  return (
    <div className="relative flex flex-1 flex-col items-center py-10 px-6 font-sans">
      <MouseInteractiveBackground />
      <div className="z-10 w-full max-w-3xl flex flex-col gap-8">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 mb-4 shadow-sm border border-blue-200">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">
            Painel de Simulados
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            Crie um novo bloco de correção ou continue de onde parou.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Iniciar Novo Bloco
          </h2>
          <form
            onSubmit={handleCreate}
            className="flex flex-col sm:flex-row gap-4"
          >
            <input
              type="text"
              value={newSimName}
              onChange={(e) => setNewSimName(e.target.value)}
              placeholder="Ex: UWorld Bloco 4"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-medium"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar e Iniciar
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Histórico de Simulados
          </h2>
          <div className="flex flex-col gap-3">
            {simulados.length === 0 ? (
              <p className="text-gray-500 italic text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Nenhum simulado salvo ainda.
              </p>
            ) : (
              simulados.map((sim) => (
                <div
                  key={sim}
                  className="flex justify-between items-center bg-gray-50 p-4 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <span className="font-bold text-gray-800 text-lg">{sim}</span>
                  <button
                    onClick={() =>
                      navigate(
                        `/flashcards/editor?sim=${encodeURIComponent(sim)}`,
                      )
                    }
                    className="px-4 py-2 bg-white border border-gray-200 text-blue-600 rounded-lg font-bold hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    Abrir <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
