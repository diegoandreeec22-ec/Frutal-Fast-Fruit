// Límite de peticiones en memoria (ventana fija). Es "best effort": en Vercel cada
// instancia tiene su propia memoria. Para producción con mucho tráfico conviene
// moverlo a Upstash/Redis, pero ya frena abusos simples (spam de encuestas, fuerza bruta).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      buckets.forEach((b, k) => {
        if (b.resetAt < now) buckets.delete(k);
      });
    }
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}
