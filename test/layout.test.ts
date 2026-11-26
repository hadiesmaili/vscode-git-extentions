import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/extension/graph/layout';
import type { Commit } from '../src/shared/protocol';

const c = (hash: string, ...parents: string[]): Commit => ({ hash, parents, author: 'a', email: '', date: 0, subject: hash });

describe('computeLayout', () => {
  it('keeps a linear history in lane 0', () => {
    const l = computeLayout([c('c', 'b'), c('b', 'a'), c('a')]);
    expect(l.rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(l.rows[0].edges).toEqual([{ from: 0, to: 0, color: 0 }]);
    expect(l.rows[2].edges).toEqual([]);
    expect(l.lanes).toBe(1);
  });

  it('branches out and merges back', () => {
    // m merges f into main; f branches from a.
    //  m
    //  | \
    //  b  f
    //  | /
    //  a
    const l = computeLayout([c('m', 'b', 'f'), c('b', 'a'), c('f', 'a'), c('a')]);
    expect(l.rows.map((r) => r.lane)).toEqual([0, 0, 1, 0]);
    // merge commit: straight line down + curve into lane 1
    expect(l.rows[0].edges).toEqual(
      expect.arrayContaining([
        { from: 0, to: 0, color: 0 },
        { from: 0, to: 1, color: 1 },
      ]),
    );
    // f converges into a (lane 1 -> lane 0)
    expect(l.rows[2].edges).toEqual(expect.arrayContaining([{ from: 1, to: 0, color: 1 }]));
    expect(l.lanes).toBe(2);
  });

  it('handles two branch tips sharing a parent', () => {
    const l = computeLayout([c('x', 'a'), c('y', 'a'), c('a')]);
    expect(l.rows.map((r) => r.lane)).toEqual([0, 1, 0]);
    // row 0: lane 0 passes down (to 0). Row 1: lane 0 passes, lane 1 converges into 0.
    expect(l.rows[1].edges).toEqual(
      expect.arrayContaining([
        { from: 0, to: 0, color: 0 },
        { from: 1, to: 0, color: 1 },
      ]),
    );
  });

  it('marks lines to unloaded parents as open', () => {
    const l = computeLayout([c('b', 'a')]);
    expect(l.rows[0].edges).toEqual([{ from: 0, to: 0, color: 0, open: true }]);
  });

  it('reuses freed lanes', () => {
    const l = computeLayout([c('m', 'b', 'f'), c('f', 'b'), c('b', 'a'), c('n', 'a', 'g'), c('g', 'a'), c('a')]);
    // f's lane 1 is freed at b, then reused by tip n (lane 0 still carries the line to a).
    expect(l.rows.map((r) => r.lane)).toEqual([0, 1, 0, 1, 2, 0]);
  });
});
