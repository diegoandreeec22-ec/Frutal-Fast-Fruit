'use client';

export function TextQuestion({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <textarea
        value={value}
        maxLength={2000}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escribe aquí (opcional)…"
        className="block w-full rounded-xl border-2 border-gray-200 bg-white p-3 text-base focus:border-brand-600 focus:outline-none"
      />
      <p className="mt-1 text-right text-xs text-gray-400">{value.length}/2000</p>
    </div>
  );
}
