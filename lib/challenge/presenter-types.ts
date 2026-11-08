export type PresenterSnapshot = {
  callerName: string; organization: string; phase: 'call' | 'verdict' | 'between' | 'complete';
  risk: number | null; tactics: string[]; scoredTurn: number | null; currentTurn: number | null;
  status: 'waiting' | 'scoring' | 'ready' | 'uncertain' | 'unavailable' | 'rate-limited';
  firstCorrectTurn: number | null; firstCorrectSeconds: number | null;
  series: Array<{ turn: number; at: string; risk: number | null; status: 'pending' | 'scoring' | 'done' | 'unavailable' }>;
};
