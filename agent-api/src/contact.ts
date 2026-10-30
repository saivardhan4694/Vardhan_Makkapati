// Contact handoff delivery via Resend (https://resend.com). Works without a
// custom domain: the default sender onboarding@resend.dev may deliver to the
// email address that owns the Resend account, which is exactly the owner.

import type { ContactArgs } from "./tools.ts";

export interface SendResult {
  ok: boolean;
  status: number;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export function buildEmail(p: ContactArgs, from: string, to: string) {
  return {
    from,
    to: [to],
    reply_to: p.email,
    subject: oneLine(`[portfolio] Message from ${p.name}`).slice(0, 140),
    // Plain text only — visitor content is never rendered as HTML.
    text:
      `New message via the portfolio agent.\n\n` +
      `Name:  ${oneLine(p.name)}\n` +
      `Email: ${p.email}\n\n` +
      `${p.message}\n\n` +
      `--\nSent after the visitor confirmed it in the chat UI. Reply directly to answer them.`,
  };
}

export async function sendViaResend(
  apiKey: string,
  p: ContactArgs,
  from: string,
  to: string
): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(buildEmail(p, from, to)),
  });
  return { ok: res.ok, status: res.status };
}
