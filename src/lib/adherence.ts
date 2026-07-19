export type AdherenceResult = {
  plannedCount: number;
  plannedDone: number;
  plannedPending: number;
  adHocDone: number;
};

/** Compare the morning's planned task set to what actually closed today. */
export function computeAdherence(
  plannedTaskIdsJson: string | null,
  closedTodayTaskIds: string[],
): AdherenceResult | null {
  if (!plannedTaskIdsJson) return null;
  let planned: string[] = [];
  try {
    planned = JSON.parse(plannedTaskIdsJson);
  } catch {
    return null;
  }
  const plannedSet = new Set(planned);
  const closedSet = new Set(closedTodayTaskIds);

  const plannedDone = planned.filter((id) => closedSet.has(id)).length;
  const adHocDone = closedTodayTaskIds.filter((id) => !plannedSet.has(id)).length;

  return {
    plannedCount: planned.length,
    plannedDone,
    plannedPending: planned.length - plannedDone,
    adHocDone,
  };
}
