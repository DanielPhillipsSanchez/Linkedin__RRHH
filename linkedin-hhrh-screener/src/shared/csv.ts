import type { CandidateRecord } from '../storage/schema';
import { TIER_LABELS } from '../scorer/tiers';

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  return iso.substring(0, 10);
}

const HEADERS = [
  'Name',
  'Title',
  'LinkedIn URL',
  'Tier',
  'Match Score (%)',
  'Matched Skills',
  'Missing Skills',
  'Evaluation Date',
  'Contact After',
  'Outreach Message Sent',
];

export function candidatesToCsv(candidates: CandidateRecord[]): string {
  const rows: string[] = [HEADERS.map(escapeCsvField).join(',')];

  for (const c of candidates) {
    const row = [
      c.name,
      c.linkedinHeadline,
      c.profileUrl,
      TIER_LABELS[c.tier] ?? c.tier,
      String(c.score),
      c.matchedSkills.join('; '),
      c.missingSkills.join('; '),
      formatDate(c.evaluatedAt),
      c.tier === 'L3' ? formatDate(c.contactAfter) : '',
      c.messageSentText ?? '',
    ];
    rows.push(row.map(escapeCsvField).join(','));
  }

  return rows.join('\n');
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
