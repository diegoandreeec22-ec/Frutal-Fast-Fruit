import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function MetricsCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'green',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span
          className={cn(
            'rounded-lg p-1.5',
            tone === 'green' && 'bg-brand-50 text-brand-700',
            tone === 'orange' && 'bg-orange-50 text-orange-600',
            tone === 'red' && 'bg-red-50 text-red-600',
            tone === 'blue' && 'bg-sky-50 text-sky-600',
            tone === 'gray' && 'bg-gray-100 text-gray-600',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="tabular mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </Card>
  );
}
