import { unstable_cache } from 'next/cache';

function serializeValue(val: any): any {
  if (!val) return val;
  
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return {
        __type: 'Timestamp',
        seconds: Math.floor(d.getTime() / 1000),
        nanoseconds: (d.getTime() % 1000) * 1000000,
      };
    }
    
    if (val instanceof Date) {
      return {
        __type: 'Date',
        value: val.toISOString(),
      };
    }
    
    if (Array.isArray(val)) {
      return val.map(serializeValue);
    }
    
    const res: any = {};
    for (const key of Object.keys(val)) {
      res[key] = serializeValue(val[key]);
    }
    return res;
  }
  
  return val;
}

function serializeSnapshot(val: any): any {
  if (!val || typeof val !== 'object') return val;

  if (Array.isArray(val.docs)) {
    return {
      __type: 'QuerySnapshot',
      docs: val.docs.map((doc: any) => ({
        id: doc.id,
        exists: typeof doc.exists === 'boolean' ? doc.exists : true,
        data: serializeValue(typeof doc.data === 'function' ? doc.data() : (doc.data || null)),
      })),
    };
  }

  if (typeof val.exists === 'boolean' && typeof val.data === 'function' && 'id' in val) {
    return {
      __type: 'DocumentSnapshot',
      id: val.id,
      exists: val.exists,
      data: serializeValue(val.exists ? val.data() : null),
    };
  }

  return serializeValue(val);
}

function deserializeValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  
  if (val.__type === 'Timestamp') {
    return {
      seconds: val.seconds,
      nanoseconds: val.nanoseconds,
      toDate: () => new Date(val.seconds * 1000 + val.nanoseconds / 1000000),
      toString: () => new Date(val.seconds * 1000 + val.nanoseconds / 1000000).toString(),
    };
  }
  
  if (val.__type === 'Date') {
    return new Date(val.value);
  }
  
  if (Array.isArray(val)) {
    return val.map(deserializeValue);
  }
  
  const res: any = {};
  for (const key of Object.keys(val)) {
    res[key] = deserializeValue(val[key]);
  }
  return res;
}

function deserializeSnapshot(val: any): any {
  if (!val || typeof val !== 'object') return val;

  if (val.__type === 'QuerySnapshot') {
    const docs = (val.docs || []).map((doc: any) => ({
      id: doc.id,
      exists: doc.exists,
      data: () => deserializeValue(doc.data),
      get: (field: string) => deserializeValue(doc.data?.[field]),
    }));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach(callback: any) {
        docs.forEach(callback);
      },
    };
  }

  if (val.__type === 'DocumentSnapshot') {
    return {
      id: val.id,
      exists: val.exists,
      data: () => deserializeValue(val.data),
      get: (field: string) => deserializeValue(val.data?.[field]),
    };
  }

  return deserializeValue(val);
}

/**
 * Cached data fetching utility for Firestore queries
 * Uses Next.js unstable_cache to cache results and revalidate after specified time
 */
export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  revalidateSeconds: number = 60
): Promise<T> {
  const cachedFn = unstable_cache(
    async () => {
      const res = await fn();
      return serializeSnapshot(res);
    },
    [key],
    { revalidate: revalidateSeconds }
  );

  const serializedResult = await cachedFn();
  return deserializeSnapshot(serializedResult) as unknown as T;
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
  
  // Filter out any empty/undefined IDs and keep only unique values
  const uniqueIds = Array.from(new Set(ids.filter(id => id && typeof id === 'string')));
  if (uniqueIds.length === 0) return new Map();
  
  // Firebase Admin SDK v11+ supports up to 30 items in 'in' queries.
  // This project uses firebase-admin@^14, so we use 30 (was 10).
  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
  }
  
  const results = new Map<string, T>();
  
  // Parallel chunk queries — previously sequential (for chunk of chunks: await query)
  const snapshots = await Promise.all(
    chunks.map(chunk =>
      adminDb.collection(collectionName)
        .where('__name__', 'in', chunk)
        .get()
    )
  );

  snapshots.forEach(snap => {
    snap.docs.forEach((doc: any) => {
      results.set(doc.id, { id: doc.id, ...doc.data() } as T);
    });
  });
  
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

/**
 * Pre-configured cache functions for frequently accessed data
 */
export async function fetchAllRoles(adminDb: any) {
  return cachedFetch(
    'all-roles',
    () => adminDb.collection("Role").get(),
    600 // 10 minutes
  ) as Promise<any>;
}

export async function fetchAllDepartments(adminDb: any) {
  return cachedFetch(
    'all-departments',
    () => adminDb.collection("Department").get(),
    600 // 10 minutes
  ) as Promise<any>;
}

export async function fetchAllKpiTemplates(adminDb: any) {
  return cachedFetch(
    'all-kpi-templates',
    () => adminDb.collection("KpiTemplate").get(),
    600 // 10 minutes
  ) as Promise<any>;
}

export async function fetchKpiTemplatesByRole(roleId: string, adminDb: any) {
  return cachedFetch(
    `kpi-templates-by-role:${roleId}`,
    () => adminDb.collection("KpiTemplate").where("roleId", "==", roleId).get(),
    600 // 10 minutes
  ) as Promise<any>;
}

export async function fetchTaskTemplates(adminDb: any) {
  return cachedFetch(
    'task-templates',
    () => adminDb.collection("TaskTemplate").orderBy("createdAt", "desc").get(),
    600 // 10 minutes
  ) as Promise<any>;
}
