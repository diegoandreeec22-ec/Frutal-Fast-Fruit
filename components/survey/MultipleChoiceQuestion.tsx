'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ChoiceOption } from '@/types/database';

export function MultipleChoiceQuestion({
  options,
  value,
  onChange,
  color,
}: {
  options: ChoiceOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  color: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : o.value)}
            style={selected ? { borderColor: color } : undefined}
            className={cn(
              'flex items-center justify-between rounded-xl border-2 bg-white px-4 py-3 text-left text-sm font-medium',
              selected ? 'text-gray-900 shadow-sm' : 'border-gray-200 text-gray-700',
            )}
          >
            {o.label}
            {selected && (
              <span className="rounded-full p-0.5 text-white" style={{ backgroundColor: color }}>
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
