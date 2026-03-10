import type { CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth } from './types';
import { SECTION_HEADINGS, findSectionByHeading } from './selectors';

function getElementText(el: Element): string {
  return (el as HTMLElement).innerText || el.textContent || '';
}

function parseNameFromTitle(doc: Document): string {
  const title = doc.title ?? '';
  const parts = title.split('|');
  const candidate = parts[0].trim();
  if (!candidate || candidate.toLowerCase().includes('linkedin')) return '';
  return candidate;
}

function extractHeadline(doc: Document): string {
  const h1 = doc.querySelector('h1');
  if (!h1) return '';
  const container = h1.closest('section') || h1.parentElement?.parentElement;
  if (!container) return '';
  const text = getElementText(container);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameIndex = lines.findIndex(l => l === h1.textContent?.trim());
  if (nameIndex >= 0 && nameIndex + 1 < lines.length) {
    return lines[nameIndex + 1];
  }
  return lines[1] ?? '';
}

function extractAbout(doc: Document): string {
  const section = findSectionByHeading(doc, SECTION_HEADINGS.about);
  if (!section) return '';
  const text = getElementText(section);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.filter(l => l !== SECTION_HEADINGS.about && l !== 'Show more' && l !== 'Show less').join(' ');
}

function cleanSkillName(raw: string): string {
  return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function extractSkills(doc: Document): string[] {
  const skills: string[] = [];

  const anchors = doc.querySelectorAll('a[href*="skill"]');
  for (let i = 0; i < anchors.length; i++) {
    const text = anchors[i].textContent?.trim() ?? '';
    if (!text) continue;
    const parts = text.split(',').map(p => p.trim());
    for (const part of parts) {
      let name = part.replace(/and \+\d+ skills?$/i, '').trim();
      if (!name || name.length < 2) continue;
      name = cleanSkillName(name);
      if (name && !skills.includes(name)) {
        skills.push(name);
      }
    }
  }

  if (skills.length === 0) {
    const section = findSectionByHeading(doc, SECTION_HEADINGS.skills);
    if (section) {
      const text = getElementText(section);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const skipPatterns = [
        SECTION_HEADINGS.skills,
        'Show all',
        'Passed LinkedIn Skill Assessment',
        'Endorsements',
        'endorsement',
      ];
      for (const line of lines) {
        if (skipPatterns.some(p => line.includes(p))) continue;
        if (line.match(/^\d+$/)) continue;
        if (line.length < 2 || line.length > 80) continue;
        if (line.includes(' at ') || line.includes(' · ')) continue;
        const name = cleanSkillName(line);
        if (name && !skills.includes(name)) {
          skills.push(name);
        }
      }
    }
  }

  return skills;
}

function extractExperience(doc: Document): ExperienceEntry[] {
  const section = findSectionByHeading(doc, SECTION_HEADINGS.experience);
  if (!section) return [];
  const text = getElementText(section);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const entries: ExperienceEntry[] = [];
  let i = 0;
  const filtered = lines.filter(l =>
    l !== SECTION_HEADINGS.experience && l !== 'Show all' && !l.startsWith('Show all ')
  );

  while (i < filtered.length) {
    const line = filtered[i];
    if (line.includes(' · ') && i > 0) {
      const companyLine = line;
      const parts = companyLine.split(' · ');
      const company = parts[0].trim();
      const title = filtered[i - 1];

      let duration = '';
      for (let j = i + 1; j < Math.min(i + 4, filtered.length); j++) {
        if (filtered[j].match(/\d+ (yr|mo|mos|year|years|month|months)/i)) {
          duration = filtered[j];
          break;
        }
      }

      if (title && title !== SECTION_HEADINGS.experience) {
        entries.push({ title, company, duration });
      }
    }
    i++;
  }
  return entries;
}

function extractEducation(doc: Document): EducationEntry[] {
  const section = findSectionByHeading(doc, SECTION_HEADINGS.education);
  if (!section) return [];
  const text = getElementText(section);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const entries: EducationEntry[] = [];
  const filtered = lines.filter(l =>
    l !== SECTION_HEADINGS.education && l !== 'Show all' && !l.startsWith('Show all ')
  );

  let i = 0;
  while (i < filtered.length) {
    const line = filtered[i];
    if (i + 1 < filtered.length) {
      const next = filtered[i + 1];
      if (!line.includes(' · ') && !line.match(/^\d{4}/) && line.length > 2) {
        let degree = '';
        let duration = '';
        if (next && !next.match(/^\d{4}/) && !next.includes(' · ')) {
          degree = next;
          i++;
        }
        if (i + 1 < filtered.length && filtered[i + 1]?.match(/\d{4}/)) {
          duration = filtered[i + 1];
          i++;
        }
        entries.push({ institution: line, degree, duration });
      }
    }
    i++;
  }
  return entries;
}

function computeHealth(profile: CandidateProfile): ExtractionHealth {
  const missing: Array<keyof Omit<CandidateProfile, 'profileUrl'>> = [];
  if (!profile.name) missing.push('name');
  if (!profile.headline) missing.push('headline');
  if (!profile.about) missing.push('about');
  return {
    ok: !missing.includes('name'),
    missing,
  };
}

export function parseProfile(
  doc: Document,
  profileUrl: string = '',
): { profile: CandidateProfile; health: ExtractionHealth } {
  const name = parseNameFromTitle(doc);
  const headline = extractHeadline(doc);
  const about = extractAbout(doc);
  const skills = extractSkills(doc);
  const experience = extractExperience(doc);
  const education = extractEducation(doc);

  const profile: CandidateProfile = {
    name,
    headline,
    about,
    skills,
    experience,
    education,
    profileUrl,
  };

  const health = computeHealth(profile);
  return { profile, health };
}
