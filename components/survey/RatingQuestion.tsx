'use client';

import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

const FACES_5 = ['😞', '😕', '😐', '🙂', '😍'];
const LABELS_5 = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

export function RatingQuestion({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const isFive = min === 1 && max === 5;

  if (!isFive) {
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              'h-12 min-w-12 rounded-xl border-2 px-3 text-lg font-semibold',
              value === v ? 'border-brand-700 bg-brand-700 text-white' : 'border-gray-200 bg-white text-gray-700',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between gap-1" role="radiogroup">
        {values.map((v, i) => {
          const active = value !== null && v <= value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              aria-label={`${v} - ${LABELS_5[i]}`}
              onClick={() => onChange(v)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-transform active:scale-95"
            >
              <Star
                className={cn('h-10 w-10 transition-colors', active ? 'fill-accent-500 text-accent-500' : 'text-gray-300')}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-1 h-6 text-center text-sm font-medium text-gray-700">
        {value !== null ? `${FACES_5[value - 1]} ${LABELS_5[value - 1]}` : ''}
      </p>
    </div>
  );
}
