/** Show Season Blokbuks in the app typeface, with the ₿ mark. */
export default function Blokbuks({ amount }: { amount: number }) {
  return <strong className="blokbuks"><span aria-hidden="true">₿ </span><span className="ui-sr-only">Blokbuks </span>{amount.toLocaleString('en-US')}</strong>;
}
