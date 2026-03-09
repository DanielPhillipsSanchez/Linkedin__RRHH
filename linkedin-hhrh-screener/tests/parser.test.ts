// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// parser.ts does not exist yet — this import causes a RED failure (Wave 2 implements it)
import { parseProfile } from '../src/parser/parser';

// ----------------------------------------------------------------------------
// Fixture helpers
// ----------------------------------------------------------------------------

function makeDoc(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${bodyHtml}</body></html>`,
    'text/html',
  );
}

// ----------------------------------------------------------------------------
// name extraction
// ----------------------------------------------------------------------------

describe('name extraction', () => {
  it('extracts name from h1', () => {
    const doc = makeDoc('<h1>Jane Smith</h1>');
    const { profile } = parseProfile(doc);
    expect(profile.name).toBe('Jane Smith');
  });

  it('returns empty string when h1 is absent', () => {
    const doc = makeDoc('<p>No heading here</p>');
    const { profile } = parseProfile(doc);
    expect(profile.name).toBe('');
  });
});

// ----------------------------------------------------------------------------
// headline extraction
// ----------------------------------------------------------------------------

describe('headline extraction', () => {
  it('extracts headline from div.text-body-medium.break-words', () => {
    const doc = makeDoc(
      '<div class="text-body-medium break-words">Senior Engineer</div>',
    );
    const { profile } = parseProfile(doc);
    expect(profile.headline).toBe('Senior Engineer');
  });

  it('returns empty string when headline element is absent', () => {
    const doc = makeDoc('<p>No headline</p>');
    const { profile } = parseProfile(doc);
    expect(profile.headline).toBe('');
  });
});

// ----------------------------------------------------------------------------
// about extraction
// ----------------------------------------------------------------------------

describe('about extraction', () => {
  it('extracts about text from the profile card section', () => {
    const doc = makeDoc(
      `<section data-view-name="profile-card">
        <div class="inline-show-more-text">
          <span aria-hidden="true">About text here</span>
        </div>
      </section>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.about).toBe('About text here');
  });

  it('returns empty string when about section is absent', () => {
    const doc = makeDoc('<p>No about section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.about).toBe('');
  });
});

// ----------------------------------------------------------------------------
// skills extraction
// ----------------------------------------------------------------------------

describe('skills extraction', () => {
  it('extracts multiple skills from skill anchor elements', () => {
    const doc = makeDoc(
      `<a data-field="skill_card_skill_topic"><span aria-hidden="true">TypeScript</span></a>
       <a data-field="skill_card_skill_topic"><span aria-hidden="true">React</span></a>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.skills).toEqual(['TypeScript', 'React']);
  });

  it('returns empty array when no skill elements are present', () => {
    const doc = makeDoc('<p>No skills section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.skills).toEqual([]);
  });

  it('filters out empty skill text', () => {
    const doc = makeDoc(
      `<a data-field="skill_card_skill_topic"><span aria-hidden="true">TypeScript</span></a>
       <a data-field="skill_card_skill_topic"><span aria-hidden="true">  </span></a>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.skills).toEqual(['TypeScript']);
  });
});

// ----------------------------------------------------------------------------
// experience extraction
// ----------------------------------------------------------------------------

describe('experience extraction', () => {
  it('extracts title, company, and duration from experience section', () => {
    const doc = makeDoc(
      `<ul id="experience">
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Engineer</span></div>
          <span class="t-14 t-normal"><span aria-hidden="true">Acme Corp</span></span>
          <span class="pvs-entity__caption-wrapper" aria-hidden="true">2020 – 2023</span>
        </li>
      </ul>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.experience).toHaveLength(1);
    expect(profile.experience[0].title).toBe('Engineer');
    expect(profile.experience[0].company).toBe('Acme Corp');
    expect(profile.experience[0].duration).toBe('2020 – 2023');
  });

  it('returns empty array when experience section is absent', () => {
    const doc = makeDoc('<p>No experience section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.experience).toEqual([]);
  });

  it('extracts multiple experience entries', () => {
    const doc = makeDoc(
      `<ul id="experience">
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Senior Engineer</span></div>
          <span class="t-14 t-normal"><span aria-hidden="true">BigCo</span></span>
          <span class="pvs-entity__caption-wrapper" aria-hidden="true">2023 – Present</span>
        </li>
        <li class="artdeco-list__item">
          <div class="t-bold"><span aria-hidden="true">Junior Engineer</span></div>
          <span class="t-14 t-normal"><span aria-hidden="true">SmallCo</span></span>
          <span class="pvs-entity__caption-wrapper" aria-hidden="true">2020 – 2023</span>
        </li>
      </ul>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.experience).toHaveLength(2);
    expect(profile.experience[0].title).toBe('Senior Engineer');
    expect(profile.experience[1].title).toBe('Junior Engineer');
  });
});

// ----------------------------------------------------------------------------
// education extraction
// ----------------------------------------------------------------------------

describe('education extraction', () => {
  it('extracts institution, degree, and duration from education section', () => {
    const doc = makeDoc(
      `<ul id="education">
        <li class="artdeco-list__item">
          <span aria-hidden="true">MIT</span>
          <span class="t-14 t-normal"><span aria-hidden="true">BSc Computer Science</span></span>
          <span class="t-14 t-normal t-black--light"><span aria-hidden="true">2016 – 2020</span></span>
        </li>
      </ul>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.education).toHaveLength(1);
    expect(profile.education[0].institution).toBe('MIT');
    expect(profile.education[0].degree).toBe('BSc Computer Science');
    expect(profile.education[0].duration).toBe('2016 – 2020');
  });

  it('returns empty array when education section is absent', () => {
    const doc = makeDoc('<p>No education section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.education).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// ExtractionHealth
// ----------------------------------------------------------------------------

describe('ExtractionHealth', () => {
  it('health.ok is true when all core fields are populated', () => {
    const doc = makeDoc(
      `<h1>Jane Smith</h1>
       <div class="text-body-medium break-words">Senior Engineer</div>
       <section data-view-name="profile-card">
         <div class="inline-show-more-text">
           <span aria-hidden="true">About text</span>
         </div>
       </section>
       <a data-field="skill_card_skill_topic"><span aria-hidden="true">TypeScript</span></a>
       <ul id="experience">
         <li class="artdeco-list__item">
           <div class="t-bold"><span aria-hidden="true">Engineer</span></div>
           <span class="t-14 t-normal"><span aria-hidden="true">Acme Corp</span></span>
           <span class="pvs-entity__caption-wrapper" aria-hidden="true">2020 – 2023</span>
         </li>
       </ul>
       <ul id="education">
         <li class="artdeco-list__item">
           <span aria-hidden="true">MIT</span>
           <span class="t-14 t-normal"><span aria-hidden="true">BSc CS</span></span>
           <span class="t-14 t-normal t-black--light"><span aria-hidden="true">2016 – 2020</span></span>
         </li>
       </ul>`,
    );
    const { health } = parseProfile(doc);
    expect(health.ok).toBe(true);
    expect(health.missing).toEqual([]);
  });

  it('health.ok is false and lists missing fields when sections are absent', () => {
    const doc = makeDoc('<p>Empty profile page</p>');
    const { health } = parseProfile(doc);
    expect(health.ok).toBe(false);
    expect(health.missing).toContain('name');
    expect(health.missing).toContain('headline');
  });
});
