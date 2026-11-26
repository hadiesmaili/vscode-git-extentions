import { memo, type ReactElement } from 'react';
import type { GraphRow } from '../../shared/protocol';

export interface Geometry {
  rowH: number;
  laneW: number;
  padX: number;
  /** Large ring nodes and thicker lines. */
  spacious?: boolean;
}

export const laneX = (g: Geometry, lane: number) => g.padX + lane * g.laneW + g.laneW / 2;

/** SVG for rows [start, end): lines plus nodes. Positioned by the caller at start * rowH. */
export const GraphCanvas = memo(function GraphCanvas({
  rows,
  start,
  end,
  g,
  width,
  selected,
}: {
  rows: GraphRow[];
  start: number;
  end: number;
  g: Geometry;
  width: number;
  selected?: string;
}) {
  const from = Math.max(0, start - 1);
  const top = from * g.rowH;
  const height = (end - from + 1) * g.rowH;
  const paths: ReactElement[] = [];
  const nodes: ReactElement[] = [];
  const k = g.rowH * 0.5;

  for (let r = from; r < end; r++) {
    const row = rows[r];
    if (!row) continue;
    const y1 = r * g.rowH + g.rowH / 2 - top;
    const y2 = y1 + g.rowH;
    for (let i = 0; i < row.edges.length; i++) {
      const e = row.edges[i];
      const x1 = laneX(g, e.from);
      const x2 = laneX(g, e.to);
      const d =
        x1 === x2
          ? `M${x1} ${y1}V${e.open ? y1 + g.rowH * 0.85 : y2}`
          : `M${x1} ${y1}C${x1} ${y1 + k} ${x2} ${y2 - k} ${x2} ${y2}`;
      paths.push(
        <path
          key={`${r}-${i}`}
          d={d}
          stroke={`var(--lane-${e.color})`}
          strokeWidth={g.spacious ? 2.6 : 2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={row.uncommitted ? '3 3' : undefined}
          opacity={e.open ? 0.55 : 1}
        />,
      );
    }
  }

  for (let r = start; r < end; r++) {
    const row = rows[r];
    if (!row) continue;
    const cx = laneX(g, row.lane);
    const cy = r * g.rowH + g.rowH / 2 - top;
    const c = `var(--lane-${row.color})`;
    const isSel = row.commit.hash === selected;
    if (g.spacious) {
      // Design style: every commit is a glowing ring; HEAD gets a halo.
      nodes.push(
        <g key={r}>
          {(row.isHead || isSel) && <circle cx={cx} cy={cy} r={13} fill={c} opacity={0.16} />}
          <circle
            cx={cx}
            cy={cy}
            r={row.isHead ? 8 : 6.5}
            fill="var(--bg)"
            stroke={c}
            strokeWidth={row.isHead ? 3.2 : 2.6}
            strokeDasharray={row.uncommitted ? '3 2.4' : undefined}
          />
          {row.isHead && <circle cx={cx} cy={cy} r={3} fill={c} />}
        </g>,
      );
      continue;
    }
    if (row.uncommitted) {
      nodes.push(
        <circle key={r} cx={cx} cy={cy} r={5} fill="var(--bg)" stroke={c} strokeWidth={1.8} strokeDasharray="2.4 2" />,
      );
    } else if (row.isHead) {
      nodes.push(
        <g key={r}>
          <circle cx={cx} cy={cy} r={9} fill={c} opacity={0.16} />
          <circle cx={cx} cy={cy} r={6} fill="var(--bg)" stroke={c} strokeWidth={2.2} />
          <circle cx={cx} cy={cy} r={2.4} fill={c} />
        </g>,
      );
    } else if (row.isMerge) {
      nodes.push(<circle key={r} cx={cx} cy={cy} r={4.5} fill="var(--bg)" stroke={c} strokeWidth={2} />);
    } else {
      nodes.push(<circle key={r} cx={cx} cy={cy} r={4.5} fill={c} stroke="var(--bg)" strokeWidth={1.5} />);
    }
    if (isSel && !row.isHead) {
      nodes.push(<circle key={`s${r}`} cx={cx} cy={cy} r={8} fill="none" stroke={c} strokeWidth={1.2} opacity={0.6} />);
    }
  }

  return (
    <svg className="graph-svg" width={width} height={height} style={{ top }} aria-hidden>
      {paths}
      {nodes}
    </svg>
  );
});
