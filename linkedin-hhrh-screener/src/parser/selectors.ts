/**
 * Single source of truth for all LinkedIn CSS selector strings.
 * No selector literal may appear anywhere else in src/.
 * PARSE-05 compliance: all selector changes happen here only.
 */
export const SELECTORS = {
  name: 'title', // extracted from document.title via parseNameFromTitle()
  headline: 'div.text-body-medium.break-words',
  about: 'section[data-view-name="profile-card"] div.inline-show-more-text span[aria-hidden="true"]',
  skillItem: 'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
  experienceSection: '#experience',
  experienceItem: 'li.artdeco-list__item',
  experienceTitle: 'div.t-bold span[aria-hidden="true"]',
  experienceCompany: 'span.t-14.t-normal:not(.t-black--light) > span[aria-hidden="true"]',
  experienceDuration: 'span.pvs-entity__caption-wrapper[aria-hidden="true"]',
  educationSection: '#education',
  educationItem: 'li.artdeco-list__item',
  educationSchool: 'span[aria-hidden="true"]:first-of-type',
  educationDegree: '.t-14.t-normal:not(.t-black--light) > span[aria-hidden="true"]',
  educationDuration: '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
} as const;
