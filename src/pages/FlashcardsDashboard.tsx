import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  flashcardStore,
  SimuladoData,
  FlashcardQuestion,
} from "../services/flashcardStore";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  FileDown,
  Download,
  FileText,
  Expand,
} from "lucide-react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";

export default function FlashcardsDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const simName = params.get("sim") || "";

  const [data, setData] = useState<SimuladoData>({});

  const [previewQ, setPreviewQ] = useState<FlashcardQuestion | null>(null);

  useEffect(() => {
    if (!simName) {
      navigate("/flashcards");
      return;
    }
    loadData();
  }, [simName]);

  const loadData = async () => {
    const simData = await flashcardStore.getSimulado(simName);
    setData(simData);
  };

  // Stats calculation
  const stats = useMemo(() => {
    let corretas = 0;
    let erradas = 0;
    const temas: Record<string, { certas: number; erradas: number }> = {};
    const motivos: Record<string, number> = {};
    const questions = Object.values(data) as FlashcardQuestion[];

    questions.forEach((q) => {
      if (q.result === 1) corretas++;
      if (q.result === 0) erradas++;

      if (q.result !== undefined) {
        const t = (q.tema || "Diversos").trim();
        if (!temas[t]) temas[t] = { certas: 0, erradas: 0 };
        if (q.result === 1) temas[t].certas++;
        if (q.result === 0) {
          temas[t].erradas++;
          if (q.motivo_erro) {
            q.motivo_erro.split(",").forEach((m) => {
              const motivo = m.trim();
              if (motivo) motivos[motivo] = (motivos[motivo] || 0) + 1;
            });
          }
        }
      }
    });

    const total = corretas + erradas;
    const taxaGeral = total > 0 ? Math.round((corretas / total) * 100) : 0;

    const temasArray = Object.entries(temas).map(([nome, s]) => ({
      nome,
      certas: s.certas,
      erradas: s.erradas,
      total: s.certas + s.erradas,
      taxa:
        s.certas + s.erradas > 0
          ? Math.round((s.certas / (s.certas + s.erradas)) * 100)
          : 0,
    }));

    let forte = { nome: "-", taxa: -1 };
    let fraco = { nome: "-", taxa: 101 };

    temasArray.forEach((t) => {
      if (t.total >= 2) {
        if (t.taxa > forte.taxa) forte = { nome: t.nome, taxa: t.taxa };
        if (t.taxa < fraco.taxa) fraco = { nome: t.nome, taxa: t.taxa };
      }
    });

    const motivosArray = Object.entries(motivos)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      corretas,
      erradas,
      taxaGeral,
      temas: temasArray,
      forte,
      fraco,
      motivos: motivosArray,
      questions,
    };
  }, [data]);

  const exportCSV = () => {
    const rows: any[] = [];
    stats.questions.forEach((q) => {
      const tags = [q.tema, q.subtema, q.motivo_erro]
        .filter(Boolean)
        .join(" ")
        .replace(/,/g, "");

      const frontClean = (q.front || "").replace(/\n/g, "<br/>");
      const backClean = (q.back || "").replace(/\n/g, "<br/>");

      if (frontClean || backClean) {
        rows.push({
          Frente: frontClean,
          Verso: backClean,
          Tags: tags,
        });
      }

      if (q.io_cards) {
        q.io_cards.forEach((io, idx) => {
          rows.push({
            Frente: io.front,
            Verso: io.back,
            Tags: tags + " IO",
          });
        });
      }
    });

    if (rows.length === 0) return alert("Nenhum card para exportar.");

    const csv = Papa.unparse(rows, { delimiter: "\t" }); // TSV better for Anki
    const blob = new Blob([csv], {
      type: "text/tab-separated-values;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Anki_${simName}.txt`;
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text(`Revisão de Simulado: ${simName}`, 20, y);
    y += 15;

    stats.questions.forEach((q) => {
      if (!q.front && !q.back && (!q.io_cards || q.io_cards.length === 0))
        return;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Questão ${q.id} - ${q.tema || "Diversos"}`, 20, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
      };

      const frontText = stripHtml(q.front || "");
      const backText = stripHtml(q.back || "");

      const splitFront = doc.splitTextToSize(`F: ${frontText}`, 170);
      doc.text(splitFront, 20, y);
      y += splitFront.length * 5 + 2;

      const splitBack = doc.splitTextToSize(`V: ${backText}`, 170);
      doc.text(splitBack, 20, y);
      y += splitBack.length * 5 + 8;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`Revisao_${simName}.pdf`);
  };

  const COLORS = ["#22c55e", "#ef4444"];

  return (
    <div className="flex-1 bg-gray-50 min-h-[calc(100vh-56px)] overflow-y-auto p-6 sm:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-6">
          <div>
            <button
              onClick={() => navigate("/flashcards")}
              className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1 mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar ao Painel
            </button>
            <h1 className="text-3xl font-black text-gray-900">
              Relatório: <span className="text-blue-600">{simName}</span>
            </h1>
          </div>
          <button
            onClick={() =>
              navigate(`/flashcards/editor?sim=${encodeURIComponent(simName)}`)
            }
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 shadow-sm transition-colors"
          >
            Voltar à Correção
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={exportCSV}
            className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-2xl shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Download className="w-8 h-8 mb-2" />
            <span className="font-bold text-lg">Gerar para Anki (.txt)</span>
            <span className="text-blue-200 text-xs mt-1">
              Importável via "Arquivo &gt; Importar"
            </span>
          </button>
          <button
            onClick={exportPDF}
            className="flex flex-col items-center justify-center p-6 bg-red-600 text-white rounded-2xl shadow-sm hover:bg-red-700 transition-colors"
          >
            <FileText className="w-8 h-8 mb-2" />
            <span className="font-bold text-lg">
              PDF Flashcards (Apenas Texto)
            </span>
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-gray-500 text-sm">
              Taxa de Acerto Geral
            </h3>
            <div className="text-4xl font-black text-blue-600 mt-2">
              {stats.taxaGeral}%
            </div>
            <div className="text-xs mt-1 text-gray-400 font-medium">
              {stats.total} questões analisadas
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-gray-500 text-sm">Tema Mais Forte</h3>
            <div className="text-xl font-bold text-green-600 mt-2 truncate w-full">
              {stats.forte.nome}
            </div>
            <div className="text-xs mt-1 text-gray-400 font-medium">
              {stats.forte.taxa !== -1 ? `${stats.forte.taxa}% de acerto` : "-"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-gray-500 text-sm">
              Calcanhar de Aquiles
            </h3>
            <div className="text-xl font-bold text-red-600 mt-2 truncate w-full">
              {stats.fraco.nome}
            </div>
            <div className="text-xs mt-1 text-gray-400 font-medium">
              {stats.fraco.taxa !== 101
                ? `${stats.fraco.taxa}% de acerto`
                : "-"}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
            <h3 className="font-bold text-gray-500 text-sm mb-2">
              Visão Geral
            </h3>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Acertos", value: stats.corretas },
                      { name: "Erros", value: stats.erradas },
                    ]}
                    innerRadius={25}
                    outerRadius={40}
                    dataKey="value"
                    stroke="none"
                  >
                    {[{ name: "Acertos" }, { name: "Erros" }].map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ),
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
            <h3 className="text-center font-bold text-gray-900">
              Volume de Acertos vs Erros por Tema
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.temas}
                  margin={{ top: 20, right: 0, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    dataKey="erradas"
                    stackId="a"
                    fill="#ef4444"
                    name="Erros"
                  />
                  <Bar
                    dataKey="certas"
                    stackId="a"
                    fill="#22c55e"
                    name="Acertos"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-2">
            <h3 className="text-center font-bold text-gray-900">
              Motivos de Erro
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.motivos}
                  margin={{ top: 20, right: 0, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar
                    dataKey="count"
                    fill="#a855f7"
                    name="Quantidade"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Preview Cards */}
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Pré-visualização dos Flashcards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.questions
              .filter(
                (q) => q.front || q.back || (q.io_cards && q.io_cards.length),
              )
              .map((q) => {
                const stripHtml = (html: string) => {
                  const tmp = document.createElement("DIV");
                  tmp.innerHTML = html;
                  return tmp.textContent || tmp.innerText || "";
                };
                let resumoFront = stripHtml(q.front || "").substring(0, 100);
                if (resumoFront.length === 100) resumoFront += "...";
                if (!resumoFront && q.front?.includes("<img"))
                  resumoFront = "[Contém Imagem/Esquema]";

                return (
                  <div
                    key={q.id}
                    onClick={() => setPreviewQ(q)}
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col cursor-pointer hover:shadow-md hover:border-blue-400 transition-all transform hover:-translate-y-1"
                  >
                    <div className="text-sm font-black text-blue-600 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                      <span>Questão {q.id}</span>
                      <Expand className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 text-sm text-gray-600 italic mb-4">
                      "{resumoFront || "Sem texto na frente"}"
                    </div>
                    <div className="mt-auto text-xs font-bold bg-gray-50 border border-gray-100 text-gray-500 p-2 rounded-lg text-center">
                      Ver conteúdo completo →
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modal Preview */}
      {previewQ && (
        <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Questão {previewQ.id}
              </h2>
              <button
                onClick={() => setPreviewQ(null)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-gray-800">
              <div>
                <h3 className="font-bold text-blue-600 border-b border-gray-100 pb-1 mb-3">
                  Frente
                </h3>
                <div
                  dangerouslySetInnerHTML={{
                    __html: previewQ.front || "<i>Vazio</i>",
                  }}
                  className="prose prose-sm max-w-none"
                />
              </div>
              <div>
                <h3 className="font-bold text-blue-600 border-b border-gray-100 pb-1 mb-3">
                  Verso
                </h3>
                <div
                  dangerouslySetInnerHTML={{
                    __html: previewQ.back || "<i>Vazio</i>",
                  }}
                  className="prose prose-sm max-w-none"
                />
              </div>
              {previewQ.io_cards && previewQ.io_cards.length > 0 && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-sm font-bold text-indigo-700">
                  🖼️ Esta questão possui {previewQ.io_cards.length} cards extra
                  de Oclusão de Imagem.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setPreviewQ(null)}
                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() =>
                  navigate(
                    `/flashcards/editor?sim=${encodeURIComponent(simName)}&q=${previewQ.id}`,
                  )
                }
                className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Ir para Edição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
