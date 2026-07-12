import type { Universe } from '../lib/universes';
import { UniverseTile } from './UniverseTile';

type Props = {
  universes: Universe[];
};

export function UniverseGrid({ universes }: Props) {
  return (
    <div className="uni-grid" id="uniGrid">
      {universes.map((u, idx) => (
        <UniverseTile key={u.n} u={u} idx={idx} />
      ))}
    </div>
  );
}
