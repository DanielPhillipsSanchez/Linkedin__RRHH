import type { CandidateRecord } from '../storage/schema';
import type { Lang } from '../i18n';
import { T } from '../i18n';
import { getTierLabels } from '../scorer/tiers';

// Maximum number of red-flag question slots across all candidates in a batch
const MAX_RED_FLAGS = 5;

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

function buildHeaders(redFlagCount: number, lang: Lang): string[] {
  const t = T[lang];
  const headers = [
    t.csvName,
    t.csvPhone,
    t.csvTitle,
    t.csvLinkedIn,
    t.csvLevel,
    t.csvScore,
    t.csvMatched,
    t.csvMissing,
    t.csvEvalDate,
    t.csvContactAfter,
    t.csvMessageSent,
  ];

  for (let i = 1; i <= redFlagCount; i++) {
    headers.push(t.csvVerifyQ(i));
    headers.push(t.csvExpectedA(i));
  }

  return headers;
}

export function candidatesToCsv(candidates: CandidateRecord[], lang: Lang = 'es'): string {
  const tierLabels = getTierLabels(lang);

  // Determine max red flags across all candidates to size the columns
  const maxFlags = Math.min(
    MAX_RED_FLAGS,
    candidates.reduce((max, c) => Math.max(max, c.redFlags?.length ?? 0), 0),
  );

  const headers = buildHeaders(maxFlags, lang);
  const rows: string[] = [headers.map(escapeCsvField).join(',')];

  for (const c of candidates) {
    const row = [
      c.name,
      c.phoneNumber ?? '',
      c.linkedinHeadline,
      c.profileUrl,
      tierLabels[c.tier] ?? c.tier,
      String(c.score),
      c.matchedSkills.join('; '),
      c.missingSkills.join('; '),
      formatDate(c.evaluatedAt),
      c.tier === 'low' ? formatDate(c.contactAfter) : '',
      c.messageSentText ?? '',
    ];

    // Fill red-flag columns — pad with empty strings if this candidate has fewer
    for (let i = 0; i < maxFlags; i++) {
      const rf = c.redFlags?.[i];
      row.push(rf ? rf.question : '');
      row.push(rf ? rf.expectedAnswer : '');
    }

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
