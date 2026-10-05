'use client';

import { useEffect, useState } from 'react';
import { fandomChallengeExpiryMs, type FandomChallenge } from '@/lib/fandomChallenge';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function FandomChallengeWidget({
  challenge,
  loadFailed,
  selectedIndex,
  onSelect,
  onRefresh,
  disabled,
}: {
  challenge: FandomChallenge | null;
  loadFailed?: boolean;
  selectedIndex: number | null;
  onSelect: (idx: number) => void;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  if (!challenge && loadFailed) {
    return (
      <div className="rounded-xl border border-amber-700/40 bg-stone-900/60 p-4">
        <p className="font-secondary text-sm text-stone-300">
          The fandom challenge could not be loaded. Registration cannot continue without it.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className="mt-3 font-secondary text-sm text-amber-400 hover:text-amber-300 disabled:opacity-40"
        >
          Retry challenge
        </button>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="rounded-xl border border-amber-700/30 bg-stone-900/60 p-4">
        <div className="flex items-center justify-between">
          <p className="font-secondary text-sm text-stone-400">Loading fandom challenge…</p>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <FandomChallengeReady
      challenge={challenge}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onRefresh={onRefresh}
      disabled={disabled}
    />
  );
}

function FandomChallengeReady({
  challenge,
  selectedIndex,
  onSelect,
  onRefresh,
  disabled,
}: {
  challenge: FandomChallenge;
  selectedIndex: number | null;
  onSelect: (idx: number) => void;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const [remainingMs, setRemainingMs] = useState(() => fandomChallengeExpiryMs(challenge) - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(fandomChallengeExpiryMs(challenge) - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [challenge]);

  return (
    <div className="rounded-xl border border-amber-600/40 bg-gradient-to-b from-amber-950/20 to-stone-950/80 p-4 shadow-[0_0_16px_rgba(217,119,6,0.08)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg" role="img" aria-label="wand">
          &#x2728;
        </span>
        <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
          Prove You&apos;re a True Fan
        </p>
        <span className="ml-auto inline-block rounded-full bg-amber-950/50 px-2 py-0.5 text-[10px] font-secondary text-amber-400/70">
          {challenge.fandom}
        </span>
      </div>

      <p className="font-secondary text-sm text-stone-200 leading-relaxed mb-3">{challenge.question}</p>

      <div className="grid grid-cols-1 gap-2">
        {challenge.options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(idx)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-secondary transition-all ${
                isSelected
                  ? 'border-amber-400 bg-amber-500/15 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                  : 'border-stone-700/50 bg-stone-900/40 text-stone-300 hover:border-amber-600/40 hover:bg-stone-900/60'
              } disabled:opacity-50`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isSelected ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                }`}
              >
                {OPTION_LABELS[idx]}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className="font-secondary text-xs text-amber-500/70 hover:text-amber-400 disabled:opacity-40"
        >
          Try a different question
        </button>
        {remainingMs <= 3 * 60_000 && (
          <p
            className={`font-secondary text-[11px] ${
              remainingMs <= 30_000 ? 'text-red-300' : 'text-amber-400/80'
            }`}
          >
            {remainingMs <= 0 ? 'Timed out — tap for a new question' : `Valid for ${formatRemaining(remainingMs)}`}
          </p>
        )}
      </div>
    </div>
  );
}
