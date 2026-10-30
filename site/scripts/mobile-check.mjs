// Mobile regression check: drives the built site (vite preview) at phone,
// tablet and landscape sizes and fails on layout regressions.
//
//   npm run build && npx vite preview --port 4173 &
//   npm run test:mobile                      # BASE_URL=http://127.0.0.1:4173/
//
// Chromium only (touch + mobile emulation). It is not a substitute for a
// real iOS Safari check (address bar / dynamic viewport behaviour).
//
// Per device it asserts:
//  - the linear layout is active (and the camera scene on desktop)
//  - no horizontal page overflow, and no element sticking out of the
//    viewport (except inside intentional horizontal scrollers)
//  - every visible text node renders at >= 11px
//  - every visible button/link is a >= 44x44 tap target (inline exempted)
//  - every tab jumps its section to just below the sticky bar, and the tab
//    becomes active; the bar never covers the section heading
// Screenshots go to SHOT_DIR (default ./mobile-shots).

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const SHOTS = process.env.SHOT_DIR ?? "mobile-shots";
mkdirSync(SHOTS, { recursive: true });

const MOBILE = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DEVICES = [
  { name: "android-360", viewport: { width: 360, height: 740 }, ...MOBILE },
  { name: "iphone-se-375", viewport: { width: 375, height: 667 }, ...MOBILE },
  { name: "iphone-390", viewport: { width: 390, height: 844 }, ...MOBILE },
  { name: "pixel-412", viewport: { width: 412, height: 915 }, ...MOBILE },
  { name: "tablet-768", viewport: { width: 768, height: 1024 }, ...MOBILE },
  { name: "landscape-844x390", viewport: { width: 844, height: 390 }, ...MOBILE },
];

const MIN_FONT = 11;
const MIN_TAP = 44;
const failures = [];
const fail = (dev, msg) => failures.push(`[${dev}] ${msg}`);

// Runs in the page: finds problems inside the currently visible viewport.
function inspectViewport({ MIN_FONT, MIN_TAP }) {
  const vw = innerWidth;
  const vh = innerHeight;
  const out = { overflow: [], smallText: [], smallTaps: [] };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };
  const visible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  const desc = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${(el.textContent ?? "").trim().slice(0, 30)}"`;

  for (const el of document.querySelectorAll(".m-root *")) {
    const r = el.getBoundingClientRect();
    if (!visible(r)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && cs.position !== "fixed" && !el.closest(".netviz")) {
      out.overflow.push(`${desc(el)} x=${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    // Direct text only, so a container isn't blamed for its children.
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && parseFloat(cs.fontSize) < MIN_FONT && !el.closest(".netviz")) {
      out.smallText.push(`${desc(el)} ${cs.fontSize}`);
    }
    if (el.matches("button, a[href], [role=tab]") && !inScroller(el)) {
      const inline = cs.display === "inline";
      if (!inline && (r.height < MIN_TAP - 0.5 || r.width < MIN_TAP - 0.5)) {
        out.smallTaps.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    if (el.matches(".m-tabs button, .repo-bar button, .term-bar button") && r.height < 36) {
      out.smallTaps.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)} (in strip)`);
    }
  }
  out.docOverflow = document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : 0;
  return out;
}

const uniq = (xs) => [...new Set(xs)];

const browser = await chromium.launch();
try {
  for (const dev of DEVICES) {
    const { name, ...opts } = dev;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: "networkidle" });
    try {
      await page.waitForSelector(".m-root .m-tabs", { timeout: 20000 });
    } catch {
      fail(name, "linear layout did not render");
      await ctx.close();
      continue;
    }
    if (await page.$(".scene-section")) fail(name, "camera scene rendered on a touch device");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/${name}-top.png` });

    const issues = { overflow: [], smallText: [], smallTaps: [] };
    const tabs = await page.$$eval(".m-tab", (els) => els.map((e) => e.dataset.tab));
    for (const id of tabs) {
      await page.click(`.m-tab[data-tab="${id}"]`);
      await page.waitForTimeout(1300);
      const pos = await page.evaluate((id) => {
        const bar = document.querySelector(".m-bar").getBoundingClientRect();
        const sec = document.querySelector(`[data-node="${id}"]`).getBoundingClientRect();
        const kicker = document.querySelector(`[data-node="${id}"] .panel-kicker, [data-node="${id}"] .hero-kicker`);
        const k = kicker?.getBoundingClientRect();
        const active = document.querySelector(".m-tab--active")?.dataset.tab;
        const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
        return { barBottom: bar.bottom, secTop: sec.top, kickerTop: k?.top ?? null, active, atEnd };
      }, id);
      // The last sections may not be able to scroll to the very top.
      if (!pos.atEnd && Math.abs(pos.secTop - pos.barBottom) > 6) {
        fail(name, `tab ${id}: section top ${Math.round(pos.secTop)} not at bar bottom ${Math.round(pos.barBottom)}`);
      }
      if (pos.secTop < pos.barBottom - 6) fail(name, `tab ${id}: section hidden under the sticky bar`);
      if (pos.kickerTop !== null && pos.kickerTop < pos.barBottom) fail(name, `tab ${id}: heading covered by the bar`);
      if (pos.active !== id && !pos.atEnd) fail(name, `tab ${id}: tab not active (active=${pos.active})`);

      // Walk the whole section a screen at a time.
      const { top, height } = await page.evaluate((id) => {
        const r = document.querySelector(`[data-node="${id}"]`).getBoundingClientRect();
        return { top: r.top + scrollY, height: r.height };
      }, id);
      for (let y = top; y < top + height; y += Math.max(200, opts.viewport.height - 140)) {
        await page.evaluate((y) => window.scrollTo(0, y), y - 100);
        await page.waitForTimeout(150);
        const r = await page.evaluate(inspectViewport, { MIN_FONT, MIN_TAP });
        issues.overflow.push(...r.overflow);
        issues.smallText.push(...r.smallText);
        issues.smallTaps.push(...r.smallTaps);
        if (r.docOverflow) issues.overflow.push(`document scrollWidth ${r.docOverflow}`);
      }
      if (["projects", "about"].includes(id)) {
        await page.click(`.m-tab[data-tab="${id}"]`);
        await page.waitForTimeout(1300);
        await page.screenshot({ path: `${SHOTS}/${name}-${id}.png` });
      }
    }
    // The "nav-node" event (goToNode) is the navigation contract shared with
    // the camera scene; panel links and integrations rely on it.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("nav-node", { detail: { id: "education" } })));
    await page.waitForTimeout(1300);
    const navOk = await page.evaluate(() => {
      const bar = document.querySelector(".m-bar").getBoundingClientRect().bottom;
      const top = document.querySelector('[data-node="education"]').getBoundingClientRect().top;
      return Math.abs(top - bar) <= 6 && document.querySelector(".m-tab--active")?.dataset.tab === "education";
    });
    if (!navOk) fail(name, 'nav-node event did not scroll to "education"');

    for (const [kind, list] of Object.entries(issues)) {
      for (const msg of uniq(list).slice(0, 8)) fail(name, `${kind}: ${msg}`);
    }
    if (errors.length) fail(name, `page errors: ${errors.join(" | ")}`);
    console.log(`${name}: ${uniq(Object.values(issues).flat()).length ? "issues" : "ok"}`);
    await ctx.close();
  }

  // Desktop must still get the camera scene.
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto(BASE, { waitUntil: "networkidle" });
  await desk.waitForSelector(".scene-section", { timeout: 20000 }).catch(() => fail("desktop-1440", "camera scene missing"));
  if (await desk.$(".m-root")) fail("desktop-1440", "linear layout rendered on desktop");
  console.log("desktop-1440: checked");
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} mobile check failure(s):\n` + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nmobile checks passed");
