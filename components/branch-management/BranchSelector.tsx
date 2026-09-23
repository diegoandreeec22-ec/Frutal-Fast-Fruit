'use client';

import { Checkbox } from '@/components/ui/Input';

// Selector múltiple de sucursales (invitaciones y edición de usuarios)
export function BranchSelector({
  branches,
  value,
  onChange,
  disabled,
}: {
  branches: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const all = branches.length > 0 && value.length === branches.length;
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-500">{value.length} seleccionadas</span>
        <button
          type="button"
          disabled={disabled}
          className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
          onClick={() => onChange(all ? [] : branches.map((b) => b.id))}
        >
          {all ? 'Quitar todas' : 'Seleccionar todas'}
        </button>
      </div>
      <div className="grid max-h-48 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
        {branches.map((b) => (
          <Checkbox
            key={b.id}
            label={b.name}
            disabled={disabled}
            checked={value.includes(b.id)}
            onChange={(checked) => onChange(checked ? [...value, b.id] : value.filter((id) => id !== b.id))}
          />
        ))}
        {branches.length === 0 && <p className="text-sm text-gray-500">No hay sucursales activas.</p>}
      </div>
    </div>
  );
}
