// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseProfile } from '../src/parser/parser';

function makeDoc(bodyHtml: string, title = ''): Document {
  return new DOMParser().parseFromString(
    `<html><head><title>${title}</title></head><body>${bodyHtml}</body></html>`,
    'text/html',
  );
}

function skillsSection(skills: string[]): string {
  const items = skills.map(s => `<div>${s}</div>`).join('\n');
  return `<section><h2>Skills</h2>\n${items}</section>`;
}

function experienceSection(entries: Array<{ title: string; company: string; duration: string }>): string {
  const items = entries.map(e =>
    `<div>${e.title}</div>\n<div>${e.company} · Full-time</div>\n<div>${e.duration}</div>`
  ).join('\n');
  return `<section><h2>Experience</h2>\n${items}</section>`;
}

function educationSection(entries: Array<{ institution: string; degree: string; duration: string }>): string {
  const items = entries.map(e =>
    `<div>${e.institution}</div>\n<div>${e.degree}</div>\n<div>${e.duration}</div>`
  ).join('\n');
  return `<section><h2>Education</h2>\n${items}</section>`;
}

function aboutSection(text: string): string {
  return `<section><h2>About</h2>\n<div>${text}</div></section>`;
}

function headlineSection(name: string, headline: string): string {
  return `<section><h1>${name}</h1>\n<div>${headline}</div></section>`;
}

describe('name extraction', () => {
  it('extracts name from page title', () => {
    const doc = makeDoc('', 'Jane Smith | LinkedIn');
    const { profile } = parseProfile(doc);
    expect(profile.name).toBe('Jane Smith');
  });

  it('returns empty string when title is a generic LinkedIn page', () => {
    const doc = makeDoc('', 'LinkedIn');
    const { profile } = parseProfile(doc);
    expect(profile.name).toBe('');
  });

  it('returns empty string when title is empty', () => {
    const doc = makeDoc('', '');
    const { profile } = parseProfile(doc);
    expect(profile.name).toBe('');
  });
});

describe('headline extraction', () => {
  it('extracts headline from line after h1 name', () => {
    const doc = makeDoc(
      headlineSection('Jane Smith', 'Senior Engineer'),
      'Jane Smith | LinkedIn',
    );
    const { profile } = parseProfile(doc);
    expect(profile.headline).toBe('Senior Engineer');
  });

  it('returns empty string when no h1 is present', () => {
    const doc = makeDoc('<p>No headline</p>');
    const { profile } = parseProfile(doc);
    expect(profile.headline).toBe('');
  });
});

describe('about extraction', () => {
  it('extracts about text from About section', () => {
    const doc = makeDoc(aboutSection('Experienced engineer with focus on data.'));
    const { profile } = parseProfile(doc);
    expect(profile.about).toContain('Experienced engineer');
  });

  it('filters out the heading text and Show more', () => {
    const doc = makeDoc(
      `<section><h2>About</h2>\n<div>Great engineer.</div>\n<div>Show more</div></section>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.about).not.toContain('About');
    expect(profile.about).not.toContain('Show more');
    expect(profile.about).toContain('Great engineer');
  });

  it('returns empty string when about section is absent', () => {
    const doc = makeDoc('<p>No about section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.about).toBe('');
  });
});

describe('skills extraction', () => {
  it('extracts skills from skill anchor elements', () => {
    const doc = makeDoc(
      `<a href="/detail/skills/TypeScript">TypeScript</a>
       <a href="/detail/skills/React">React</a>
       <a href="/detail/skills/Python">Python (Programming Language)</a>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.skills).toContain('TypeScript');
    expect(profile.skills).toContain('React');
    expect(profile.skills).toContain('Python');
  });

  it('parses comma-separated skills from a single anchor', () => {
    const doc = makeDoc(
      `<a href="/detail/skills/multi">Python (Programming Language), Django and +4 skills</a>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.skills).toContain('Python');
    expect(profile.skills).toContain('Django');
  });

  it('deduplicates skill names across anchors', () => {
    const doc = makeDoc(
      `<a href="/detail/skills/py1">Python (Programming Language)</a>
       <a href="/detail/skills/py2">Python (Programming Language) and Data Engineering</a>`,
    );
    const { profile } = parseProfile(doc);
    const pyCount = profile.skills.filter(s => s === 'Python').length;
    expect(pyCount).toBe(1);
  });

  it('falls back to h2 section text when no skill anchors exist', () => {
    const doc = makeDoc(skillsSection(['TypeScript', 'React', 'Python']));
    const { profile } = parseProfile(doc);
    expect(profile.skills).toContain('TypeScript');
    expect(profile.skills).toContain('React');
    expect(profile.skills).toContain('Python');
  });

  it('returns empty array when no skills are found anywhere', () => {
    const doc = makeDoc('<p>No skills section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.skills).toEqual([]);
  });

  it('strips parenthetical qualifiers from skill names', () => {
    const doc = makeDoc(
      `<a href="/detail/skills/ml">Machine Learning (ML)</a>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.skills).toContain('Machine Learning');
    expect(profile.skills).not.toContain('Machine Learning (ML)');
  });
});

describe('experience extraction', () => {
  it('extracts title, company, and duration from experience section', () => {
    const doc = makeDoc(
      `<section><h2>Experience</h2>
        <div>Data Engineer</div>
        <div>evolv Consulting \u00b7 Full-time</div>
        <div>Oct 2025 - Present \u00b7 6 mos</div>
        <div>Bogota, Colombia</div>
      </section>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
    expect(profile.experience[0].title).toBe('Data Engineer');
    expect(profile.experience[0].company).toBe('evolv Consulting');
    expect(profile.experience[0].duration).toContain('6 mos');
  });

  it('returns empty array when experience section is absent', () => {
    const doc = makeDoc('<p>No experience section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.experience).toEqual([]);
  });

  it('extracts multiple experience entries', () => {
    const doc = makeDoc(
      `<section><h2>Experience</h2>
        <div>Senior Engineer</div>
        <div>BigCo \u00b7 Full-time</div>
        <div>Jan 2023 - Present \u00b7 3 yrs</div>
        <div>New York</div>
        <div>Junior Engineer</div>
        <div>SmallCo \u00b7 Contract</div>
        <div>Jan 2020 - Dec 2022 \u00b7 3 yrs</div>
        <div>Remote</div>
      </section>`,
    );
    const { profile } = parseProfile(doc);
    expect(profile.experience.length).toBeGreaterThanOrEqual(2);
  });
});

describe('education extraction', () => {
  it('extracts institution, degree, and duration from education section', () => {
    const doc = makeDoc(
      educationSection([
        { institution: 'MIT', degree: 'BSc Computer Science', duration: '2016 - 2020' },
      ]),
    );
    const { profile } = parseProfile(doc);
    expect(profile.education).toHaveLength(1);
    expect(profile.education[0].institution).toBe('MIT');
    expect(profile.education[0].degree).toBe('BSc Computer Science');
  });

  it('returns empty array when education section is absent', () => {
    const doc = makeDoc('<p>No education section</p>');
    const { profile } = parseProfile(doc);
    expect(profile.education).toEqual([]);
  });
});

describe('ExtractionHealth', () => {
  it('health.ok is true when name is present', () => {
    const doc = makeDoc(
      headlineSection('Jane Smith', 'Senior Engineer') +
      aboutSection('About text'),
      'Jane Smith | LinkedIn',
    );
    const { health } = parseProfile(doc);
    expect(health.ok).toBe(true);
  });

  it('health.ok is false when name is missing', () => {
    const doc = makeDoc('<p>Empty profile page</p>');
    const { health } = parseProfile(doc);
    expect(health.ok).toBe(false);
    expect(health.missing).toContain('name');
  });

  it('reports missing headline and about', () => {
    const doc = makeDoc('<p>Nothing here</p>', 'Jane Smith | LinkedIn');
    const { health } = parseProfile(doc);
    expect(health.ok).toBe(true);
    expect(health.missing).toContain('headline');
    expect(health.missing).toContain('about');
  });
});
