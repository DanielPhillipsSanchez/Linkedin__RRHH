import type { CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth } from './types';
import { SELECTORS } from './selectors';

// ---------------------------------------------------------------------------
// Private extraction helpers
// ---------------------------------------------------------------------------

function extractSkills(doc: Document): string[] {
  const items = doc.querySelectorAll(SELECTORS.skillItem);
  const skills: string[] = [];
  items.forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text) {
      skills.push(text);
    }
  });
  return skills;
}

function extractExperience(doc: Document): ExperienceEntry[] {
  const section = doc.querySelector(SELECTORS.experienceSection);
  if (!section) return [];

  const entries: ExperienceEntry[] = [];
  const items = section.querySelectorAll(SELECTORS.experienceItem);
  items.forEach((item) => {
    const title = item.querySelector(SELECTORS.experienceTitle)?.textContent?.trim() ?? '';
    const company = item.querySelector(SELECTORS.experienceCompany)?.textContent?.trim() ?? '';
    const duration = item.querySelector(SELECTORS.experienceDuration)?.textContent?.trim() ?? '';
    entries.push({ title, company, duration });
  });
  return entries;
}

function extractEducation(doc: Document): EducationEntry[] {
  const section = doc.querySelector(SELECTORS.educationSection);
  if (!section) return [];

  const entries: EducationEntry[] = [];
  const items = section.querySelectorAll(SELECTORS.educationItem);
  items.forEach((item) => {
    const institution = item.querySelector(SELECTORS.educationSchool)?.textContent?.trim() ?? '';
    const degree = item.querySelector(SELECTORS.educationDegree)?.textContent?.trim() ?? '';
    const duration = item.querySelector(SELECTORS.educationDuration)?.textContent?.trim() ?? '';
    entries.push({ institution, degree, duration });
  });
  return entries;
}

function computeHealth(
  profile: CandidateProfile,
): ExtractionHealth {
  const missing: Array<keyof Omit<CandidateProfile, 'profileUrl'>> = [];

  if (!profile.name) missing.push('name');
  if (!profile.headline) missing.push('headline');
  if (!profile.about) missing.push('about');
  // skills, experience, and education empty arrays are valid states — not flagged as missing

  return {
    ok: !missing.includes('name') && !missing.includes('headline'),
    missing,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a CandidateProfile from a LinkedIn profile Document.
 *
 * @param doc        - The Document to parse (injected for testability)
 * @param profileUrl - The URL of the profile page (default '' for tests)
 * @returns { profile, health }
 */
/** Extract candidate name from page title ("Yann LeCun | LinkedIn" → "Yann LeCun") */
function parseNameFromTitle(doc: Document): string {
  const title = doc.title ?? '';
  const parts = title.split('|');
  const candidate = parts[0].trim();
  // Reject generic LinkedIn page titles
  if (!candidate || candidate.toLowerCase().includes('linkedin')) return '';
  return candidate;
}

export function parseProfile(
  doc: Document,
  profileUrl: string = '',
): { profile: CandidateProfile; health: ExtractionHealth } {
  const name = parseNameFromTitle(doc);
  const headline = doc.querySelector(SELECTORS.headline)?.textContent?.trim() ?? '';
  const about = doc.querySelector(SELECTORS.about)?.textContent?.trim() ?? '';
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
