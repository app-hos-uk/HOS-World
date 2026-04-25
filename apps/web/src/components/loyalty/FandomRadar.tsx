'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

type Props = {
  /** Normalized 0–1 scores keyed by fandom display name */
  profile: Record<string, number>;
  className?: string;
};

export function FandomRadar({ profile, className = '' }: Props) {
  const entries = Object.entries(profile)
    .map(([subject, v]) => ({
      subject: subject.length > 14 ? `${subject.slice(0, 12)}…` : subject,
      value: Math.round(Math.min(1, Math.max(0, v)) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (entries.length < 3) return null;

  return (
    <div className={`h-64 w-full max-w-md mx-auto ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={entries} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#44403c" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#a8a29e', fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#57534e', fontSize: 9 }} />
          <Radar
            name="Affinity"
            dataKey="value"
            stroke="#d97706"
            fill="#d97706"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
