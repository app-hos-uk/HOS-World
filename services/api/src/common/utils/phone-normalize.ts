/**
 * Lightweight E.164 normalisation for GB / US / AE / AU / CA.
 * Prefer libphonenumber-js when added as a dependency; until then this covers
 * the markets HOS operates in without pulling a large locale dataset.
 *
 * Safety rule: never invent an E.164 number for an unrecognized country or a
 * national number without a known country hint — return null instead.
 */

const DIAL_CODES: Record<string, string> = {
  GB: '44',
  US: '1',
  CA: '1',
  AE: '971',
  AU: '61',
};

/** Map free-form / ISO-3 / common spellings → ISO-2 used in DIAL_CODES. */
const COUNTRY_ALIASES: Record<string, keyof typeof DIAL_CODES> = {
  GB: 'GB',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  ENGLAND: 'GB',
  US: 'US',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  CA: 'CA',
  CAN: 'CA',
  CANADA: 'CA',
  AE: 'AE',
  UAE: 'AE',
  ARE: 'AE',
  'UNITED ARAB EMIRATES': 'AE',
  AU: 'AU',
  AUS: 'AU',
  AUSTRALIA: 'AU',
};

function isValidE164Digits(nsn: string): boolean {
  return /^[1-9]\d{7,14}$/.test(nsn);
}

function resolveCountryHint(countryHint?: string | null): keyof typeof DIAL_CODES | null {
  if (!countryHint || typeof countryHint !== 'string') return null;
  const key = countryHint.trim().toUpperCase();
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? null;
}

/** Strip national trunk `0` wrongly kept after a known country code (e.g. +4407700… → +447700…). */
function stripTrunkZeroAfterCountryCode(nsn: string): string {
  const codes = [...new Set(Object.values(DIAL_CODES))].sort((a, b) => b.length - a.length);
  for (const cc of codes) {
    if (nsn.startsWith(`${cc}0`) && nsn.length > cc.length + 1) {
      return `${cc}${nsn.slice(cc.length + 1)}`;
    }
  }
  return nsn;
}

/**
 * Normalise a phone string to E.164 (`+` + country code + national number).
 * Returns null when the input cannot be confidently normalised.
 *
 * @param phone Raw phone input
 * @param countryHint ISO / free-form country used only when the number has no `+` / `00` prefix.
 *   Required for national-format numbers — there is no default country.
 */
export function normalizePhoneToE164(
  phone: string,
  countryHint?: string | null,
): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  let working = trimmed.replace(/[^\d+]/g, '');
  if (!working) return null;

  if (working.startsWith('00')) {
    working = `+${working.slice(2)}`;
  }

  if (working.startsWith('+')) {
    let nsn = working.slice(1).replace(/\D/g, '');
    nsn = stripTrunkZeroAfterCountryCode(nsn);
    if (!isValidE164Digits(nsn)) return null;
    return `+${nsn}`;
  }

  const local = working.replace(/\D/g, '');
  if (!local) return null;

  const iso2 = resolveCountryHint(countryHint);
  if (!iso2) {
    // Do not guess a country and do not treat national digits as already-international.
    return null;
  }

  const cc = DIAL_CODES[iso2];

  if (cc === '1') {
    if (local.length === 11 && local.startsWith('1') && isValidE164Digits(local)) {
      return `+${local}`;
    }
    if (local.length !== 10) return null;
    const nsn = `1${local}`;
    return isValidE164Digits(nsn) ? `+${nsn}` : null;
  }

  let national = local;
  if (national.startsWith('0')) {
    national = national.slice(1);
  }
  const nsn = `${cc}${national}`;
  if (!isValidE164Digits(nsn)) return null;
  return `+${nsn}`;
}
