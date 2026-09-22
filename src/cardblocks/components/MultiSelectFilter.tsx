import React from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  placeholder: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export function MultiSelectFilter({ label, placeholder, options, selectedValues, onChange }: MultiSelectFilterProps) {
  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && !selectedValues.includes(val)) {
      onChange([...selectedValues, val]);
    }
    // reset to empty so it acts like an adder
    e.target.value = "";
  };

  const handleRemove = (val: string) => {
    onChange(selectedValues.filter(v => v !== val));
  };

  if (options.length === 0 && selectedValues.length === 0) return null;

  return (
    <div>
      <label className="text-xs text-ui-muted mb-1 block">{label}</label>
      <div className="flex flex-col gap-2">
        <select 
          className="w-full px-3 py-2 bg-ui-background border border-ui-border rounded-lg text-sm text-ui-text focus:outline-none focus:border-primary transition-colors appearance-none"
          onChange={handleSelect}
          defaultValue=""
        >
          <option value="" disabled>{placeholder}</option>
          {options.filter(o => !selectedValues.includes(o)).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map(val => (
              <span key={val} className="px-2 py-1 text-xs rounded-md bg-ui-surface-hover text-ui-text border border-ui-border flex items-center gap-1 group">
                {val}
                <button onClick={() => handleRemove(val)} className="text-ui-muted group-hover:text-red-500 rounded-full hover:bg-ui-surface">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
