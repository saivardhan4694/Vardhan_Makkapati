// Real repositories from github.com/saivardhan4694, grouped by what they
// demonstrate rather than by language. Order inside each group is strongest
// first — the list is read top-down and the first entry is what gets seen.
//
// Empty and forked repos are deliberately left out, as are private ones,
// since every entry here links somewhere a visitor can actually read code.

export type ProjectCategory = "agents" | "mlops" | "vision" | "apps";

export interface Project {
  /** Repo name — also the path shown in the terminal. */
  id: string;
  title: string;
  category: ProjectCategory;
  /** One-line summary shown under the title. */
  blurb: string;
  stack: string[];
  highlights: string[];
  url: string;
  year: string;
  /** Marks the entry the page opens on. */
  flagship?: boolean;
}

export const CATEGORIES: { id: ProjectCategory | "all"; label: string }[] = [
  { id: "all", label: "all/" },
  { id: "agents", label: "agents/" },
  { id: "mlops", label: "mlops/" },
  { id: "vision", label: "vision/" },
  { id: "apps", label: "apps/" },
];

const GH = "https://github.com/saivardhan4694";

export const PROJECTS: Project[] = [
  // --- agents ------------------------------------------------------
  {
    id: "ai-coding-assistent",
    title: "AI CODING ASSISTANT",
    category: "agents",
    blurb:
      "An agent framework with real tool-calling: it reads and edits code, runs commands, searches the web and keeps its own memory.",
    stack: ["Python", "MCP", "Gemini", "OpenAI", "OpenRouter"],
    highlights: [
      "Model Context Protocol servers over both stdio and HTTP/SSE transports",
      "12+ built-in tools — file edit, glob, grep, shell, web fetch, memory, todo",
      "Context compression and token budgeting to survive long sessions",
      "Approval policies with dangerous-command detection before anything mutates",
      "Session persistence — save, resume and checkpoint conversations",
    ],
    url: `${GH}/ai-coding-assistent`,
    year: "2026",
    flagship: true,
  },
  {
    id: "kids_story_generator",
    title: "STORY CREW",
    category: "agents",
    blurb:
      "A multi-agent crew that writes illustrated children's stories — one crew drafts, another critiques and suggests.",
    stack: ["CrewAI", "Groq / Llama-3-70B", "HuggingFace", "Streamlit"],
    highlights: [
      "Separate story-writing and suggestion crews with their own roles and tasks",
      "Swappable LLM backends — Groq inference and hosted HuggingFace endpoints",
      "Task graph defined independently of the agents that execute it",
    ],
    url: `${GH}/kids_story_generator`,
    year: "2025",
  },
  {
    id: "chatbot",
    title: "LANGGRAPH CHAT",
    category: "agents",
    blurb:
      "A streaming chat assistant built as an explicit LangGraph state machine, running entirely against a local model.",
    stack: ["LangGraph", "LangChain", "Ollama", "Streamlit"],
    highlights: [
      "Conversation modelled as a typed graph state rather than a prompt string",
      "Checkpointed memory so threads survive across turns",
      "Runs offline on local Llama 3.2 — no API key, no data leaving the machine",
    ],
    url: `${GH}/chatbot`,
    year: "2026",
  },

  // --- mlops -------------------------------------------------------
  {
    id: "coustomer_churn_prediction_system",
    title: "CHURN PIPELINE",
    category: "mlops",
    blurb:
      "Customer churn prediction wired as a reproducible pipeline — versioned data, tracked experiments, containerised runs.",
    stack: ["DVC", "MLflow", "Docker", "Python"],
    highlights: [
      "DVC stages make the ETL and training run reproducible from a lockfile",
      "MLflow tracking for runs, params and model artifacts",
      "Config-driven so a rerun is a file change, not a code change",
    ],
    url: `${GH}/coustomer_churn_prediction_system`,
    year: "2024",
  },
  {
    id: "networksecurity",
    title: "NETWORK SECURITY ML",
    category: "mlops",
    blurb:
      "An end-to-end pipeline for network threat classification, from MongoDB ingestion through to a packaged model.",
    stack: ["Python", "MongoDB", "Docker", "scikit-learn"],
    highlights: [
      "Schema-validated ingestion — bad data fails at the boundary, not in training",
      "Artifact directory per run, so every stage's output is inspectable",
      "Packaged with setup.py and a Dockerfile for deployment",
    ],
    url: `${GH}/networksecurity`,
    year: "2024",
  },
  {
    id: "end-to-end-housing-price-prediction",
    title: "HOUSING PRICE PIPELINE",
    category: "mlops",
    blurb:
      "Price regression built as composable pipeline steps with a separate deployment path, not a single notebook.",
    stack: ["Python", "MLflow", "Pipelines", "Jupyter"],
    highlights: [
      "Training and deployment split into separate runnable entry points",
      "Steps written as reusable units rather than inline cells",
      "MLflow run history kept alongside the analysis notebooks",
    ],
    url: `${GH}/end-to-end-housing-price-prediction`,
    year: "2025",
  },
  {
    id: "stock_prediction_app.py",
    title: "STOCK FORECAST PIPELINE",
    category: "mlops",
    blurb:
      "A configuration-driven forecasting service — parameters live in YAML, the code stays the same.",
    stack: ["Python", "Docker", "YAML config"],
    highlights: [
      "params.yaml drives the run; no hard-coded hyperparameters",
      "Structured src/config/logs layout with a research folder kept separate",
      "Containerised for a consistent runtime",
    ],
    url: `${GH}/stock_prediction_app.py`,
    year: "2024",
  },
  {
    id: "Text_summarizer",
    title: "TEXT SUMMARIZER",
    category: "mlops",
    blurb:
      "An end-to-end NLP summarisation service, taking a transformer model from data prep through to a served endpoint.",
    stack: ["Python", "Transformers", "Docker"],
    highlights: [
      "Ingestion, validation, transformation, training and evaluation as discrete stages",
      "Serving layer sits on top of the same pipeline artifacts",
    ],
    url: `${GH}/Text_summarizer`,
    year: "2024",
  },
  {
    id: "wine_quality_prediction",
    title: "WINE QUALITY",
    category: "mlops",
    blurb: "A compact end-to-end data science project covering the full path from raw data to evaluated model.",
    stack: ["Python", "scikit-learn", "Jupyter"],
    highlights: [
      "Full pipeline kept small enough to read end to end",
      "Notebook analysis paired with a runnable pipeline",
    ],
    url: `${GH}/wine_quality_prediction`,
    year: "2024",
  },

  // --- vision ------------------------------------------------------
  {
    id: "FootBall-Analysis-system-using-Computer-Vision",
    title: "FOOTBALL MATCH ANALYSIS",
    category: "vision",
    blurb:
      "Automated analysis of match footage — who is on the pitch, which team has the ball, and how far everyone ran.",
    stack: ["YOLO", "OpenCV", "Python", "Tracking"],
    highlights: [
      "Detects and separates players, referees, goalkeepers and the ball",
      "Assigns teams dynamically from kit colour rather than fixed labels",
      "Estimates ball possession, player speed and distance covered",
      "Compensates for camera movement so motion is measured in pitch space",
    ],
    url: `${GH}/FootBall-Analysis-system-using-Computer-Vision`,
    year: "2024",
  },
  {
    id: "cancer-app",
    title: "MEDICAL IMAGING SUITE",
    category: "vision",
    blurb:
      "A set of cancer classifiers across four imaging modalities, each trained and evaluated on its own dataset.",
    stack: ["TensorFlow", "VGG19", "CNNs", "Jupyter"],
    highlights: [
      "Breast histopathology and ultrasound, kidney, and lung CT classifiers",
      "Transfer learning with VGG19 alongside models trained from scratch",
      "Each modality kept as its own reproducible notebook",
    ],
    url: `${GH}/cancer-app`,
    year: "2024",
  },
  {
    id: "Fashion-Generator-B-W",
    title: "FASHION GAN",
    category: "vision",
    blurb: "A generative adversarial network that synthesises black-and-white fashion imagery from noise.",
    stack: ["TensorFlow", "GANs", "Jupyter"],
    highlights: [
      "Generator and discriminator trained from scratch",
      "Ships with an example-usage notebook for sampling the trained model",
    ],
    url: `${GH}/Fashion-Generator-B-W`,
    year: "2024",
  },
  {
    id: "image_captioning",
    title: "IMAGE CAPTIONING",
    category: "vision",
    blurb: "An encoder-decoder captioning model trained on COCO — vision features in, natural language out.",
    stack: ["PyTorch", "CNN + RNN", "COCO"],
    highlights: [
      "CNN feature extractor feeding a recurrent language decoder",
      "Trained and evaluated on the COCO caption dataset",
    ],
    url: `${GH}/image_captioning`,
    year: "2024",
  },
  {
    id: "Gesture-Recognition",
    title: "GESTURE RECOGNITION",
    category: "vision",
    blurb: "A CNN that classifies hand gestures for television control from short video clips.",
    stack: ["TensorFlow", "CNN", "Jupyter"],
    highlights: [
      "Frame-sequence classification rather than single-image prediction",
      "Trained on a five-gesture control vocabulary",
    ],
    url: `${GH}/Gesture-Recognition`,
    year: "2024",
  },
  {
    id: "gesture-volume-and-mouse-control",
    title: "HAND CONTROL",
    category: "vision",
    blurb: "Real-time hand tracking that drives system volume and the mouse cursor straight from a webcam.",
    stack: ["OpenCV", "MediaPipe", "Python"],
    highlights: [
      "Landmark tracking mapped to continuous system controls",
      "Runs live on webcam input with no training step",
    ],
    url: `${GH}/gesture-volume-and-mouse-control`,
    year: "2024",
  },
  {
    id: "emotion_detection",
    title: "EMOTION DETECTION",
    category: "vision",
    blurb: "Facial emotion classification, kept as a clean data / models / notebooks split.",
    stack: ["TensorFlow", "CNN", "Jupyter"],
    highlights: ["Dataset, trained models and experiments separated rather than interleaved"],
    url: `${GH}/emotion_detection`,
    year: "2024",
  },

  // --- apps --------------------------------------------------------
  {
    id: "Recomenda",
    title: "RECOMENDA",
    category: "apps",
    blurb:
      "A book recommender built on collaborative filtering, shipped as a deployable app rather than a notebook.",
    stack: ["scikit-learn", "KNN", "Streamlit", "Docker"],
    highlights: [
      "K-nearest-neighbour collaborative filtering over a user-book matrix",
      "Modular ML pipeline structure with the app layered on top",
      "Containerised for deployment",
    ],
    url: `${GH}/Recomenda`,
    year: "2026",
  },
  {
    id: "stock_analysis_on_news_sentiment",
    title: "NEWS SENTIMENT SIGNALS",
    category: "apps",
    blurb: "Turns financial news sentiment into a tradeable signal, with training and evaluation kept separate.",
    stack: ["Python", "NLP", "scikit-learn"],
    highlights: [
      "Dedicated trainer and tester modules with stored evaluation results",
      "Sentiment scoring joined against price data for the signal",
    ],
    url: `${GH}/stock_analysis_on_news_sentiment`,
    year: "2024",
  },
];

export const PROJECT_COUNT = PROJECTS.length;
