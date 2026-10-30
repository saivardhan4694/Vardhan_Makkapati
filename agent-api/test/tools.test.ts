import { test } from "node:test";
import assert from "node:assert/strict";
import { validateToolCall, validateContactArgs, toolDeclarations, describeCall } from "../src/tools.ts";
import { knowledge } from "./helpers.ts";

test("only whitelisted tools pass", () => {
  for (const name of ["eval", "fetch_url", "send_email", "navigate", "", null, 42, "__proto__", "constructor"]) {
    assert.equal(validateToolCall(name, {}, knowledge).ok, false, String(name));
  }
});

test("navigate_to accepts ids and on-screen labels, rejects others", () => {
  const a = validateToolCall("navigate_to", { section: "projects" }, knowledge);
  assert.ok(a.ok && a.call.name === "navigate_to" && a.call.args.section === "projects");
  const b = validateToolCall("navigate_to", { section: "BUILDS" }, knowledge);
  assert.ok(b.ok && b.call.name === "navigate_to" && b.call.args.section === "projects");
  for (const section of ["admin", "javascript:alert(1)", "", 3, null]) {
    assert.equal(validateToolCall("navigate_to", { section }, knowledge).ok, false);
  }
  assert.equal(validateToolCall("navigate_to", { section: "ping", extra: 1 }, knowledge).ok, false);
});

test("filter_projects only accepts known categories", () => {
  for (const c of ["agents", "mlops", "vision", "apps", "all", "agents/"]) {
    assert.ok(validateToolCall("filter_projects", { category: c }, knowledge).ok, c);
  }
  for (const c of ["games", "../", "<img>", ""]) {
    assert.equal(validateToolCall("filter_projects", { category: c }, knowledge).ok, false, c);
  }
});

test("open_project ids are validated against the knowledge base", () => {
  const ok = validateToolCall("open_project", { id: "chatbot" }, knowledge);
  assert.ok(ok.ok && ok.call.name === "open_project" && ok.call.args.id === "chatbot");
  const ci = validateToolCall("open_project", { id: "RECOMENDA" }, knowledge);
  assert.ok(ci.ok && ci.call.name === "open_project" && ci.call.args.id === "Recomenda");
  for (const id of ["../../etc/passwd", "not-a-repo", "", "chatbot; rm -rf /"]) {
    assert.equal(validateToolCall("open_project", { id }, knowledge).ok, false, id);
  }
});

test("get_contact takes no args", () => {
  assert.ok(validateToolCall("get_contact", {}, knowledge).ok);
  assert.ok(validateToolCall("get_contact", undefined, knowledge).ok);
  assert.equal(validateToolCall("get_contact", { to: "x" }, knowledge).ok, false);
});

test("contact args: valid input passes and is trimmed", () => {
  const r = validateContactArgs({ name: "  Ada   Lovelace ", email: "ada@example.com", message: "Hello there, nice work!" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.args.name, "Ada Lovelace");
});

test("contact args: abuse is rejected", () => {
  const base = { name: "Ada", email: "ada@example.com", message: "Hello there, nice work!" };
  const bad = [
    { ...base, email: "not-an-email" },
    { ...base, email: "a@b" },
    { ...base, email: "x@example.com\nBcc: victim@example.com" },
    { ...base, name: "" },
    { ...base, name: "x".repeat(81) },
    { ...base, name: "Visit https://spam.example" },
    { ...base, name: "<script>" },
    { ...base, message: "hi" },
    { ...base, message: "x".repeat(1001) },
    { ...base, cc: "someone@example.com" },
    { name: "Ada", email: "ada@example.com" },
    null,
    "string",
  ];
  for (const b of bad) assert.equal(validateContactArgs(b).ok, false, JSON.stringify(b));
});

test("declarations only expose the five whitelisted tools, enums from knowledge", () => {
  const d = toolDeclarations(knowledge);
  assert.deepEqual(d.map((t) => t.name).sort(), [
    "filter_projects",
    "get_contact",
    "navigate_to",
    "open_project",
    "send_contact_message",
  ]);
  const open = d.find((t) => t.name === "open_project") as unknown as {
    parameters: { properties: { id: { enum: string[] } } };
  };
  assert.equal(open.parameters.properties.id.enum.length, knowledge.projects.length);
});

test("describeCall produces citation markers", () => {
  const r = validateToolCall("open_project", { id: "chatbot" }, knowledge);
  assert.ok(r.ok);
  if (r.ok) assert.match(describeCall(r.call, knowledge), /\[→ BUILDS\/chatbot\]/);
});
