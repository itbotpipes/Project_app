import { unstable_cache } from 'next/cache';

/**
 * Cached data fetching utility for Firestore queries
 * Uses Next.js unstable_cache to cache results and revalidate after specified time
 */

export function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  revalidateSeconds: number = 60
): Promise<T> {
  return unstable_cache(fn, [key], { revalidate: revalidateSeconds })();
}

/**
 * Batch fetch multiple documents by IDs in a single query
 * Reduces N+1 query problems
 */
export async function batchFetchByIds<T>(
  collectionName: string,
  ids: string[],
  adminDb: any
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();
  
  // Firestore 'in' query supports up to 10 items, so we need to batch
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }
  
  const results = new Map<string, T>();
  
  for (const chunk of chunks) {
    const snap = await adminDb.collection(collectionName)
      .where('__name__', 'in', chunk)
      .get();
    
    snap.docs.forEach((doc: any) => {
      results.set(doc.id, { id: doc.id, ...doc.data() } as T);
    });
  }
  
  return results;
}

/**
 * Cache tags for revalidation
 */
export const CACHE_TAGS = {
  EMPLOYEE: 'employee',
  TASK: 'task',
  ANNOUNCEMENT: 'announcement',
  GROUP: 'group',
  KPI_TEMPLATE: 'kpi-template',
  MONTHLY_SCORECARD: 'monthly-scorecard',
  ROLE: 'role',
  DEPARTMENT: 'department',
} as const;
