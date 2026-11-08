import './prize.css';

/** Prize art follows the prize description, so a changed prize keeps its correct label. */
export default function PrizeVisual({ prize }: { prize: string }) {
  if (/iphone/i.test(prize)) return <img className="prize-phone" src="/prizes/iphone.png" alt="" />;
  if (/data/i.test(prize)) return <img className="prize-carrier" src="/prizes/t-mobile.png" alt="T-Mobile" />;
  if (/\$/.test(prize)) return <span className="prize-dollar" aria-hidden="true">$</span>;
  return null;
}
