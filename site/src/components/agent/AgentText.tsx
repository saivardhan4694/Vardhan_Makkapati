// Renders model output safely: everything is a React text node (no HTML is
// ever interpreted). Only two things become interactive — citation markers
// that resolve against the site's own data, and URLs on an explicit
// allowlist of the owner's profiles.

import { Fragment, type ReactNode } from "react";
import { CHANNELS } from "../../data/profile";
import { followCitation, resolveCitation } from "./actions";

const LINK_PREFIXES = [
  "https://github.com/saivardhan4694",
  ...CHANNELS.map((c) => c.href).filter((h): h is string => !!h && h.startsWith("https://")),
];

// [→ BUILDS/chatbot]  [-> STACK]  [→ PING]
const TOKEN = /\[\s*(?:→|->)\s*([A-Za-z_]+)(?:\/([A-Za-z0-9_.-]+))?\s*\]|https:\/\/[^\s)\]]+/g;

function isAllowedUrl(u: string) {
  return LINK_PREFIXES.some((p) => u === p || u.startsWith(p.endsWith("/") ? p : p + "/") || u.startsWith(p + "?"));
}

export default function AgentText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(<Fragment key={k++}>{text.slice(last, start)}</Fragment>);
    if (m[1]) {
      const c = resolveCitation(m[1], m[2]);
      out.push(
        c ? (
          <button
            key={k++}
            type="button"
            className="agent-cite"
            onClick={() => followCitation(c)}
            aria-label={`Go to ${c.label}${c.projectId ? ` / ${c.projectId}` : ""}`}
          >
            [→ {c.label}
            {c.projectId ? `/${c.projectId}` : ""}]
          </button>
        ) : (
          // Unknown target: shown as plain text, never as a control.
          <Fragment key={k++}>{m[0]}</Fragment>
        )
      );
    } else {
      const url = m[0].replace(/[.,;:!?]+$/, "");
      const trail = m[0].slice(url.length);
      out.push(
        isAllowedUrl(url) ? (
          <a key={k++} className="agent-link" href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        ) : (
          <Fragment key={k++}>{url}</Fragment>
        )
      );
      if (trail) out.push(<Fragment key={k++}>{trail}</Fragment>);
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
