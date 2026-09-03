import { ArrowRight, BookOpen, CalendarDays, LineChart, Activity, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { MouseInteractiveBackground } from "../components/MouseInteractiveBackground";

const MENU_ITEMS = [
  {
    title: "Study Tracking",
    description: "Acompanhe seu progresso e metas diárias para a prova.",
    icon: CalendarDays,
    href: "/tracker",
    active: true,
  },
  {
    title: "Question Pacer",
    description: "Treine seu pace de questões contra o relógio.",
    icon: Activity,
    href: "/pacer",
    active: true,
  },
  {
    title: "NBME Calculator",
    description: "Estime seu score nos simulados do Step 1 e 2 CK.",
    icon: Calculator,
    href: "/calculator",
    active: true,
  },
  {
    title: "Score Predictor",
    description: "Previsão de score baseada no seu histórico de simulados.",
    icon: LineChart,
    href: "/predictor",
    active: true,
  },
  {
    title: "Flashcards",
    description: "Revisão espaçada dos principais tópicos.",
    icon: BookOpen,
    href: "/flashcards",
    active: true,
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-transparent font-sans">
      <MouseInteractiveBackground />
      <header className="flex flex-col items-center justify-center pt-12 pb-8 relative overflow-hidden">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2 relative z-10">
          USMLE Study Tools
        </h1>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest relative z-10">
          By Breno, MD
        </p>
      </header>
      <main className="z-10 flex w-full max-w-5xl flex-col items-center px-6 mx-auto mt-8">
        <nav className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.title}
              to={item.active ? item.href : "#"}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white dark:bg-gray-900 p-6 shadow-sm transition-all duration-300 ${
                item.active
                  ? "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 hover:shadow-md"
                  : "cursor-not-allowed border-gray-100 dark:border-gray-800 opacity-60"
              }`}
            >
              <div>
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3 text-blue-600 dark:text-blue-400 transition-colors border border-blue-100">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                  {item.title}
                </h2>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
              <div className="mt-6 flex items-center text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                {item.active ? (
                  <>
                    Acessar módulo
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">Em breve</span>
                )}
              </div>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
