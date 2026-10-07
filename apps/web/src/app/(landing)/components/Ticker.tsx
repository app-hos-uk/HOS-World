import { marketContent } from '../lib/marketContent';

type Props = {
  reverse?: boolean;
};

export function Ticker({ reverse }: Props) {
  const items = [...marketContent.tickerItems, ...marketContent.tickerItems];
  return (
    <div className="ticker">
      <div className={`ticker-track${reverse ? ' rev' : ''}`}>
        {items.map((t, i) => (
          <span key={`${t}-${i}`} className="t-item">
            {t}
            <span className="t-sep" aria-hidden="true">
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
