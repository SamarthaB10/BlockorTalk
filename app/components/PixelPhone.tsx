import './pixel-phone.css';

/**
 * An original pixel-art phone: graphite outline, soft-white rim, periwinkle body, cyan screen.
 * Every caller gets the same phone, so the art never hints at who is calling.
 * k graphite · w soft white · p periwinkle · d shade · s screen
 */
const MAP = [
  '......kkkkkkkk......',
  '....kkwwwwwwwwkk....',
  '...kwwppppppppwwk...',
  '..kwppppppppppppwk..',
  '..kwppppddddppppwk..',
  '..kwppppppppppppwk..',
  '..kwpkkkkkkkkkkpwk..',
  ...Array.from({ length: 8 }, () => '..kwpksssssssskpwk..'),
  '..kwpkkkkkkkkkkpwk..',
  '..kwppppppppppppwk..',
  '..kwppppkkkkppppwk..',
  '..kwppppwwwwppppwk..',
  '..kwppppppppppppwk..',
  ...Array.from({ length: 4 }, () => ['..kwpkkppkkppkkpwk..', '..kwpwwppwwppwwpwk..']).flat(),
  '..kwppppppppppppwk..',
  '...kwppppppppppwk...',
  '....kwwwwwwwwwwk....',
  '.....kkkkkkkkkk.....',
];

type Run = { x: number; y: number; w: number; c: string };
const RUNS: Run[] = MAP.flatMap((row, y) => {
  const runs: Run[] = [];
  for (let x = 0; x < row.length;) {
    const c = row[x]!;
    let w = 1;
    while (row[x + w] === c) w += 1;
    if (c !== '.') runs.push({ x, y, w, c });
    x += w;
  }
  return runs;
});

// Screen content, in the screen's own pixels (interior x 6–13, y 7–14): spaced signal bars up top,
// a clear row, then a two-frame waveform. The tallest bar's top pixel is the signal pulse.
const BARS = [[7, 10, 1], [9, 9, 2], [11, 9, 2]] as const;
const WAVE_A = [[7, 13], [8, 12], [9, 13], [10, 12], [11, 13], [12, 12]] as const;
const WAVE_B = [[7, 12], [8, 13], [9, 12], [10, 13], [11, 12], [12, 13]] as const;

export default function PixelPhone({ label = 'Incoming call' }: { label?: string }) {
  return <svg className="pixel-phone" viewBox="0 0 20 32" width="60" height="96" shapeRendering="crispEdges" role="img" aria-label={label}>
    <g className="pp-body">
    {RUNS.map(run => <rect key={`${run.x}-${run.y}`} className={`pp-${run.c}`} x={run.x} y={run.y} width={run.w} height={1} />)}
    {BARS.map(([x, y, h]) => <rect key={`b${x}`} className="pp-ink" x={x} y={y} width={1} height={h} />)}
    <rect className="pp-ink pp-pulse" x={11} y={8} width={1} height={1} />
    <g className="pp-wave pp-wave-a">{WAVE_A.map(([x, y]) => <rect key={x} className="pp-ink" x={x} y={y} width={1} height={1} />)}</g>
    <g className="pp-wave pp-wave-b">{WAVE_B.map(([x, y]) => <rect key={x} className="pp-ink" x={x} y={y} width={1} height={1} />)}</g>
    </g>
  </svg>;
}
