import {createHash} from 'crypto';
import type {SplitAssignment, SplitStep} from './sequence-plan';

export function assignSplitBranch(
  split: SplitStep,
  agentIndex: number,
  agentId: string,
  seed: string
): string {
  const branches = split.split.branches;
  const weights = branches.map(b => b.weight ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const assignment = split.split.assignment ?? 'agent_index_mod';

  let slot: number;
  switch (assignment) {
    case 'hash_agent_id': {
      const hash = createHash('sha256').update(agentId).digest();
      slot = hash.readUInt32BE(0) % total;
      break;
    }
    case 'random': {
      const hash = createHash('sha256')
        .update(`${seed}:${agentId}`)
        .digest();
      slot = hash.readUInt32BE(0) % total;
      break;
    }
    default:
      slot = agentIndex % total;
  }

  let cumulative = 0;
  for (let i = 0; i < branches.length; i += 1) {
    cumulative += weights[i]!;
    if (slot < cumulative) {
      return branches[i]!.id;
    }
  }
  return branches[branches.length - 1]!.id;
}
