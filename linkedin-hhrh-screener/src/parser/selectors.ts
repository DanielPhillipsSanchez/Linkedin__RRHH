/**
 * Single source of truth for LinkedIn profile section discovery.
 * PARSE-05 compliance: all extraction logic references this file only.
 *
 * LinkedIn (as of March 2026) uses obfuscated CSS class names and no
 * semantic IDs. Sections are discovered by finding <section> elements
 * whose <h2> heading matches a known label. Text is extracted via
 * innerText rather than fine-grained CSS selectors.
 */

// Each key maps to possible headings in supported languages (English, Spanish)
export const SECTION_HEADINGS: Record<string, string[]> = {
  skills:     ['Skills', 'Aptitudes', 'Habilidades'],
  experience: ['Experience', 'Experiencia'],
  education:  ['Education', 'Educación'],
  about:      ['About', 'Acerca de', 'Sobre mí', 'Sobre'],
};

export function findSectionByHeading(doc: Document, headings: string | string[]): Element | null {
  const candidates = Array.isArray(headings) ? headings : [headings];
  const sections = doc.querySelectorAll('section');
  for (let i = 0; i < sections.length; i++) {
    const h2 = sections[i].querySelector('h2');
    const text = h2?.textContent?.trim() ?? '';
    if (candidates.includes(text)) {
      return sections[i];
    }
  }
  return null;
}
