import * as XLSX from 'xlsx';

export const FOUNDING_MEMBER_IMPORT_HEADERS = [
  'email',
  'firstName',
  'lastName',
  'phone',
  'country',
  'fandoms',
  'otherFranchises',
  'source',
  'spendBracket',
  'registeredAt',
] as const;

export type FoundingMemberImportHeader = (typeof FOUNDING_MEMBER_IMPORT_HEADERS)[number];

export type FoundingMemberImportRow = Record<string, string>;

export interface ParsedFoundingMember {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  country?: string;
  fandoms: string[];
  otherFranchises?: string;
  source?: string;
  spendBracket?: string;
  registeredAt?: string;
}

/** Column guide shown in admin UI and embedded in Excel "Instructions" sheet. */
export const FOUNDING_MEMBER_COLUMN_GUIDE: Array<{
  key: FoundingMemberImportHeader | 'name';
  required: boolean;
  description: string;
  example: string;
  aliases?: string;
}> = [
  {
    key: 'email',
    required: true,
    description: 'Unique email address',
    example: 'jane@example.com',
    aliases: 'Email Address, E-mail',
  },
  {
    key: 'firstName',
    required: true,
    description: 'Given name (or use Name for full name)',
    example: 'Jane',
    aliases: 'First Name, Given Name',
  },
  {
    key: 'lastName',
    required: false,
    description: 'Family name',
    example: 'Doe',
    aliases: 'Last Name, Surname',
  },
  {
    key: 'name',
    required: false,
    description: 'Full name — split into first/last if firstName is empty',
    example: 'Jane Doe',
    aliases: 'Full Name',
  },
  {
    key: 'phone',
    required: false,
    description: 'Phone with country code preferred',
    example: '+1234567890',
    aliases: 'Mobile, Telephone',
  },
  {
    key: 'country',
    required: false,
    description: 'Country code or name',
    example: 'US',
    aliases: 'Country Code',
  },
  {
    key: 'fandoms',
    required: false,
    description: 'Pipe | or comma separated list',
    example: 'Harry Potter|Marvel',
    aliases: 'Fandom, Interests',
  },
  {
    key: 'otherFranchises',
    required: false,
    description: 'Free-text other franchises',
    example: 'Star Wars',
    aliases: 'Other Franchises',
  },
  {
    key: 'source',
    required: false,
    description: 'Where the signup came from',
    example: 'external_form',
    aliases: 'Source, Channel',
  },
  {
    key: 'spendBracket',
    required: false,
    description: 'Expected spend range',
    example: '$100-$500',
    aliases: 'Spend Bracket, Budget',
  },
  {
    key: 'registeredAt',
    required: false,
    description: 'Original signup date (ISO 8601)',
    example: '2026-01-15T10:00:00.000Z',
    aliases: 'Registered At, Signup Date',
  },
];

const TEMPLATE_ROWS: FoundingMemberImportRow[] = [
  {
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+1234567890',
    country: 'US',
    fandoms: 'Harry Potter|Marvel',
    otherFranchises: '',
    source: 'external_form',
    spendBracket: '$100-$500',
    registeredAt: '2026-01-15T10:00:00.000Z',
  },
  {
    email: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Rivera',
    phone: '+447700900123',
    country: 'GB',
    fandoms: 'Lord of the Rings, Disney',
    otherFranchises: 'Studio Ghibli',
    source: 'event_signup',
    spendBracket: '$50-$100',
    registeredAt: '2026-02-01',
  },
  {
    email: 'sam.patel@example.com',
    firstName: 'Sam',
    lastName: 'Patel',
    phone: '',
    country: 'IN',
    fandoms: 'Anime',
    otherFranchises: '',
    source: 'partner_list',
    spendBracket: '',
    registeredAt: '',
  },
];

function normalizeHeader(header: string): string {
  const cleaned = header
    .trim()
    .replace(/^\ufeff/, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();

  const aliases: Record<string, string> = {
    email: 'email',
    emailaddress: 'email',
    mail: 'email',
    firstname: 'firstName',
    givenname: 'firstName',
    lastname: 'lastName',
    surname: 'lastName',
    familyname: 'lastName',
    name: 'name',
    fullname: 'name',
    phone: 'phone',
    phonenumber: 'phone',
    mobile: 'phone',
    telephone: 'phone',
    country: 'country',
    countrycode: 'country',
    fandoms: 'fandoms',
    fandom: 'fandoms',
    interests: 'fandoms',
    otherfranchises: 'otherFranchises',
    otherfranchise: 'otherFranchises',
    source: 'source',
    channel: 'source',
    spendbracket: 'spendBracket',
    budget: 'spendBracket',
    registeredat: 'registeredAt',
    signupdate: 'registeredAt',
    registrationdate: 'registeredAt',
  };

  return aliases[cleaned] || header.trim().replace(/^\ufeff/, '');
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseFandoms(value: string): string[] {
  if (!value) return [];
  const separator = value.includes('|') ? '|' : ',';
  return value
    .split(separator)
    .map((f) => f.trim())
    .filter(Boolean);
}

function splitFullName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '' };
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeRegisteredAt(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return raw;
}

export function rowsToMembers(rows: FoundingMemberImportRow[]): ParsedFoundingMember[] {
  return rows
    .filter((row) => row.email?.trim())
    .map((row) => {
      let firstName = row.firstName?.trim() || '';
      let lastName = row.lastName?.trim() || undefined;
      if (!firstName && row.name?.trim()) {
        const split = splitFullName(row.name);
        firstName = split.firstName;
        lastName = lastName || split.lastName;
      }
      if (!firstName) {
        // Fallback so required firstName validation can still succeed for sparse exports
        firstName = row.email.trim().split('@')[0] || 'Member';
      }

      return {
        email: row.email.trim(),
        firstName,
        lastName,
        phone: row.phone?.trim() || undefined,
        country: row.country?.trim() || undefined,
        fandoms: parseFandoms(row.fandoms || ''),
        otherFranchises: row.otherFranchises?.trim() || undefined,
        source: row.source?.trim() || undefined,
        spendBracket: row.spendBracket?.trim() || undefined,
        registeredAt: normalizeRegisteredAt(row.registeredAt),
      };
    });
}

/** Simple CSV parser that respects quoted commas. */
function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

export function parseCsv(text: string): FoundingMemberImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));
  const rows: FoundingMemberImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]).map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const row: FoundingMemberImportRow = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    if (row.email) rows.push(row);
  }

  return rows;
}

function sheetHasEmailHeader(sheet: XLSX.WorkSheet): boolean {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  return headerRow.some((cell) => normalizeHeader(String(cell ?? '')) === 'email');
}

function pickFoundingMembersSheet(workbook: XLSX.WorkBook): string | undefined {
  const all = workbook.SheetNames;
  if (!all.length) return undefined;

  // Deprioritize pure instruction tabs, but keep them if they are the only option
  // with an email header (e.g. a sheet named "Import Instructions").
  const nonInstruction = all.filter((n) => !/^instructions?$/i.test(n.trim()));
  const searchOrder = nonInstruction.length ? nonInstruction : all;

  const withEmail = searchOrder.filter((name) => sheetHasEmailHeader(workbook.Sheets[name]));
  if (withEmail.length) {
    const exact = withEmail.find((n) => n.trim().toLowerCase() === 'founding members');
    if (exact) return exact;
    const foundingWithEmail = withEmail.find((n) => /founding/i.test(n));
    return foundingWithEmail || withEmail[0];
  }

  return (
    searchOrder.find((n) => n.trim().toLowerCase() === 'founding members') ||
    searchOrder.find((n) => /founding/i.test(n)) ||
    searchOrder[0]
  );
}

export function parseExcelBuffer(buffer: ArrayBuffer): FoundingMemberImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = pickFoundingMembersSheet(workbook);
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rawRows.length) return [];

  return rawRows
    .map((raw) => {
      const row: FoundingMemberImportRow = {};
      for (const [key, value] of Object.entries(raw)) {
        row[normalizeHeader(key)] = cellToString(value);
      }
      return row;
    })
    .filter((row) => row.email?.trim());
}

export async function parseImportFile(file: File): Promise<FoundingMemberImportRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseExcelBuffer(buffer);
  }
  const text = await file.text();
  return parseCsv(text);
}

export function downloadCsvTemplate() {
  const header = FOUNDING_MEMBER_IMPORT_HEADERS.join(',');
  const body = TEMPLATE_ROWS.map((example) =>
    FOUNDING_MEMBER_IMPORT_HEADERS.map((h) => `"${(example[h] || '').replace(/"/g, '""')}"`).join(','),
  ).join('\n');
  const blob = new Blob([[header, body].join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'founding-members-import-sample.csv');
}

export function downloadExcelTemplate() {
  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
    header: [...FOUNDING_MEMBER_IMPORT_HEADERS],
  });
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Founding Members');

  const instructions = [
    ['House of Spells — Founding Members import'],
    [''],
    ['1. Fill the "Founding Members" sheet (do not rename columns).'],
    ['2. email and firstName are required (or provide Name / Full Name).'],
    ['3. fandoms: use | or , between values (e.g. Harry Potter|Marvel).'],
    ['4. registeredAt: ISO date or YYYY-MM-DD.'],
    ['5. Duplicate emails are skipped when "Skip duplicates" is enabled.'],
    [''],
    ['Column', 'Required', 'Example', 'Accepted aliases'],
    ...FOUNDING_MEMBER_COLUMN_GUIDE.map((col) => [
      col.key,
      col.required ? 'Yes' : 'No',
      col.example,
      col.aliases || '',
    ]),
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  XLSX.writeFile(workbook, 'founding-members-import-sample.xlsx');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
