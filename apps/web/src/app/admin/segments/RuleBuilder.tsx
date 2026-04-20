'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export type SegmentRuleGroup = {
  operator: 'AND' | 'OR';
  rules: { dimension: string; operator: string; value: unknown }[];
  groups?: SegmentRuleGroup[];
};

type DimMeta = { dimension: string; category: string; operators: string[] };

const defaultRule = () => ({
  dimension: 'tier.level',
  operator: 'gte',
  value: 1 as unknown,
});

export function emptyGroup(): SegmentRuleGroup {
  return { operator: 'AND', rules: [defaultRule()] };
}

export function RuleBuilder({
  value,
  onChange,
  onPreview,
}: {
  value: SegmentRuleGroup;
  onChange: (g: SegmentRuleGroup) => void;
  onPreview?: (g: SegmentRuleGroup) => void;
}) {
  const [dimensions, setDimensions] = useState<DimMeta[]>([]);

  useEffect(() => {
    apiClient
      .adminGetSegmentDimensions()
      .then((r) => {
        const d = r.data as DimMeta[];
        setDimensions(Array.isArray(d) ? d : []);
      })
      .catch(() => setDimensions([]));
  }, []);

  const updateGroup = useCallback(
    (path: number[], next: SegmentRuleGroup) => {
      if (path.length === 0) {
        onChange(next);
        return;
      }
      const clone = structuredClone(value) as SegmentRuleGroup;
      let cur = clone;
      for (let i = 0; i < path.length; i++) {
        const idx = path[i];
        if (i === path.length - 1) {
          if (!cur.groups) cur.groups = [];
          cur.groups[idx] = next;
        } else {
          if (!cur.groups?.[idx]) return;
          cur = cur.groups[idx];
        }
      }
      onChange(clone);
    },
    [onChange, value],
  );

  const renderGroup = (g: SegmentRuleGroup, path: number[]) => {
    const setG = (next: SegmentRuleGroup) => {
      if (path.length === 0) onChange(next);
      else updateGroup(path, next);
    };

    return (
      <div
        className={`rounded-lg border p-3 space-y-2 ${path.length ? 'ml-4 border-dashed border-indigo-200 bg-indigo-50/40' : 'border-gray-200 bg-white'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Combine with</span>
          <select
            className="text-sm border rounded px-2 py-1"
            value={g.operator}
            onChange={(e) => setG({ ...g, operator: e.target.value as 'AND' | 'OR' })}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        {g.rules.map((rule, i) => {
          const meta = dimensions.find((d) => d.dimension === rule.dimension);
          const ops = meta?.operators?.length ? meta.operators : ['eq'];
          return (
            <div key={i} className="flex flex-wrap gap-2 items-center text-sm">
              <select
                className="border rounded px-2 py-1 min-w-[160px]"
                value={rule.dimension}
                onChange={(e) => {
                  const d = e.target.value;
                  const m = dimensions.find((x) => x.dimension === d);
                  const nextOp = m?.operators[0] ?? 'eq';
                  const nextRules = [...g.rules];
                  nextRules[i] = { dimension: d, operator: nextOp, value: '' };
                  setG({ ...g, rules: nextRules });
                }}
              >
                {dimensions.length === 0 ? (
                  <option value={rule.dimension}>{rule.dimension}</option>
                ) : (
                  Object.entries(
                    dimensions.reduce<Record<string, DimMeta[]>>((acc, d) => {
                      acc[d.category] = acc[d.category] || [];
                      acc[d.category].push(d);
                      return acc;
                    }, {}),
                  ).map(([cat, opts]) => (
                    <optgroup key={cat} label={cat}>
                      {opts.map((d) => (
                        <option key={d.dimension} value={d.dimension}>
                          {d.dimension}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
              <select
                className="border rounded px-2 py-1"
                value={rule.operator}
                onChange={(e) => {
                  const nextRules = [...g.rules];
                  nextRules[i] = { ...rule, operator: e.target.value };
                  setG({ ...g, rules: nextRules });
                }}
              >
                {ops.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <RuleValueInput
                rule={rule}
                onChange={(v) => {
                  const nextRules = [...g.rules];
                  nextRules[i] = { ...rule, value: v };
                  setG({ ...g, rules: nextRules });
                }}
              />
              <button
                type="button"
                className="text-red-600 text-xs"
                onClick={() => {
                  const nextRules = g.rules.filter((_, j) => j !== i);
                  setG({ ...g, rules: nextRules.length ? nextRules : [defaultRule()] });
                }}
              >
                Remove
              </button>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => setG({ ...g, rules: [...g.rules, defaultRule()] })}
          >
            + Add rule
          </button>
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() =>
              setG({
                ...g,
                groups: [...(g.groups ?? []), { operator: 'AND', rules: [defaultRule()] }],
              })
            }
          >
            + Add group
          </button>
        </div>
        {(g.groups ?? []).map((sub, idx) => (
          <div key={idx} className="relative">
            <button
              type="button"
              className="absolute right-0 top-0 text-xs text-gray-500"
              onClick={() => {
                const ng = [...(g.groups ?? [])];
                ng.splice(idx, 1);
                setG({ ...g, groups: ng.length ? ng : undefined });
              }}
            >
              Remove group
            </button>
            {renderGroup(sub, [...path, idx])}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!onPreview) return;
    const t = setTimeout(() => onPreview(value), 450);
    return () => clearTimeout(t);
  }, [value, onPreview]);

  return renderGroup(value, []);
}

function RuleValueInput({
  rule,
  onChange,
}: {
  rule: { dimension: string; operator: string; value: unknown };
  onChange: (v: unknown) => void;
}) {
  if (
    rule.operator === 'is_empty' ||
    rule.operator === 'is_not_empty' ||
    rule.dimension === 'events.hasAttended'
  ) {
    return (
      <select
        className="border rounded px-2 py-1 w-24"
        value={String(rule.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (rule.operator === 'in' || rule.operator === 'not_in') {
    return (
      <input
        className="border rounded px-2 py-1 flex-1 min-w-[120px]"
        placeholder='comma list e.g. GB, US'
        value={Array.isArray(rule.value) ? (rule.value as string[]).join(', ') : String(rule.value ?? '')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }
  if (rule.operator === 'between') {
    const arr = Array.isArray(rule.value) ? (rule.value as number[]) : [0, 0];
    return (
      <span className="flex gap-1 items-center">
        <input
          type="number"
          className="border rounded px-2 py-1 w-20"
          value={arr[0]}
          onChange={(e) => onChange([Number(e.target.value), arr[1]])}
        />
        <span>—</span>
        <input
          type="number"
          className="border rounded px-2 py-1 w-20"
          value={arr[1]}
          onChange={(e) => onChange([arr[0], Number(e.target.value)])}
        />
      </span>
    );
  }
  if (
    rule.dimension.startsWith('comms.') ||
    (rule.dimension === 'user.birthday' &&
      (rule.operator === 'is_empty' || rule.operator === 'is_not_empty'))
  ) {
    return (
      <select
        className="border rounded px-2 py-1"
        value={String(rule.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (rule.dimension === 'fandom.affinity') {
    const v = (rule.value as { fandom?: string; score?: number }) || {};
    return (
      <span className="flex gap-1 flex-wrap items-center">
        <input
          className="border rounded px-2 py-1 w-32"
          placeholder="Fandom key"
          value={v.fandom ?? ''}
          onChange={(e) => onChange({ ...v, fandom: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          className="border rounded px-2 py-1 w-20"
          placeholder="score"
          value={v.score ?? ''}
          onChange={(e) => onChange({ ...v, score: Number(e.target.value) })}
        />
      </span>
    );
  }
  if (
    rule.dimension.includes('Count') ||
    rule.dimension.includes('.level') ||
    rule.dimension.includes('points') ||
    rule.dimension.includes('count') ||
    rule.dimension.includes('score') ||
    rule.dimension.includes('spend') ||
    rule.dimension === 'activity.lastAt' ||
    rule.dimension === 'activity.lastLogin' ||
    rule.dimension === 'activity.enrolledAt'
  ) {
    return (
      <input
        type="number"
        className="border rounded px-2 py-1 w-28"
        value={rule.value as number}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  return (
    <input
      className="border rounded px-2 py-1 flex-1 min-w-[100px]"
      value={String(rule.value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
