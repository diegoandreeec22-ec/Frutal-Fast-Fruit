'use client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

// fetch JSON contra /api/* con manejo uniforme de errores
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(data.error ?? 'Ocurrió un error', res.status, data.details);
  }
  return data as T;
}

// Primer mensaje legible de un error de validación de Zod (flatten)
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
    const first = d?.formErrors?.[0] ?? Object.values(d?.fieldErrors ?? {})[0]?.[0];
    return first ? `${e.message}: ${first}` : e.message;
  }
  return (e as Error)?.message ?? 'Ocurrió un error';
}
