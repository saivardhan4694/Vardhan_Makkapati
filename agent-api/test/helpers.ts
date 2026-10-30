import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Knowledge } from "../src/knowledge-types.ts";
import type { ModelEvent } from "../src/gemini.ts";

export const knowledge: Knowledge = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../src/knowledge.json"), "utf8")
);

export async function* scripted(events: ModelEvent[], failAfter?: number): AsyncGenerator<ModelEvent> {
  let i = 0;
  for (const e of events) {
    if (failAfter !== undefined && i === failAfter) throw new Error("boom");
    i++;
    yield e;
  }
  if (failAfter !== undefined && failAfter >= events.length) throw new Error("boom");
}
