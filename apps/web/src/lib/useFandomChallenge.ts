'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  FANDOM_CHALLENGE_REFRESH_BUFFER_MS,
  fandomChallengeExpiryMs,
  shouldRefreshUnansweredChallenge,
  type FandomChallenge,
} from '@/lib/fandomChallenge';

async function fetchChallenge(): Promise<FandomChallenge> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await apiClient.getFandomChallenge();
      if (res?.data?.token && Array.isArray(res.data.options)) {
        return res.data;
      }
      lastError = new Error('empty challenge');
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load challenge');
}

export function useFandomChallenge(enabled: boolean) {
  const [challenge, setChallenge] = useState<FandomChallenge | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const requestId = useRef(0);
  const answerRef = useRef<number | null>(null);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    try {
      const next = await fetchChallenge();
      if (requestId.current !== id) return;
      setChallenge(next);
      setAnswer(null);
      setLoadFailed(false);
    } catch {
      if (requestId.current !== id) return;
      setChallenge(null);
      setAnswer(null);
      setLoadFailed(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !challenge) return;
    const expiresAt = fandomChallengeExpiryMs(challenge);
    if (!Number.isFinite(expiresAt)) return;
    const delay = Math.max(0, expiresAt - FANDOM_CHALLENGE_REFRESH_BUFFER_MS - Date.now());
    const timer = window.setTimeout(() => {
      if (shouldRefreshUnansweredChallenge(challenge, answerRef.current != null)) {
        void refresh();
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, challenge, refresh]);

  return { challenge, answer, setAnswer, loadFailed, refresh };
}
