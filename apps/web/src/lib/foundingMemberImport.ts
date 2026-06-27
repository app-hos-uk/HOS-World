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
];

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/^\ufeff/, '')
    .replace(/\s+/g, '')
    .replace(/^email.?address$/i, 'email')
    .replace(/^first.?name$/i, 'firstName')
    .replace(/^last.?name$/i, 'lastName')
    .replace(/^other.?franchises$/i, 'otherFranchises')
    .replace(/^spend.?bracket$/i, 'spendBracket')
    .replace(/^registered.?at$/i, 'registeredAt');
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

export function rowsToMembers(rows: FoundingMemberImportRow[]): ParsedFoundingMember[] {
  return rows
    .filter((row) => row.email?.trim())
    .map((row) => ({
      email: row.email.trim(),
      firstName: row.firstName?.trim() || '',
      lastName: row.lastName?.trim() || undefined,
      phone: row.phone?.trim() || undefined,
      country: row.country?.trim() || undefined,
      fandoms: parseFandoms(row.fandoms || ''),
      otherFranchises: row.otherFranchises?.trim() || undefined,
      source: row.source?.trim() || undefined,
      spendBracket: row.spendBracket?.trim() || undefined,
      registeredAt: row.registeredAt?.trim() || undefined,
    }));
}

export function parseCsv(text: string): FoundingMemberImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => normalizeHeader(h.replace(/^"|"$/g, '')));
  const rows: FoundingMemberImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
    const row: FoundingMemberImportRow = {};
    headers.forEach((header, index) => {
      row[header] = (values[index]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '').trim();
    });
    if (row.email) rows.push(row);
  }

  return rows;
}

export function parseExcelBuffer(buffer: ArrayBuffer): FoundingMemberImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
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
  const example = TEMPLATE_ROWS[0];
  const row = FOUNDING_MEMBER_IMPORT_HEADERS.map((h) => `"${(example[h] || '').replace(/"/g, '""')}"`).join(',');
  const blob = new Blob([[header, row].join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'founding-members-import-template.csv');
}

export function downloadExcelTemplate() {
  const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
    header: [...FOUNDING_MEMBER_IMPORT_HEADERS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Founding Members');
  XLSX.writeFile(workbook, 'founding-members-import-template.xlsx');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
