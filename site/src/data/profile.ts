// Profile content shared by the section components AND the portfolio agent's
// knowledge compiler (agent-api/scripts/build-knowledge.ts). Anything a
// visitor can read on the page lives here once, so the chatbot can never
// describe a different person than the site does.
//
// Keep this file dependency-free (no imports): the knowledge compiler loads
// it directly with Node's built-in TypeScript type stripping.

export interface StatusItem {
  label: string;
  value: string;
  accent?: boolean;
}

// --- PROFILE (About) --------------------------------------------------

export const ABOUT_PARAGRAPHS = [
  "I'm an agentic AI developer. I build systems that reason about a goal, pick the right tools, act, and check their own work — not demos that stop at a model call.",
  "What keeps me here is the engineering around the model: the loop, the memory, the evaluation. That's where an idea turns into something that actually runs.",
];

export const ABOUT_STATUS: StatusItem[] = [
  { label: "ROLE", value: "AGENTIC AI DEVELOPER" },
  { label: "DOMAIN", value: "AI / ML SYSTEMS" },
  { label: "DEGREE", value: "B.TECH" },
  { label: "AVAILABILITY", value: "● OPEN_TO_WORK", accent: true },
];

export interface ExperienceEntry {
  period: string;
  role: string;
  org: string;
  note: string;
  stack: string[];
  current: boolean;
}

export const EXPERIENCE: ExperienceEntry[] = [
  {
    period: "OCT 2024 — JAN 2025",
    role: "GenAI Engineer Intern",
    org: "Main Flow Services and Technologies",
    note: "Built and deployed an AWS-hosted autonomous LLM interview platform — resume/JD matching, a two-stage LLM screening pipeline, and rubric-driven candidate evaluation.",
    stack: ["AWS", "LangChain", "HuggingFace", "EC2 / Lambda"],
    current: false,
  },
  {
    period: "MAR 2026 — NOW",
    role: "AI Engineer",
    org: "Ideyalabs",
    note: "Building and shipping AI systems as an AI engineer.",
    stack: [],
    current: true,
  },
];

// --- STACK (Skills) ---------------------------------------------------

export interface StackEvidence {
  label: string;
  node: string;
}

export interface StackCategory {
  id: string;
  label: string;
  /** Short directory-style name for the filter bar, e.g. "frameworks/". */
  dir: string;
  items: string[];
  /** Real, textually-backed usage — not every category has one. */
  evidence?: StackEvidence[];
}

export const STACK_INTRO =
  "Everything below is something I've actually built with — an agent framework, a production interview platform, or a project on BUILDS. Not a checklist of frameworks I've only read about.";

// Every entry here is lifted straight from the technical-skills section of
// the resume — nothing added, nothing dropped. `evidence` only appears where
// an experience bullet or a BUILDS repo names that exact tool; everything
// else is listed without a claim attached to it.
export const STACK_CATEGORIES: StackCategory[] = [
  {
    id: "languages",
    label: "LANGUAGES",
    dir: "languages/",
    items: ["Python", "SQL", "Bash"],
  },
  {
    id: "frameworks",
    label: "AI / ML FRAMEWORKS",
    dir: "frameworks/",
    items: ["TensorFlow", "PyTorch", "LangChain", "LangGraph", "LlamaIndex", "HF Transformers"],
    evidence: [
      { label: "Main Flow internship", node: "about" },
      { label: "BUILDS", node: "projects" },
    ],
  },
  {
    id: "models",
    label: "MODELS & FINE-TUNING",
    dir: "models/",
    items: [
      "LLaMA 2 / 3",
      "Mistral",
      "Falcon",
      "GPT-4 / 4o",
      "Gemini Pro",
      "LoRA / QLoRA",
      "RLHF (PPO, DPO)",
    ],
  },
  {
    id: "data",
    label: "DATA & VECTOR STORES",
    dir: "data/",
    items: ["ChromaDB", "Pinecone", "Weaviate", "Qdrant", "PostgreSQL", "MongoDB", "MySQL", "DataStax Cassandra"],
  },
  {
    id: "cloud",
    label: "CLOUD & SERVING",
    dir: "cloud/",
    items: [
      "AWS Bedrock",
      "AWS SageMaker",
      "AWS (EC2, Lambda, API Gateway, S3)",
      "Docker",
      "Kubernetes",
      "FastAPI",
      "Flask",
      "Streamlit",
      "Gradio",
    ],
    evidence: [{ label: "Main Flow internship", node: "about" }],
  },
  {
    id: "multimodal",
    label: "MULTIMODAL & CORE",
    dir: "multimodal/",
    items: ["Diffusers", "DALL·E", "CLIP", "BLIP-2", "Whisper", "Prompt Engineering", "RAG", "NLP"],
  },
];

// --- TRAINING (Education) ---------------------------------------------

export const TRAINING_INTRO =
  "The degree is the formal record. Most of what I actually use day to day — LangChain, agent frameworks, RAG, fine-tuning — came from deliberately training on it after: courses, labs, and building with it until it held up.";

export const TRAINING_STATUS: StatusItem[] = [
  { label: "DEGREE", value: "B.TECH — AI & ML" },
  { label: "GRADUATING", value: "2025" },
  { label: "FOCUS", value: "GENERATIVE AI / AGENTS" },
  { label: "CERTS_LOGGED", value: "13", accent: true },
];

export interface TimelineEntry {
  year: string;
  stage: string;
  title: string;
  org: string;
  place: string;
  score: string;
}

export const TIMELINE: TimelineEntry[] = [
  {
    year: "2025",
    stage: "B.TECH",
    title: "Artificial Intelligence & Machine Learning",
    org: "M.S. Ramaiah University of Applied Sciences",
    place: "Bengaluru",
    score: "2021 — 2025",
  },
  {
    year: "2021",
    stage: "INTERMEDIATE",
    title: "MPC — Maths, Physics, Chemistry",
    org: "Sri Chaitanya Junior College, iCON Campus",
    place: "Lakshmipuram, Guntur",
    score: "92% · BIE Andhra Pradesh",
  },
  {
    year: "2019",
    stage: "SECONDARY",
    title: "10th Grade",
    org: "Dr. KKR Gowtham High School",
    place: "Guntur",
    score: "9.8 / 10 CGPA · AP State Board",
  },
];

export const CERTIFICATIONS: { name: string; issuer: string }[] = [
  { name: "Introduction to Generative AI", issuer: "Google Cloud" },
  { name: "Large Language Models & Transformers", issuer: "Google Cloud" },
  { name: "AI Fluency Course", issuer: "Anthropic" },
  { name: "AI Fundamentals & Prompt Writing", issuer: "IBM SkillsBuild" },
  { name: "Career Essentials in Generative AI", issuer: "Microsoft / LinkedIn" },
  { name: "Generative AI Studio", issuer: "Simplilearn" },
  { name: "Generative AI for Beginners", issuer: "Great Learning" },
  { name: "LangChain Basics for Beginners", issuer: "Great Learning" },
  { name: "Retrieval-Augmented Generation (RAG)", issuer: "Great Learning" },
  { name: "Artificial Intelligence A-Z 2024", issuer: "Udemy — Hadelin de Ponteves" },
  { name: "Machine Learning A-Z 2024", issuer: "Udemy — Hadelin de Ponteves" },
  { name: "Python for Data Science & ML", issuer: "Udemy — Jose Portilla" },
  { name: "100 Days of Code", issuer: "Udemy — Angela Yu" },
];

// --- PING (Contact) ---------------------------------------------------

export const PING_PARAGRAPHS = [
  "Open to agentic AI and ML engineering roles — building the systems around the model, not just calling one. If that's what you're hiring for, the channels below all reach me.",
  "Pick whichever one you'd actually use.",
];

export const PING_STATUS: StatusItem[] = [
  { label: "STATUS", value: "● ONLINE", accent: true },
  { label: "AVAILABILITY", value: "OPEN_TO_WORK", accent: true },
  { label: "LOOKING_FOR", value: "AGENTIC AI / ML ROLES" },
  { label: "RESPONSE_TIME", value: "< 24H" },
];

export interface Channel {
  id: string;
  host: string;
  href: string | null;
  verb: string;
  latency: string;
}

// `href: null` renders the row as a placeholder — visible, in-theme, but not
// a live link — the same convention the other pages use for unfilled details
// like the unfilled resume link. Only entries with a real destination are clickable.
export const CHANNELS: Channel[] = [
  {
    id: "EMAIL",
    host: "makkapatimrk@gmail.com",
    href: "mailto:makkapatimrk@gmail.com",
    verb: "SEND",
    latency: "0.2ms",
  },
  {
    id: "GITHUB",
    host: "github.com/saivardhan4694",
    href: "https://github.com/saivardhan4694",
    verb: "OPEN",
    latency: "0.4ms",
  },
  {
    id: "LINKEDIN",
    host: "linkedin.com/in/makkapatisaivardhan",
    href: "https://www.linkedin.com/in/makkapatisaivardhan/",
    verb: "OPEN",
    latency: "0.6ms",
  },
  // Served straight from site/public/ — Vite exposes that directory at the
  // site root, so this path needs no build step of its own.
  { id: "RESUME", host: "resume.pdf", href: "./resume.pdf", verb: "GET", latency: "0.8ms" },
];
