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
    stack: ["Python", "Transformers", "Flask", "Docker"],
    highlights: [
      "Ingestion, validation, transformation, training and evaluation split into discrete pipeline stages",
      "schema.yaml and params.yaml drive validation and hyperparameters — no hard-coded config in the pipeline code",
      "Flask endpoint serves the trained model directly off the same pipeline artifacts",
      "Packaged with a Dockerfile and setup.py for a repeatable deploy",
    ],
    url: `${GH}/Text_summarizer`,
    year: "2024",
  },
  {
    id: "wine_quality_prediction",
    title: "WINE QUALITY",
    category: "mlops",
    blurb:
      "A wine-quality regression model served behind a small Flask app, with an HTML form for live predictions rather than just a notebook.",
    stack: ["Python", "scikit-learn", "Flask", "Docker"],
    highlights: [
      "Same config-driven pipeline shape as the other MLOps projects — schema.yaml, params.yaml, staged src/ pipeline",
      "Flask + Jinja templates give it an actual form to submit inputs against, not just a CLI",
      "Packaged with a Dockerfile so the trained model and the app ship together",
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
      "Trained on FashionMNIST — 60k training / 10k test grayscale images across 10 clothing classes",
      "Generator upsamples a 128-dim noise vector through transposed convolutions from 7×7 to a 28×28 image",
      "Discriminator is a convolutional binary classifier trained adversarially against it",
      "Custom TensorFlow training loop rather than a stock Keras .fit() call",
    ],
    url: `${GH}/Fashion-Generator-B-W`,
    year: "2024",
  },
  {
    id: "image_captioning",
    title: "IMAGE CAPTIONING",
    category: "vision",
    blurb: "An encoder-decoder captioning model trained on COCO — vision features in, natural language out.",
    stack: ["TensorFlow", "InceptionV3", "Transformer", "COCO"],
    highlights: [
      "InceptionV3 (ImageNet-pretrained, top layers stripped) as the CNN feature encoder",
      "Transformer encoder-decoder generates the caption from those features rather than an RNN",
      "10,000 image-caption pairs sampled from COCO, tokenized to a 15k-word vocabulary with [start]/[end] markers",
      "80/20 train-validation split with a tf.data pipeline (shuffle, batch, prefetch) feeding training",
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
      "Trained on a five-gesture TV-remote control vocabulary",
      "Kept as a single self-contained notebook — data loading through evaluation in one place",
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
      "MediaPipe Hands for landmark tracking, no training step of its own",
      "Volume scales continuously with the thumb-to-index-finger distance",
      "Index finger alone moves the cursor; raising index + middle together fires a right-click",
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
    highlights: [
      "Dataset, trained models and experiments separated into their own directories rather than interleaved",
      "CNN classifier trained directly on labelled facial-expression images",
    ],
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
      "Dedicated data_processing module turns raw news text into model-ready features",
      "Separate trainer and tester scripts, with test results written out rather than just printed",
      "Sentiment scores joined against price data to produce the actual trading signal",
    ],
    url: `${GH}/stock_analysis_on_news_sentiment`,
    year: "2024",
  },
];

export const PROJECT_COUNT = PROJECTS.length;
