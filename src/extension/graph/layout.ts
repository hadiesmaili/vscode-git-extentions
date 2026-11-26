// Lane layout for the commit graph. Pure and VS Code independent.
import type { Commit, Edge } from '../../shared/protocol';

export const LANE_COLORS = 8;

export interface LayoutRow {
  lane: number;
  color: number;
  edges: Edge[];
}

export interface Layout {
  rows: LayoutRow[];
  lanes: number;
}

interface Slot {
  hash: string;
  color: number;
}

interface Pending {
  /** Lane at the current row where the line starts. */
  from: number;
  /** Commit the line leads to. */
  hash: string;
  color: number;
  /** Lane the line runs into when it does not end at the next commit. */
  via: number;
}

/**
 * Assigns each commit (children before parents) a lane.
 * Edges are emitted per row: a line from row r (lane `from`) to row r+1 (lane `to`).
 * Lanes keep their index while they pass through, so straight lines stay straight.
 */
export function computeLayout(commits: Commit[]): Layout {
  const slots: (Slot | null)[] = [];
  const rows: LayoutRow[] = [];
  let colorSeq = 0;
  let maxLanes = 0;
  let pending: Pending[] = [];

  const freeSlot = (): number => {
    const i = slots.indexOf(null);
    if (i >= 0) return i;
    slots.push(null);
    return slots.length - 1;
  };

  for (let r = 0; r < commits.length; r++) {
    const c = commits[r];

    let lane = slots.findIndex((s) => s?.hash === c.hash);
    let color: number;
    if (lane < 0) {
      lane = freeSlot();
      color = colorSeq++ % LANE_COLORS;
    } else {
      color = slots[lane]!.color;
    }

    // Resolve the previous row's lines now that this commit's lane is known.
    if (r > 0) {
      const prev = rows[r - 1];
      for (const p of pending) {
        prev.edges.push({ from: p.from, to: p.hash === c.hash ? lane : p.via, color: p.color });
      }
    }

    // Other lanes waiting for this commit merge into it and are freed.
    for (let i = 0; i < slots.length; i++) {
      if (i !== lane && slots[i]?.hash === c.hash) slots[i] = null;
    }

    slots[lane] = c.parents.length > 0 ? { hash: c.parents[0], color } : null;

    const branchOut: Pending[] = [];
    for (let k = 1; k < c.parents.length; k++) {
      const ph = c.parents[k];
      let pl = slots.findIndex((s) => s?.hash === ph);
      if (pl < 0) {
        pl = freeSlot();
        slots[pl] = { hash: ph, color: colorSeq++ % LANE_COLORS };
        // A new lane: the line starts at the node and bends into lane pl.
        branchOut.push({ from: lane, hash: ph, color: slots[pl]!.color, via: pl });
      } else {
        // Parent already expected in another lane: bend into that lane.
        branchOut.push({ from: lane, hash: ph, color: slots[pl]!.color, via: pl });
      }
    }

    rows.push({ lane, color, edges: [] });

    pending = [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      // New lanes created by branch-out begin at the node, not above it.
      if (i !== lane && branchOut.some((b) => b.via === i) && !wasOccupied(i, r, rows, commits)) continue;
      pending.push({ from: i, hash: s.hash, color: s.color, via: i });
    }
    pending.push(...branchOut);

    while (slots.length && slots[slots.length - 1] === null) slots.pop();
    maxLanes = Math.max(maxLanes, lane + 1, slots.length);
  }

  // Lines continuing past the last loaded commit.
  if (rows.length) {
    const last = rows[rows.length - 1];
    for (const p of pending) last.edges.push({ from: p.from, to: p.via, color: p.color, open: true });
  }

  return { rows, lanes: Math.max(1, maxLanes) };
}

/** True if lane i already carried a line into row r (so it passes through the row). */
function wasOccupied(i: number, r: number, rows: { edges: Edge[] }[], _c: Commit[]): boolean {
  if (r === 0) return false;
  return rows[r - 1].edges.some((e) => e.to === i);
}
