export interface ExperienceEntry {
  title: string;
  company: string;
  duration: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  duration: string;
}

export interface CandidateProfile {
  name: string;
  headline: string;
  about: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  profileUrl: string;
}

export interface ExtractionHealth {
  ok: boolean;
  missing: Array<keyof Omit<CandidateProfile, 'profileUrl'>>;
}
