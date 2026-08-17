/**
 * Lightweight server-side performance timing utility.
 * Only logs when PERF_LOGGING=true is set in the environment.
 *
 * Usage:
 *   import { time } from "@/lib/perf";
 *   const result = await time("dashboard.tasks", () => db.collection("Task").get());
 */

const ENABLED = process.env.PERF_LOGGING === "true";

export async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!ENABLED) return fn();
  const start = performance.now();
  try {
    const result = await fn();
    const ms = (performance.now() - start).toFixed(1);
    console.log(`[perf] ${label}: ${ms}ms`);
    return result;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.error(`[perf] ${label}: FAILED after ${ms}ms`, err);
    throw err;
  }
}

/** Synchronous variant for non-async operations. */
export function timeSync<T>(label: string, fn: () => T): T {
  if (!ENABLED) return fn();
  const start = performance.now();
  const result = fn();
  const ms = (performance.now() - start).toFixed(1);
  console.log(`[perf] ${label}: ${ms}ms`);
  return result;
}
