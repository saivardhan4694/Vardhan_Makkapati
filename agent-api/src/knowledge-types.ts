// Shape of src/knowledge.json, produced by scripts/build-knowledge.ts.

export interface KnowledgeProject {
  id: string;
  title: string;
  category: string;
  year: string;
  flagship: boolean;
  blurb: string;
  stack: string[];
  highlights: string[];
  url: string;
}

export interface Knowledge {
  version: number;
  hash: string;
  site: { url: string; name: string };
  owner: {
    name: string;
    role: string;
    tagline: string;
    currentPosition: string | null;
    headlineSkills: string[];
    about: string[];
    status: Record<string, string>;
  };
  sections: { id: string; label: string; sub: string }[];
  experience: {
    period: string;
    role: string;
    org: string;
    note: string;
    stack: string[];
    current: boolean;
  }[];
  stack: {
    intro: string;
    categories: { id: string; label: string; items: string[]; usedIn: string[] }[];
  };
  projectCategories: string[];
  projects: KnowledgeProject[];
  training: {
    intro: string;
    status: Record<string, string>;
    timeline: { year: string; stage: string; title: string; org: string; place: string; score: string }[];
    certifications: { name: string; issuer: string }[];
  };
  contact: {
    intro: string[];
    status: Record<string, string>;
    channels: { id: string; label: string; url: string }[];
  };
}
