'use client';

import { useEffect, useState } from 'react';
import Blokbuks from './Blokbuks';

/** The signed-in player's Blokbuks balance. Renders nothing for signed-out visitors. */
export default function BalanceBadge({ className = '' }: { className?: string }) {
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const player = await fetch('/api/players', { signal: controller.signal, cache: 'no-store' });
        if (!player.ok || !(await player.json() as { player: unknown }).player) return;
        const season = await fetch('/api/season', { signal: controller.signal, cache: 'no-store' });
        if (!season.ok) return;
        const { ownRank } = await season.json() as { ownRank: { blokbuks: number } | null };
        if (!controller.signal.aborted) setAmount(ownRank?.blokbuks ?? 0);
      } catch { /* leave the badge hidden */ }
    }
    void load();
    const interval = setInterval(load, 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);
  if (amount === null) return null;
  return <div className={`balance-badge ${className}`.trim()} role="status" aria-label="Your balance"><span className="balance-badge-label">Your balance</span><Blokbuks amount={amount} /></div>;
}
