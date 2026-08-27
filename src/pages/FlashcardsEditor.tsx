import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  flashcardStore,
  FlashcardQuestion,
  SimuladoData,
} from "../services/flashcardStore";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  Check,
  X,
  Target,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import * as fabric from "fabric";

export default function FlashcardsEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const simName = params.get("sim") || "";

  const [data, setData] = useState<SimuladoData>({});
  const [currentId, setCurrentId] = useState<number>(1);
  const [qData, setQData] = useState<FlashcardQuestion>({ id: 1 });
  const [score, setScore] = useState({ corretas: 0, total: 0 });
  const [pace, setPace] = useState(0);

  // IO Modal
  const [ioModalOpen, setIoModalOpen] = useState(false);
  const [ioImage, setIoImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [ioTool, setIoTool] = useState<"mask" | "pen">("pen");
  const [ioScale, setIoScale] = useState(1);

  // Timer
  useEffect(() => {
    let interval = setInterval(() => {
      setPace((p) => p + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentId]); // reseta timer a cada questao

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

    // Auto-select max question or 1
    const ids = Object.keys(simData).map(Number);
    const max = ids.length > 0 ? Math.max(...ids) : 1;
    loadQuestion(simData, max);
  };

  const loadQuestion = (simData: SimuladoData, id: number) => {
    setCurrentId(id);
    setPace(0);
    setQData(simData[id] || { id });

    let certas = 0;
    let erradas = 0;
    Object.values(simData).forEach((q: any) => {
      if (q.result === 1) certas++;
      if (q.result === 0) erradas++;
    });
    setScore({ corretas: certas, total: certas + erradas });
  };

  const handleUpdate = (updates: Partial<FlashcardQuestion>) => {
    const newQ = { ...qData, ...updates };
    setQData(newQ);

    // update state immediately and save
    const newData = { ...data, [newQ.id]: newQ };
    setData(newData);
    flashcardStore.saveSimulado(simName, newData);

    if (updates.result !== undefined) {
      let certas = 0;
      let erradas = 0;
      Object.values(newData).forEach((q: any) => {
        if (q.result === 1) certas++;
        if (q.result === 0) erradas++;
      });
      setScore({ corretas: certas, total: certas + erradas });
    }
  };

  const navigateQ = (dir: number) => {
    if (currentId + dir > 0) {
      loadQuestion(data, currentId + dir);
    }
  };

  const openIO = () => {
    // try to find first image in front or back
    const html = (qData.front || "") + (qData.back || "");
    const m = html.match(/<img[^>]+src="([^">]+)"/);
    if (m && m[1]) {
      setIoImage(m[1]);
      setIoModalOpen(true);
    } else {
      alert(
        "Nenhuma imagem encontrada nos textos da questão (frente ou verso) para gerar cards de oclusão.",
      );
    }
  };

  // Setup Fabric Canvas
  useEffect(() => {
    if (ioModalOpen && canvasRef.current && ioImage) {
      const fc = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: ioTool === "pen",
      });
      fc.freeDrawingBrush.color = "#ef4444";
      fc.freeDrawingBrush.width = 3;
      setFabricCanvas(fc);

      fabric.Image.fromURL(ioImage, (img) => {
        let scale = Math.min(
          (window.innerWidth * 0.8) / (img.width || 1),
          (window.innerHeight * 0.7) / (img.height || 1),
        );
        if (scale > 1) scale = 1;
        setIoScale(scale);
        fc.setWidth((img.width || 0) * scale);
        fc.setHeight((img.height || 0) * scale);
        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: "left",
          originY: "top",
        });
        fc.setBackgroundImage(img, fc.renderAll.bind(fc));
      });

      let isDrawingRect = false;
      let tempRect: fabric.Rect | null = null;
      let startPoint = { x: 0, y: 0 };

      fc.on("mouse:down", (o) => {
        if (fc.isDrawingMode) return;
        isDrawingRect = true;
        const pointer = fc.getPointer(o.e);
        startPoint = pointer;
        tempRect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "#FFE082",
          opacity: 0.9,
          selectable: true,
        });
        fc.add(tempRect);
      });
      fc.on("mouse:move", (o) => {
        if (!isDrawingRect || !tempRect) return;
        const pointer = fc.getPointer(o.e);
        tempRect.set({
          left: Math.min(pointer.x, startPoint.x),
          top: Math.min(pointer.y, startPoint.y),
          width: Math.abs(pointer.x - startPoint.x),
          height: Math.abs(pointer.y - startPoint.y),
        });
        fc.renderAll();
      });
      fc.on("mouse:up", () => {
        isDrawingRect = false;
        if (tempRect) tempRect.setCoords();
      });

      return () => {
        fc.dispose();
      };
    }
  }, [ioModalOpen, ioImage]);

  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas.isDrawingMode = ioTool === "pen";
    }
  }, [ioTool, fabricCanvas]);

  const saveIO = (mode: "single" | "multiple") => {
    if (!fabricCanvas) return;
    const masks = fabricCanvas
      .getObjects()
      .filter((o) => o.type === "rect") as fabric.Rect[];
    masks.forEach((m) => m.set("visible", false));
    const base64Img = fabricCanvas.toDataURL({
      format: "jpeg",
      quality: 1.0,
      multiplier: 1 / ioScale,
    });
    masks.forEach((m) => m.set("visible", true));

    const w = fabricCanvas.width || 1;
    const h = fabricCanvas.height || 1;
    const cssMasks = masks.map((m) => ({
      left: ((m.left || 0) / w) * 100,
      top: ((m.top || 0) / h) * 100,
      width: (m.getScaledWidth() / w) * 100,
      height: (m.getScaledHeight() / h) * 100,
    }));
    const imgTag = `<img src="${base64Img}" style="width:100%; display:block; border-radius: 4px;">`;
    const generatedCards = [];

    if (mode === "single") {
      const frontDivs = cssMasks
        .map(
          (m) =>
            `<div style="position:absolute; left:${m.left}%; top:${m.top}%; width:${m.width}%; height:${m.height}%; background:#FFE082; border: 1px solid #d97706; border-radius: 2px;"></div>`,
        )
        .join("");
      generatedCards.push({
        front: `<div style="position:relative; display:inline-block; width:100%; max-width:600px;">${imgTag}${frontDivs}</div>`,
        back: `<div style="position:relative; display:inline-block; width:100%; max-width:600px;">${imgTag}</div>`,
      });
    } else if (mode === "multiple") {
      cssMasks.forEach((_, idx) => {
        const frontDivs = cssMasks
          .map(
            (m, i) =>
              `<div style="position:absolute; left:${m.left}%; top:${m.top}%; width:${m.width}%; height:${m.height}%; background:${i === idx ? "#ef4444" : "#FFE082"}; border: 1px solid #d97706; border-radius: 2px;"></div>`,
          )
          .join("");
        const backDivs = cssMasks
          .map((m, i) =>
            i === idx
              ? ""
              : `<div style="position:absolute; left:${m.left}%; top:${m.top}%; width:${m.width}%; height:${m.height}%; background:#FFE082; border: 1px solid #d97706; border-radius: 2px;"></div>`,
          )
          .join("");
        generatedCards.push({
          front: `<div style="position:relative; display:inline-block; width:100%; max-width:600px;">${imgTag}${frontDivs}</div>`,
          back: `<div style="position:relative; display:inline-block; width:100%; max-width:600px;">${imgTag}${backDivs}</div>`,
        });
      });
    }

    const currentIo = qData.io_cards || [];
    handleUpdate({ io_cards: [...currentIo, ...generatedCards] });
    setIoModalOpen(false);
  };

  const modules = useMemo(
    () => ({
      toolbar: [
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["image", "clean"],
      ],
    }),
    [],
  );

  // Compute question list
  const savedIds = Object.keys(data).map(Number);
  const maxQuestion = Math.max(currentId, ...savedIds, 1);
  const qList = [];
  for (let i = 1; i <= maxQuestion; i++) qList.push(i);

  return (
    <div className="flex flex-1 h-[calc(100vh-56px)] bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/flashcards")}
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-900 truncate">{simName}</span>
          </div>
          <button
            onClick={() =>
              navigate(
                `/flashcards/dashboard?sim=${encodeURIComponent(simName)}`,
              )
            }
            className="w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {qList.map((i) => {
            const q = data[i];
            const isCerta = q?.result === 1;
            const isErrada = q?.result === 0;
            return (
              <div
                key={i}
                onClick={() => loadQuestion(data, i)}
                className={`p-3 rounded-lg cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between ${i === currentId ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-600"}`}
              >
                <span>Questão {i}</span>
                {isCerta && <Check className="w-4 h-4 text-green-600" />}
                {isErrada && <X className="w-4 h-4 text-red-600" />}
              </div>
            );
          })}
          <div
            onClick={() => loadQuestion(data, maxQuestion + 1)}
            className="p-3 text-center cursor-pointer text-blue-600 hover:bg-blue-50 font-bold rounded-lg border border-transparent hover:border-blue-100 transition-colors text-sm"
          >
            + Nova Questão
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50 p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-gray-900">
              Questão {currentId}
            </h1>
            <div className="flex gap-1">
              <button
                onClick={() => navigateQ(-1)}
                className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigateQ(1)}
                className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-2 font-bold text-blue-700">
              <Target className="w-4 h-4" />
              <span>
                {score.corretas}/{score.total}
              </span>
              <span className="text-gray-400 text-xs ml-1">
                (
                {score.total > 0
                  ? Math.round((score.corretas / score.total) * 100)
                  : 0}
                %)
              </span>
            </div>
            <div
              className={`px-4 py-2 font-mono font-bold rounded-xl shadow-sm border ${pace > 180 ? "bg-red-50 text-red-700 border-red-200" : pace > 120 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-green-700 border-gray-200"}`}
            >
              {String(Math.floor(pace / 60)).padStart(2, "0")}:
              {String(pace % 60).padStart(2, "0")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdate({ result: 1 })}
                className={`px-5 py-2 font-bold rounded-xl shadow-sm transition-colors border ${qData.result === 1 ? "bg-green-500 text-white border-green-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              >
                Certo
              </button>
              <button
                onClick={() => handleUpdate({ result: 0 })}
                className={`px-5 py-2 font-bold rounded-xl shadow-sm transition-colors border ${qData.result === 0 ? "bg-red-500 text-white border-red-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              >
                Errado
              </button>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-700">Tema</label>
            <input
              type="text"
              value={qData.tema || ""}
              onChange={(e) => handleUpdate({ tema: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-700">Subtema</label>
            <input
              type="text"
              value={qData.subtema || ""}
              onChange={(e) => handleUpdate({ subtema: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-700">
              Motivo do Erro
            </label>
            <input
              type="text"
              value={qData.motivo_erro || ""}
              onChange={(e) => handleUpdate({ motivo_erro: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* IO Badge */}
        {qData.io_cards && qData.io_cards.length > 0 && (
          <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-800 font-bold">
              <ImageIcon className="w-5 h-5" />
              <span>
                Esta questão possui {qData.io_cards.length} cards de Image
                Occlusion salvos.
              </span>
            </div>
            <button
              onClick={() => handleUpdate({ io_cards: [] })}
              className="px-3 py-1 bg-white text-red-600 font-bold border border-red-200 rounded-lg hover:bg-red-50 text-sm"
            >
              Limpar IO
            </button>
          </div>
        )}

        {/* Flashcard Editors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-blue-700">Frente do Card</h3>
              <button
                onClick={openIO}
                className="text-xs font-bold bg-white px-2 py-1 border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700 flex gap-1 items-center"
              >
                <ImageIcon className="w-3 h-3" /> Gerar IO
              </button>
            </div>
            <div className="flex-1 bg-white">
              <ReactQuill
                theme="snow"
                value={qData.front || ""}
                onChange={(v) => handleUpdate({ front: v })}
                modules={modules}
                className="h-[250px] sm:h-full border-none"
              />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-blue-700">Verso do Card</h3>
            </div>
            <div className="flex-1 bg-white">
              <ReactQuill
                theme="snow"
                value={qData.back || ""}
                onChange={(v) => handleUpdate({ back: v })}
                modules={modules}
                className="h-[250px] sm:h-full border-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* IO Modal */}
      {ioModalOpen && (
        <div className="fixed inset-0 z-[100] bg-gray-900/95 flex flex-col backdrop-blur-sm">
          <div className="h-16 bg-gray-800 flex justify-between items-center px-6 text-white shadow-md border-b border-gray-700">
            <div className="flex items-center gap-4">
              <span className="font-bold text-lg text-blue-400 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Estúdio IO
              </span>
              <div className="h-6 w-px bg-gray-600 mx-2"></div>
              <button
                onClick={() => setIoTool("pen")}
                className={`px-3 py-1 rounded font-bold ${ioTool === "pen" ? "bg-blue-600" : "bg-gray-700"}`}
              >
                Desenho
              </button>
              <button
                onClick={() => setIoTool("mask")}
                className={`px-3 py-1 rounded font-bold ${ioTool === "mask" ? "bg-blue-600" : "bg-gray-700"}`}
              >
                Máscara
              </button>
              <button
                onClick={() => fabricCanvas?.clear()}
                className="px-3 py-1 text-sm text-red-400 hover:text-red-300 ml-4"
              >
                Limpar
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => saveIO("single")}
                className="px-4 py-2 bg-blue-600 font-bold rounded shadow hover:bg-blue-500"
              >
                1 Card (Juntos)
              </button>
              <button
                onClick={() => saveIO("multiple")}
                className="px-4 py-2 bg-indigo-600 font-bold rounded shadow hover:bg-indigo-500"
              >
                Múltiplos Cards
              </button>
              <button
                onClick={() => setIoModalOpen(false)}
                className="px-4 py-2 bg-gray-600 font-bold rounded shadow hover:bg-gray-500"
              >
                Cancelar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex justify-center items-center p-8">
            <div className="shadow-2xl border-4 border-gray-700 bg-white inline-block">
              <canvas ref={canvasRef}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
