import { TICKER_ITEMS } from '../lib/constants';

type Props = {
  reverse?: boolean;
};

export function Ticker({ reverse }: Props) {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker">
      <div className={`ticker-track${reverse ? ' rev' : ''}`}>
        {items.map((t, i) => (
          <span key={`${t}-${i}`} className="t-item">
            {t}
            <span className="t-gem">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
