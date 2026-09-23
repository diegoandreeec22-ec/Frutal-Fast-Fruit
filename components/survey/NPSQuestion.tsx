'use client';

import { cn } from '@/lib/utils';

function tone(n: number) {
  if (n <= 6) return 'border-red-200 text-red-700';
  if (n <= 8) return 'border-amber-200 text-amber-700';
  return 'border-brand-200 text-brand-800';
}

export function NPSQuestion({
  value,
  onChange,
  color,
}: {
  value: number | null;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11" role="radiogroup">
        {Array.from({ length: 11 }, (_, n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(n)}
              style={selected ? { backgroundColor: color, borderColor: color } : undefined}
              className={cn(
                'h-12 rounded-xl border-2 bg-white text-lg font-semibold transition-transform active:scale-95',
                selected ? 'text-white shadow-md' : tone(n),
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>Nada probable</span>
        <span>Muy probable</span>
      </div>
    </div>
  );
}
