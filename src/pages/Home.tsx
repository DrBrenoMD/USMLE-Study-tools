import { ArrowRight, BookOpen, CalendarDays, LineChart } from "lucide-react";
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
    title: "Flashcards",
    description: "Revisão espaçada dos principais tópicos.",
    icon: BookOpen,
    href: "#",
    active: false,
  },
  {
    title: "Performance",
    description: "Análise de evolução nos simulados e NBMEs.",
    icon: LineChart,
    href: "#",
    active: false,
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F9FAFB] font-sans">
      <MouseInteractiveBackground />

      <header className="flex flex-col items-center justify-center pt-12 pb-8 bg-white border-b border-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.08),transparent_50%)]"></div>
        <h1 className="text-4xl font-extralight tracking-tight text-gray-900 mb-6 relative z-10">
          Breno Md
        </h1>
        <nav className="flex space-x-8 relative z-10">
          <Link to="/tracker" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">Study Tracking</Link>
          <Link to="#" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">Question Banks</Link>
          <Link to="#" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">Materials</Link>
          <Link to="#" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">NBMEs</Link>
        </nav>
      </header>

      <main className="z-10 flex w-full max-w-5xl flex-col items-center px-6 mx-auto mt-16">
        <nav className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.title}
              to={item.active ? item.href : "#"}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 ${
                item.active
                  ? "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  : "cursor-not-allowed border-gray-100 opacity-60"
              }`}
            >
              <div>
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-blue-50 p-3 text-blue-600 transition-colors border border-blue-100">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="mb-2 text-sm font-bold text-gray-900">
                  {item.title}
                </h2>
                <p className="text-xs leading-relaxed text-gray-500">
                  {item.description}
                </p>
              </div>
              <div className="mt-6 flex items-center text-[10px] font-bold uppercase text-blue-600">
                {item.active ? (
                  <>
                    Acessar módulo
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                ) : (
                  <span className="text-gray-400">Em breve</span>
                )}
              </div>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
