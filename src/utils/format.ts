import type { StoredResult } from './types.js';

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function asciiChart(values: number[], width = 60, height = 10): string {
  if (values.length === 0) return '(no data)';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const lines: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  for (let i = 0; i < Math.min(values.length, width); i++) {
    const normalized = (values[i] - min) / range;
    const row = Math.floor((1 - normalized) * (height - 1));
    lines[row][i] = '█';
  }

  const chartLines = lines.map((row) => '│' + row.join('') + '│');
  const top = `┌${'─'.repeat(width)}┐`;
  const bottom = `└${'─'.repeat(width)}┘`;
  const yLabels = [
    `  max: ${max.toFixed(2)}`,
    ...Array(height - 2).fill(''),
    `  min: ${min.toFixed(2)}`,
  ];

  return [top, ...chartLines.map((l, i) => l + (yLabels[i] ?? '')), bottom].join('\n');
}

export function formatTable(
  results: StoredResult[],
  stats: { mean: number; p50: number; p95: number; p99: number; unit: string }[]
): string {
  const headers = ['Benchmark', 'Mean', 'p50', 'p95', 'p99', 'Unit'];
  const rows = stats.map((s, i) => [
    results[i]?.benchmark_name ?? '',
    s.mean.toFixed(2),
    s.p50.toFixed(2),
    s.p95.toFixed(2),
    s.p99.toFixed(2),
    s.unit,
  ]);

  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const sep = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|');
  const dataRows = rows.map((r) => r.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join('|'));

  return [sep, headerRow, sep, ...dataRows, sep].join('\n');
}

export function generateSvgChart(name: string, values: number[]): string {
  const w = 800;
  const h = 300;
  const padL = 60;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  if (values.length < 2) return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="10" y="20">No data</text></svg>`;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const points = values.map((v, i) => {
    const x = padL + (i / (values.length - 1)) * chartW;
    const y = padT + (1 - (v - minV) / range) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <title>${name} Performance Over Time</title>
  <style>body{font-family:sans-serif}</style>
  <rect width="${w}" height="${h}" fill="#f8f9fa" rx="8"/>
  <text x="${w / 2}" y="${padT - 10}" text-anchor="middle" font-size="14" font-weight="bold">${name}</text>
  <text x="${padL - 5}" y="${padT}" text-anchor="end" font-size="11">${maxV.toFixed(1)}</text>
  <text x="${padL - 5}" y="${padT + chartH}" text-anchor="end" font-size="11">${minV.toFixed(1)}</text>
  <polyline fill="none" stroke="#4f46e5" stroke-width="2"
    points="${points.join(' ')}"/>
  ${values.map((_, i) => {
    const x = padL + (i / (values.length - 1)) * chartW;
    return `<line x1="${x.toFixed(1)}" y1="${padT + chartH}" x2="${x.toFixed(1)}" y2="${padT + chartH + 4}" stroke="#666" stroke-width="1"/>`;
  }).join('')}
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#333" stroke-width="1"/>
  <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="#333" stroke-width="1"/>
</svg>`;
}
