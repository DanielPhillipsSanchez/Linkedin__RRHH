/**
 * Single source of truth for LinkedIn profile section discovery.
 * PARSE-05 compliance: all extraction logic references this file only.
 *
 * LinkedIn (as of March 2026) uses obfuscated CSS class names and no
 * semantic IDs. Sections are discovered by finding <section> elements
 * whose <h2> heading matches a known label. Text is extracted via
 * innerText rather than fine-grained CSS selectors.
 */

export const SECTION_HEADINGS: Record<string, string> = {
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  about: 'About',
};

export function findSectionByHeading(doc: Document, heading: string): Element | null {
  const sections = doc.querySelectorAll('section');
  for (let i = 0; i < sections.length; i++) {
    const h2 = sections[i].querySelector('h2');
    if (h2 && h2.textContent?.trim() === heading) {
      return sections[i];
    }
  }
  return null;
}
