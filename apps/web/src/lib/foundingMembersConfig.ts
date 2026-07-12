import { getDirectApiBaseUrl } from '@/lib/apiBaseUrl';

export async function isFoundingMembersEnabled(): Promise<boolean> {
  try {
    const apiUrl = getDirectApiBaseUrl();
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
