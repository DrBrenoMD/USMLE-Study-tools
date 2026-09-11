import { X, Check } from "lucide-react";
import { useEffect } from "react";

export const themes = [
  // Light Themes
  { id: "light-default", name: "Padrão Claro", type: "light", class: "" },
  { id: "light-warm", name: "Quente Claro", type: "light", class: "theme-light-warm" },
  { id: "light-cool", name: "Frio Claro", type: "light", class: "theme-light-cool" },
  { id: "light-sepia", name: "Sépia", type: "light", class: "theme-light-sepia" },
  { id: "light-high-contrast", name: "Alto Contraste Claro", type: "light", class: "theme-light-high-contrast" },
  
  // Dark Themes
  { id: "dark-default", name: "Padrão Escuro", type: "dark", class: "dark" },
  { id: "dark-dimmed", name: "Escuro Suave", type: "dark", class: "dark theme-dark-dimmed" },
  { id: "dark-oled", name: "OLED (Preto Puro)", type: "dark", class: "dark theme-dark-oled" },
  { id: "dark-midnight", name: "Meia-noite (Azul)", type: "dark", class: "dark theme-dark-midnight" },
  { id: "dark-dracula", name: "Drácula", type: "dark", class: "dark theme-dark-dracula" },

  // Thematic
  { id: "theme-synthwave", name: "Synthwave", type: "dark", class: "dark theme-synthwave" },
  { id: "theme-nature", name: "Natureza", type: "light", class: "theme-nature" },
  { id: "theme-ocean", name: "Oceano Profundo", type: "dark", class: "dark theme-ocean" },
  { id: "theme-sunset", name: "Pôr do Sol", type: "light", class: "theme-sunset" },
  { id: "theme-cyberpunk", name: "Cyberpunk", type: "dark", class: "dark theme-cyberpunk" },
];

export function ThemeSelector({ isOpen, onClose, currentTheme, onSelectTheme }) {
  if (!isOpen) return null;

  const groupedThemes = {
    "Claros": themes.filter(t => t.type === "light" && !t.id.startsWith("theme-")),
    "Escuros": themes.filter(t => t.type === "dark" && !t.id.startsWith("theme-")),
    "Temáticos": themes.filter(t => t.id.startsWith("theme-")),
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Aparência e Temas</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {Object.entries(groupedThemes).map(([groupName, groupThemes]) => (
            <div key={groupName} className="mb-8 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{groupName}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groupThemes.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => onSelectTheme(theme)}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      currentTheme.id === theme.id 
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">{theme.name}</span>
                    {currentTheme.id === theme.id && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
