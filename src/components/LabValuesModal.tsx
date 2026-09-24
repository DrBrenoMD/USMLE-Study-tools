import React, { useState } from 'react';
import { X, Search, Activity, Droplets, Heart, Brain, FlaskConical } from 'lucide-react';

interface LabValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LabCategory {
  name: string;
  icon: any;
  items: Array<{ name: string; range: string; note?: string }>;
}

const LAB_CATEGORIES: LabCategory[] = [
  {
    name: 'Eletrólitos & Bioquímica Sérica',
    icon: Droplets,
    items: [
      { name: 'Sódio (Na⁺)', range: '135 - 145 mEq/L' },
      { name: 'Potássio (K⁺)', range: '3.5 - 5.0 mEq/L' },
      { name: 'Cloreto (Cl⁻)', range: '96 - 106 mEq/L' },
      { name: 'Bicarbonato (HCO₃⁻)', range: '22 - 28 mEq/L' },
      { name: 'Ureia / BUN', range: '7 - 20 mg/dL' },
      { name: 'Creatinina', range: '0.6 - 1.2 mg/dL' },
      { name: 'Glicose em Jejum', range: '70 - 100 mg/dL' },
      { name: 'Cálcio Total (Ca²⁺)', range: '8.5 - 10.5 mg/dL' },
      { name: 'Magnésio (Mg²⁺)', range: '1.5 - 2.4 mg/dL' },
      { name: 'Fósforo (PO₄³⁻)', range: '2.5 - 4.5 mg/dL' },
      { name: 'Anion Gap Sérico', range: '8 - 12 mEq/L', note: '[Na⁺] - ([Cl⁻] + [HCO₃⁻])' },
    ]
  },
  {
    name: 'Gasometria Arterial (ABG)',
    icon: Activity,
    items: [
      { name: 'pH Arterial', range: '7.35 - 7.45' },
      { name: 'PaCO₂', range: '35 - 45 mmHg' },
      { name: 'PaO₂ (ao ar ambiente)', range: '80 - 100 mmHg' },
      { name: 'HCO₃⁻', range: '22 - 26 mEq/L' },
      { name: 'SaO₂', range: '> 95%' },
    ]
  },
  {
    name: 'Hematologia & Coagulação',
    icon: Heart,
    items: [
      { name: 'Hemoglobina (Hb) - Homem', range: '13.5 - 17.5 g/dL' },
      { name: 'Hemoglobina (Hb) - Mulher', range: '12.0 - 16.0 g/dL' },
      { name: 'Hematócrito (Ht) - Homem', range: '41 - 53%' },
      { name: 'Hematócrito (Ht) - Mulher', range: '36 - 46%' },
      { name: 'Leucócitos Totais (WBC)', range: '4,500 - 11,000 /µL' },
      { name: 'Plaquetas', range: '150,000 - 450,000 /µL' },
      { name: 'VCM (Volume Corpuscular Médio)', range: '80 - 100 fL' },
      { name: 'TP / INR', range: '0.8 - 1.2 (INR normal)' },
      { name: 'TTPa', range: '25 - 35 segundos' },
    ]
  },
  {
    name: 'Função Hepática & Enzimas',
    icon: FlaskConical,
    items: [
      { name: 'AST (TGO)', range: '10 - 40 U/L' },
      { name: 'ALT (TGP)', range: '7 - 56 U/L' },
      { name: 'Fosfatase Alcalina (FA)', range: '44 - 147 U/L' },
      { name: 'Bilirrubina Total', range: '0.3 - 1.2 mg/dL' },
      { name: 'Bilirrubina Direta', range: '0.0 - 0.3 mg/dL' },
      { name: 'Albumina', range: '3.5 - 5.5 g/dL' },
      { name: 'Amilase', range: '28 - 100 U/L' },
      { name: 'Lipase', range: '0 - 160 U/L' },
    ]
  },
  {
    name: 'Líquor (LCR) & Urina',
    icon: Brain,
    items: [
      { name: 'Pressão de Abertura LCR', range: '100 - 200 mm H₂O' },
      { name: 'Leucócitos LCR', range: '0 - 5 células/µL (mononucleares)' },
      { name: 'Glicose LCR', range: '45 - 80 mg/dL (~60% da glicemia)' },
      { name: 'Proteína LCR', range: '15 - 45 mg/dL' },
      { name: 'Densidade Urinária', range: '1.003 - 1.030' },
      { name: 'pH Urinário', range: '4.5 - 8.0' },
      { name: 'Osmolalidade Urinária', range: '50 - 1200 mOsm/kg' },
    ]
  }
];

export const LabValuesModal: React.FC<LabValuesModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const filteredCategories = LAB_CATEGORIES.map(cat => {
    const matchingItems = cat.items.filter(item => {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.range.toLowerCase().includes(q) || (item.note && item.note.toLowerCase().includes(q));
    });
    return { ...cat, items: matchingItems };
  }).filter(cat => {
    if (selectedCategory !== 'all' && cat.name !== selectedCategory) return false;
    return cat.items.length > 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Valores Normais de Laboratório (USMLE)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tabela de referência rápida padrão USMLE Step 1 & Step 2 CK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar exame ou valor (ex: Sódio, K+, pH, Plaquetas)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as Categorias</option>
            {LAB_CATEGORIES.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nenhum exame encontrado com o termo "{search}".
            </div>
          ) : (
            filteredCategories.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.name} className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-800 pb-1">
                    <Icon className="w-4 h-4" />
                    <span>{cat.name}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.items.map(item => (
                      <div
                        key={item.name}
                        className="p-2.5 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/80 flex items-start justify-between gap-2 text-xs hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</div>
                          {item.note && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500">{item.note}</div>
                          )}
                        </div>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-right shrink-0">
                          {item.range}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between text-xs text-gray-500">
          <span>* Valores fornecidos de acordo com o USMLE Official Content Outline.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
