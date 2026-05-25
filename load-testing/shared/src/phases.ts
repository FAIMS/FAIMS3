export enum Phase {
  WAITING_FOR_AGENTS = 'WAITING_FOR_AGENTS',
  ONBOARDING = 'ONBOARDING',
  OFFLINE_COLLECTION = 'OFFLINE_COLLECTION',
  SYNC_STORM = 'SYNC_STORM',
  EXPORT_STRESS = 'EXPORT_STRESS',
  COMPLETE = 'COMPLETE',
}

export const PHASE_ORDER: Phase[] = [
  Phase.WAITING_FOR_AGENTS,
  Phase.ONBOARDING,
  Phase.OFFLINE_COLLECTION,
  Phase.SYNC_STORM,
  Phase.EXPORT_STRESS,
  Phase.COMPLETE,
];

const PHASE_NUMERIC: Record<Phase, number> = {
  [Phase.WAITING_FOR_AGENTS]: 0,
  [Phase.ONBOARDING]: 1,
  [Phase.OFFLINE_COLLECTION]: 2,
  [Phase.SYNC_STORM]: 3,
  [Phase.EXPORT_STRESS]: 4,
  [Phase.COMPLETE]: 5,
};

export function phaseToNumeric(phase: Phase): number {
  return PHASE_NUMERIC[phase];
}

export function nextPhase(current: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1] ?? null;
}

export type PhaseAdvanceStrategy = 'all_ready' | 'majority' | 'timeout';
