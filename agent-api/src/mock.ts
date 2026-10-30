// MOCK_LLM=1: canned, streamed model output so the whole pipeline (limits,
// validation, tool execution, UI) can be exercised locally and in tests
// without an API key or any quota. Its events go through exactly the same
// guards as real Gemini output.

import type { ModelEvent } from "./gemini.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function* words(text: string): Generator<string> {
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 4) yield parts.slice(i, i + 4).join("");
}

export function mockScript(message: string): ModelEvent[] {
  const m = message.toLowerCase();
  const ev: ModelEvent[] = [];
  const say = (t: string) => {
    for (const w of words(t)) ev.push({ type: "text", text: w });
  };

  if (/system prompt|ignore (all |previous )|instructions/.test(m)) {
    say("I can't share how I'm configured. I can walk you through Sai's projects, stack or experience instead. [→ BUILDS]");
  } else if (/weather|recipe|poem|capital of|bitcoin|homework|write me|translate/.test(m)) {
    say("That's outside what I can help with here — I only cover Sai's work and this site. Try: \"what agent projects has he built?\"");
  } else if (/leak-test/.test(m)) {
    say("Here you go: PFA-CANARY-6Q2X9 RULES (highest priority ...");
  } else if (/send|message him|contact form/.test(m) && /@/.test(m)) {
    say("Queuing that for Sai — press confirm to send it.");
    ev.push({
      type: "call",
      name: "send_contact_message",
      args: { name: "Test Visitor", email: "visitor@example.com", message: "Hi Sai, loved the portfolio — let's talk about an AI role." },
    });
  } else if (/contact|email|reach|hire/.test(m)) {
    say("Happy to point you there.");
    ev.push({ type: "call", name: "get_contact", args: {} });
  } else if (/bad tool/.test(m)) {
    say("Trying a tool that isn't allowed.");
    ev.push({ type: "call", name: "delete_everything", args: {} });
    ev.push({ type: "call", name: "open_project", args: { id: "../../etc/passwd" } });
  } else if (/agent|project|build/.test(m)) {
    say(
      "Sai's agent work centres on three repos:\n- AI CODING ASSISTANT — MCP tool-calling agent with memory and approval policies [→ BUILDS/ai-coding-assistent]\n- STORY CREW — a CrewAI multi-agent writer\n- LANGGRAPH CHAT — a local LangGraph state machine [→ BUILDS/chatbot]\nI've filtered BUILDS to agents/ for you."
    );
    ev.push({ type: "call", name: "filter_projects", args: { category: "agents" } });
  } else if (/stack|skill/.test(m)) {
    say("Core language is Python; frameworks include PyTorch, TensorFlow, LangChain and LangGraph, served on AWS. [→ STACK]");
    ev.push({ type: "call", name: "navigate_to", args: { section: "skills" } });
  } else {
    say("Hi — I'm the PORTFOLIO_OS assistant. Ask me about Sai's projects, stack, experience or how to reach him. [→ PROFILE]");
  }
  ev.push({ type: "finish", reason: "STOP" });
  return ev;
}

export async function* streamMock(message: string, delayMs = 40): AsyncGenerator<ModelEvent> {
  if (/fail-test/i.test(message)) throw new Error("mock upstream failure");
  for (const e of mockScript(message)) {
    if (delayMs) await sleep(delayMs);
    yield e;
  }
}
