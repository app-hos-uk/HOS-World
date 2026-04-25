export type JourneyStep = {
  stepIndex: number;
  type: 'SEND' | 'WAIT' | 'CONDITION' | 'SPLIT';
  channel?: string;
  templateSlug?: string;
  subject?: string;
  templateVars?: Record<string, string>;
  delayMinutes?: number;
  condition?: {
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'exists' | 'not_exists';
    value?: unknown;
  };
  skipToStep?: number;
};
