/**
 * Numbers and layout for the Carrier insights report. Pure and browser-safe.
 * Code computes every rate here (docs/adr/0001); the Insights analyst only quotes them, and the
 * page shows the same figures. Only visible groups (five or more Players, docs/adr/0002) go in.
 */

export type ReportGroup = { category: string; tactic: string; outcome: string; calls: number; avgSeconds?: number | null };

export type Overview = {
  /** Calls in visible groups. */
  calls: number;
  scamCalls: number;
  fellFor: number;
  caught: number;
  realCalls: number;
  falseAlarms: number;
  trustedReal: number;
  /** Whole percentages; null when there is nothing to divide by. */
  fellForRate: number | null;
  catchRate: number | null;
  falseAlarmRate: number | null;
};

export type Breakdown = {
  key: string;
  scamCalls: number;
  fellFor: number;
  fellForRate: number | null;
  realCalls: number;
  falseAlarms: number;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);
const count = (groups: readonly ReportGroup[], outcome: string) =>
  groups.filter(group => group.outcome === outcome).reduce((sum, group) => sum + group.calls, 0);

export function overview(groups: readonly ReportGroup[]): Overview {
  const fellFor = count(groups, 'fell for');
  const caught = count(groups, 'caught');
  const falseAlarms = count(groups, 'false alarm');
  const trustedReal = count(groups, 'trusted real');
  const scamCalls = fellFor + caught;
  const realCalls = falseAlarms + trustedReal;
  return {
    calls: scamCalls + realCalls, scamCalls, fellFor, caught, realCalls, falseAlarms, trustedReal,
    fellForRate: pct(fellFor, scamCalls), catchRate: pct(caught, scamCalls), falseAlarmRate: pct(falseAlarms, realCalls),
  };
}

/** Fell-for and false-alarm figures per Category or per Tactic, highest fell-for rate first. */
export function breakdown(groups: readonly ReportGroup[], by: 'category' | 'tactic'): Breakdown[] {
  const keys = [...new Set(groups.map(group => group[by]))];
  return keys
    .map(key => {
      const mine = groups.filter(group => group[by] === key);
      const fellFor = count(mine, 'fell for');
      const scamCalls = fellFor + count(mine, 'caught');
      const falseAlarms = count(mine, 'false alarm');
      return { key, scamCalls, fellFor, fellForRate: pct(fellFor, scamCalls), realCalls: falseAlarms + count(mine, 'trusted real'), falseAlarms };
    })
    .sort((a, b) => (b.fellForRate ?? -1) - (a.fellForRate ?? -1) || b.fellFor - a.fellFor || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export type CallTime = {
  /** Average seconds on a call, weighted by calls; null when no call has a known length. */
  overall: number | null;
  byOutcome: { key: string; avgSeconds: number }[];
  byCategory: { key: string; avgSeconds: number }[];
};

const OUTCOME_ORDER = ['fell for', 'caught', 'false alarm', 'trusted real'];

/** Weighted average call length overall, by outcome (fixed order) and by Category (longest first). */
export function callTime(groups: readonly ReportGroup[]): CallTime {
  const timed = groups.filter(group => typeof group.avgSeconds === 'number' && group.avgSeconds > 0);
  const average = (rows: readonly ReportGroup[]) => {
    const calls = rows.reduce((sum, row) => sum + row.calls, 0);
    return calls ? Math.round(rows.reduce((sum, row) => sum + row.calls * (row.avgSeconds as number), 0) / calls) : null;
  };
  const by = (keyOf: (group: ReportGroup) => string) =>
    [...new Set(timed.map(keyOf))].map(key => ({ key, avgSeconds: average(timed.filter(group => keyOf(group) === key))! }));
  return {
    overall: average(timed),
    byOutcome: by(group => group.outcome).sort((a, b) => OUTCOME_ORDER.indexOf(a.key) - OUTCOME_ORDER.indexOf(b.key)),
    byCategory: by(group => group.category).sort((a, b) => b.avgSeconds - a.avgSeconds || (a.key < b.key ? -1 : 1)),
  };
}

/** 95 → "1:35". */
export function minutes(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The analysis sections, in order. The analyst writes them as plain heading lines. */
export const REPORT_HEADINGS = [
  'Overview',
  'Scams people fall for most',
  'Pressure tactics that work',
  'Real calls people doubted',
  'Time on the call',
  'What carriers can do',
] as const;

export type ReportSection = { heading: string | null; paragraphs: string[] };

const headingOf = (line: string) => {
  const bare = line.trim().replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').replace(/:$/, '').trim().toLowerCase();
  return REPORT_HEADINGS.find(heading => heading.toLowerCase() === bare) ?? null;
};

/** Split the analysis into its headed sections. Text before the first heading becomes an untitled section. */
export function reportSections(text: string): ReportSection[] {
  const sections: ReportSection[] = [];
  let current: ReportSection = { heading: null, paragraphs: [] };
  let paragraph: string[] = [];
  const flushParagraph = () => {
    const joined = paragraph.join(' ').trim();
    if (joined) current.paragraphs.push(joined);
    paragraph = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const heading = headingOf(line);
    if (heading) {
      flushParagraph();
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading, paragraphs: [] };
    } else if (!line.trim()) flushParagraph();
    else if (/^\s*[-•*]\s+/.test(line)) { flushParagraph(); paragraph.push(line.replace(/^\s*[-•*]\s+/, '')); flushParagraph(); }
    else paragraph.push(line.trim());
  }
  flushParagraph();
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}
