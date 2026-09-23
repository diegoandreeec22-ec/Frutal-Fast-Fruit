'use client';

import { Field, Input } from '@/components/ui/Input';

// Dos umbrales por pregunta:
//   crítica    -> valor <= critical
//   advertencia -> critical < valor <= warning
export function ThresholdConfig({
  min,
  max,
  critical,
  warning,
  onChange,
}: {
  min: number;
  max: number;
  critical: number | null;
  warning: number | null;
  onChange: (next: { critical: number | null; warning: number | null }) => void;
}) {
  const parse = (v: string) => (v === '' ? null : Number(v));
  const invalid = critical !== null && warning !== null && critical > warning;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-800">Umbrales de alerta</p>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">
        Deja vacío para no generar alertas. 3 respuestas críticas en 7 días escalan automáticamente a casa matriz.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={<span className="text-red-700">🔴 Crítica si la nota es ≤</span>} htmlFor="crit">
          <Input
            id="crit"
            type="number"
            min={min}
            max={max}
            step={1}
            value={critical ?? ''}
            onChange={(e) => onChange({ critical: parse(e.target.value), warning })}
          />
        </Field>
        <Field label={<span className="text-amber-700">🟠 Advertencia si la nota es ≤</span>} htmlFor="warn">
          <Input
            id="warn"
            type="number"
            min={min}
            max={max}
            step={1}
            value={warning ?? ''}
            onChange={(e) => onChange({ critical, warning: parse(e.target.value) })}
          />
        </Field>
      </div>
      {invalid && <p className="mt-2 text-xs text-red-600">El umbral crítico debe ser menor o igual al de advertencia.</p>}
    </div>
  );
}
