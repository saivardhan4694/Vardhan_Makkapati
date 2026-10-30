// Knowledge compiler: turns the site's own data modules into the single
// knowledge.json the Worker grounds every answer in. Run with plain Node
// (>= 22.18 strips TypeScript natively, no build step):
//
//   node scripts/build-knowledge.ts           # write src/knowledge.json
//   node scripts/build-knowledge.ts --check   # fail if it is out of date (CI)
//
// The site's data files are the source of truth. Nothing here is hand-written
// content: if a fact is not on the page it is not in the bot's knowledge.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PROJECTS, CATEGORIES } from "../../site/src/data/projects.ts";
import {
  OWNER_FIRST_NAME,
  OWNER_LAST_NAME,
  ROLE_TITLE,
  ROLE_TAGLINE,
  CURRENT_ROLE,
  CURRENT_COMPANY,
  TOP_SKILLS,
} from "../../site/src/data/highlights.ts";
import { mainNodes } from "../../site/src/data/graph.ts";
import {
  ABOUT_PARAGRAPHS,
  ABOUT_STATUS,
  EXPERIENCE,
  STACK_INTRO,
  STACK_CATEGORIES,
  TRAINING_INTRO,
  TRAINING_STATUS,
  TIMELINE,
  CERTIFICATIONS,
  PING_PARAGRAPHS,
  PING_STATUS,
  CHANNELS,
} from "../../site/src/data/profile.ts";
import type { Knowledge } from "../src/knowledge-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/knowledge.json");

export const SITE_URL = "https://saivardhan4694.github.io/Vardhan_Makkapati/";

// Template placeholders the owner has not filled in yet ("[YOUR_COMPANY]",
// "20XX"). They must never reach the model, or it would state them as fact.
const PLACEHOLDER = /\[YOUR_|\bYOUR_[A-Z]+\b|20XX/;
const isReal = (v: string | null | undefined): v is string => !!v && !PLACEHOLDER.test(v);

const clean = (v: string) => v.replace(/^●\s*/, "").trim();
const statusMap = (items: { label: string; value: string }[]) =>
  Object.fromEntries(items.filter((s) => isReal(s.value)).map((s) => [s.label, clean(s.value)]));

const absolute = (href: string) => (href.startsWith("./") ? SITE_URL + href.slice(2) : href);

function title(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function compileKnowledge(): Knowledge {
  const body: Omit<Knowledge, "hash"> = {
    version: 1,
    site: { url: SITE_URL, name: "PORTFOLIO_OS" },
    owner: {
      name: title(`${OWNER_FIRST_NAME} ${OWNER_LAST_NAME}`),
      role: ROLE_TITLE.replace(/_/g, " "),
      tagline: ROLE_TAGLINE,
      // Only included once the owner replaces the template placeholder.
      currentPosition: isReal(CURRENT_COMPANY) ? `${CURRENT_ROLE} @ ${CURRENT_COMPANY}` : null,
      headlineSkills: TOP_SKILLS,
      about: ABOUT_PARAGRAPHS,
      status: statusMap(ABOUT_STATUS),
    },
    sections: mainNodes.map((n) => ({ id: n.id, label: n.label, sub: n.sub })),
    experience: EXPERIENCE.filter((e) => isReal(e.org) && isReal(e.role)).map((e) => ({
      period: e.period,
      role: e.role,
      org: e.org,
      note: e.note,
      stack: e.stack,
      current: e.current,
    })),
    stack: {
      intro: STACK_INTRO,
      categories: STACK_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        items: c.items,
        usedIn: (c.evidence ?? []).map((e) => e.label),
      })),
    },
    projectCategories: CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id),
    projects: PROJECTS.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      year: p.year,
      flagship: !!p.flagship,
      blurb: p.blurb,
      stack: p.stack,
      highlights: p.highlights,
      url: p.url,
    })),
    training: {
      intro: TRAINING_INTRO,
      status: statusMap(TRAINING_STATUS),
      timeline: TIMELINE.filter((t) => isReal(t.org)),
      certifications: CERTIFICATIONS,
    },
    contact: {
      intro: PING_PARAGRAPHS,
      status: statusMap(PING_STATUS),
      channels: CHANNELS.filter((c) => c.href && isReal(c.host)).map((c) => ({
        id: c.id,
        label: c.host,
        url: absolute(c.href as string),
      })),
    },
  };
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return { ...body, hash };
}

function main() {
  const json = JSON.stringify(compileKnowledge(), null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== json) {
      console.error(
        "agent-api/src/knowledge.json is out of date with site/src/data.\n" +
          "Run `npm run knowledge` in agent-api/ and commit the result."
      );
      process.exit(1);
    }
    console.log("knowledge.json is up to date.");
    return;
  }
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT} (${(json.length / 1024).toFixed(1)} KiB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
