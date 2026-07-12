function resolveApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export async function isFoundingMembersEnabled(): Promise<boolean> {
  const apiUrl = resolveApiUrl();
  if (!apiUrl) return true;

  try {
    const res = await fetch(`${apiUrl}/config/founding-members-enabled`, {
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.enabled === true;
    }
  } catch {
    // API unreachable — default to open
  }
  return true;
}
