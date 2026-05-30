import { UNIVERSES } from '../lib/universes';
import { UniverseTile } from './UniverseTile';

export function UniverseGrid() {
  return (
    <div className="uni-grid" id="uniGrid">
      {UNIVERSES.map((u, idx) => (
        <UniverseTile key={u.n} u={u} idx={idx} />
      ))}
    </div>
  );
}
