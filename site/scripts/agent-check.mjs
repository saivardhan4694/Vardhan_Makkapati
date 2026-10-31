// Opt-in end-to-end check of the portfolio agent UI (NOT run in CI: it needs
// a running mock worker and a build with VITE_AGENT_API_URL set).
//
//   cd agent-api && npx wrangler dev --var MOCK_LLM:1 --var RATE_SHORT_LIMIT:1000 //     --var RATE_DAILY_LIMIT:1000 --var GLOBAL_DAILY_CAP:1000 --var CONTACT_DAILY_LIMIT:100
//   cd site && VITE_AGENT_API_URL=http://127.0.0.1:8787 npm run build && npx vite preview --port 4173
//   BASE_URL=http://localhost:4173/ npm run test:agent      # optional SHOT_DIR=... for screenshots
//
// Linear layout (390x844, 375x667, 768x1024, 844x390): bottom-sheet geometry,
// scroll lock, tap targets, 16px input, every navigating tool (navigate_to,
// filter_projects, open_project via citation, get_contact) lands the right
// section/repo in view with the sheet in peek, contact-draft buttons, close +
// backdrop, and a stubbed visualViewport "keyboard". Desktop 1440x900: panel
// geometry unchanged and the tools drive the camera BUILDS browser.
// Chromium emulation only; real iOS Safari keyboard behaviour is not covered.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const SHOTS = process.env.SHOT_DIR;
const MOBILE = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DEVICES = [
  { name: "390x844", viewport: { width: 390, height: 844 }, ...MOBILE },
  { name: "375x667", viewport: { width: 375, height: 667 }, ...MOBILE },
  { name: "768x1024", viewport: { width: 768, height: 1024 }, ...MOBILE },
  { name: "844x390", viewport: { width: 844, height: 390 }, ...MOBILE },
];
const fails = [];
const check = (dev, ok, msg) => {
  if (!ok) fails.push(`[${dev}] ${msg}`);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`);
};

async function ask(page, text) {
  // Expand first if peeking.
  if (await page.$(".agent-panel--peek")) await page.click(".agent-toggle");
  await page.fill("#agent-input", text);
  await page.click(".agent-send");
  // Busy = input readOnly / aria-busy; wait for it to start, then to finish.
  await page.waitForFunction(() => document.querySelector("#agent-input").readOnly, null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#agent-input").readOnly, null, { timeout: 15000 });
  await page.waitForTimeout(1400);
}

const sectionAtTop = (page, id) =>
  page.evaluate((id) => {
    const bar = document.querySelector(".m-bar").getBoundingClientRect().bottom;
    const top = document.querySelector(`[data-node="${id}"]`).getBoundingClientRect().top;
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    return { ok: Math.abs(top - bar) <= 8 || (atEnd && top < innerHeight * 0.6), top, bar };
  }, id);

const browser = await chromium.launch();
try {
  for (const dev of DEVICES) {
    const { name, ...opts } = dev;
    console.log(name);
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForSelector(".m-root .m-tabs", { timeout: 20000 });
    await page.waitForSelector(".agent-trigger.agent-sheet", { timeout: 5000 });
    await page.waitForTimeout(600);

    const trig = await page.evaluate(() => {
      const t = document.querySelector(".agent-trigger").getBoundingClientRect();
      const bar = document.querySelector(".m-bar").getBoundingClientRect();
      return { t: t.toJSON(), barBottom: bar.bottom, vw: innerWidth, vh: innerHeight };
    });
    check(name, trig.t.height >= 44 && trig.t.width >= 44, `launcher ${Math.round(trig.t.width)}x${Math.round(trig.t.height)} >= 44`);
    check(name, trig.t.top > trig.barBottom && trig.t.right <= trig.vw && trig.t.bottom <= trig.vh, "launcher clear of tab strip, inside viewport");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-0-launcher.png` });

    await page.click(".agent-trigger");
    await page.waitForTimeout(350);
    const open = await page.evaluate(() => {
      const p = document.querySelector(".agent-panel").getBoundingClientRect();
      const small = [...document.querySelectorAll(".agent-panel button, .agent-panel input")]
        .filter((b) => getComputedStyle(b).display !== "inline")
        .map((b) => ({ r: b.getBoundingClientRect(), d: b.className + " " + (b.textContent ?? "").slice(0, 20) }))
        .filter((x) => x.r.width > 0 && (x.r.height < 43.5 || x.r.width < 43.5))
        .map((x) => `${x.d} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`);
      return {
        p: p.toJSON(),
        vw: innerWidth,
        vh: innerHeight,
        docW: document.documentElement.scrollWidth,
        lock: document.documentElement.classList.contains("agent-lock"),
        overflowHidden: getComputedStyle(document.documentElement).overflow,
        inputFont: parseFloat(getComputedStyle(document.querySelector("#agent-input")).fontSize),
        small,
        headOverflow: (() => {
          const h = document.querySelector(".agent-head");
          return h.scrollWidth > h.clientWidth + 1;
        })(),
        focusIn: document.querySelector(".agent-panel").contains(document.activeElement),
      };
    });
    check(name, open.p.left === 0 && Math.abs(open.p.width - open.vw) < 1, `sheet full width (${open.p.width}/${open.vw})`);
    check(name, Math.abs(open.p.bottom - open.vh) < 1, `sheet anchored to bottom (${open.p.bottom}/${open.vh})`);
    check(name, open.p.top >= 40, `sheet leaves top gap (top=${Math.round(open.p.top)})`);
    check(name, open.docW <= open.vw, `no horizontal overflow (${open.docW})`);
    check(name, open.lock && open.overflowHidden === "hidden", "page scroll locked");
    check(name, open.inputFont >= 16, `input font ${open.inputFont}px`);
    check(name, open.small.length === 0, `tap targets >=44 ${open.small.join("; ")}`);
    check(name, !open.headOverflow, "header fits");
    check(name, open.focusIn, "focus moved into sheet");
    // Wheel/touch scroll on the page must not move it while locked.
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    check(name, (await page.evaluate(() => scrollY)) === y0, "page did not scroll under the sheet");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-1-open.png` });

    // navigate_to (mock: "stack" -> skills)
    await ask(page, "What's his tech stack?");
    check(name, !!(await page.$(".agent-panel--peek")), "navigate_to -> sheet in peek state");
    check(name, await page.evaluate(() => { const l = document.querySelector(".agent-log"); return l.scrollTop + l.clientHeight >= l.scrollHeight - 2; }), "peek log pinned to newest output");
    check(name, !(await page.evaluate(() => document.documentElement.classList.contains("agent-lock"))), "scroll lock released in peek");
    let s = await sectionAtTop(page, "skills");
    check(name, s.ok, `navigate_to -> STACK at top (top=${Math.round(s.top)} bar=${Math.round(s.bar)})`);
    check(name, (await page.evaluate(() => document.querySelector(".m-tab--active")?.dataset.tab)) === "skills", "STACK tab active");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-2-navigate.png` });

    // filter_projects (mock: "agent" -> agents)
    await ask(page, "What has he built with agents?");
    s = await sectionAtTop(page, "projects");
    check(name, s.ok, `filter_projects -> BUILDS at top (top=${Math.round(s.top)})`);
    const filt = await page.evaluate(() => ({
      active: document.querySelector(".panel--projects .repo-dir--active")?.textContent ?? "",
      repos: [...document.querySelectorAll(".m-repo")].map((r) => r.dataset.repo),
    }));
    check(name, /agent/i.test(filt.active), `BUILDS filter = ${filt.active}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-3-filter.png` });

    // open_project via citation (same commandBuilds({open}) + goToNode path as the tool)
    await page.click(".agent-toggle");
    await page.waitForTimeout(300);
    const cite = page.locator(".agent-cite", { hasText: "BUILDS/chatbot" }).last();
    await cite.click();
    await page.waitForTimeout(1400);
    const opened = await page.evaluate(() => {
      const li = document.querySelector('.m-repo[data-repo="chatbot"]');
      const bar = document.querySelector(".m-bar").getBoundingClientRect().bottom;
      const panelTop = document.querySelector(".agent-panel").getBoundingClientRect().top;
      const r = li?.getBoundingClientRect();
      return { open: li?.classList.contains("m-repo--open"), top: r?.top, bar, panelTop };
    });
    check(name, !!(await page.$(".agent-panel--peek")), "citation -> peek");
    check(name, opened.open && opened.top >= opened.bar - 1 && opened.top < opened.panelTop - 40, `open_project -> chatbot expanded + visible (top=${Math.round(opened.top)} bar=${Math.round(opened.bar)} sheet=${Math.round(opened.panelTop)})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-4-open-project.png` });

    // get_contact (mock: "contact" -> ping)
    await ask(page, "How do I contact him?");
    s = await sectionAtTop(page, "ping");
    check(name, s.ok, `get_contact -> PING visible (top=${Math.round(s.top)})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-5-contact.png` });

    // Contact draft UI in full sheet
    await ask(page, "send him a message: hi from x@y.com");
    const draft = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".agent-contact-actions button")].map((x) => x.getBoundingClientRect().height);
      return b;
    });
    check(name, draft.length === 2 && draft.every((h) => h >= 44), `contact draft buttons ${draft.map(Math.round)}`);
    check(name, (await page.evaluate(() => document.documentElement.scrollWidth)) <= opts.viewport.width, "no overflow with draft");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-6-draft.png` });

    // Close: X restores launcher, lock released
    await page.click(".agent-close");
    await page.waitForTimeout(300);
    check(name, !(await page.$(".agent-panel--open")) && !(await page.evaluate(() => document.documentElement.classList.contains("agent-lock"))), "close button closes + unlocks");

    // Backdrop tap closes too
    await page.click(".agent-trigger");
    await page.waitForTimeout(300);
    await page.mouse.click(opts.viewport.width / 2, 10);
    await page.waitForTimeout(300);
    check(name, !(await page.$(".agent-panel--open")), "backdrop tap closes");

    // Simulated keyboard: shrink the visual viewport via a stub and fire resize.
    await page.click(".agent-trigger");
    await page.waitForTimeout(300);
    const kb = await page.evaluate(async () => {
      const vv = window.visualViewport;
      const h = Math.round(innerHeight * 0.55);
      Object.defineProperty(vv, "height", { configurable: true, get: () => h });
      vv.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 300));
      const p = document.querySelector(".agent-panel").getBoundingClientRect();
      const inp = document.querySelector("#agent-input").getBoundingClientRect();
      const res = { h, vh: innerHeight, pTop: p.top, pBottom: p.bottom, inpBottom: inp.bottom, inpH: inp.height };
      delete vv.height;
      vv.dispatchEvent(new Event("resize"));
      return res;
    });
    const kbTop = kb.vh - (kb.vh - kb.h);
    check(name, kb.pBottom <= kbTop + 1 && kb.inpBottom <= kbTop && kb.pTop >= 0 && kb.inpH >= 44, `keyboard stub (vv ${kb.h}px): sheet ${Math.round(kb.pTop)}..${Math.round(kb.pBottom)}, input bottom ${Math.round(kb.inpBottom)}`);
    await page.click(".agent-close");

    check(name, errors.length === 0, `no page errors ${errors.join(" | ")}`);
    await ctx.close();
  }

  // Desktop camera layout
  console.log("1440x900");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".scene-section", { timeout: 20000 });
  await page.waitForSelector(".agent-trigger", { timeout: 5000 });
  await page.waitForTimeout(600);
  const d = await page.evaluate(() => {
    const t = document.querySelector(".agent-trigger");
    return { sheet: t.classList.contains("agent-sheet"), r: t.getBoundingClientRect().toJSON(), backdrop: !!document.querySelector(".agent-backdrop") };
  });
  check("desktop", !d.sheet && !d.backdrop, "no sheet classes / backdrop on desktop");
  check("desktop", d.r.left === 32, `trigger bottom-left as before (left=${d.r.left}, bottom=${900 - d.r.bottom})`);
  await page.keyboard.press("/");
  await page.waitForTimeout(300);
  const dp = await page.evaluate(() => ({
    r: document.querySelector(".agent-panel").getBoundingClientRect().toJSON(),
    focus: document.activeElement?.id,
    lock: document.documentElement.classList.contains("agent-lock"),
  }));
  check("desktop", dp.r.left === 24 && dp.r.width === 580 && dp.r.height === 480 && 900 - dp.r.bottom === 46, `panel geometry unchanged ${dp.r.left},${dp.r.width}x${dp.r.height}`);
  check("desktop", dp.focus === "agent-input" && !dp.lock, "input focused, no scroll lock");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1440-1-open.png` });
  await ask(page, "What has he built with agents?");
  const cam = await page.evaluate(() => ({
    filter: document.querySelector(".panel--projects .repo-dir--active")?.textContent ?? "",
    stillOpen: !!document.querySelector(".agent-panel--open.agent-panel"),
    peek: !!document.querySelector(".agent-panel--peek"),
  }));
  check("desktop", /agent/i.test(cam.filter) && cam.stillOpen && !cam.peek, `camera BUILDS filter=${cam.filter}, panel stays open`);
  await page.waitForTimeout(1500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1440-2-filter.png` });
  await page.locator(".agent-cite", { hasText: "BUILDS/chatbot" }).last().click();
  await page.waitForTimeout(800);
  const sel = await page.evaluate(() => document.querySelector(".repo-row--active .repo-name")?.textContent);
  check("desktop", sel === "chatbot", `camera open_project selected=${sel}`);
  await ask(page, "What's his tech stack?");
  await page.waitForTimeout(1500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1440-3-navigate.png` });
  await page.close();
} finally {
  await browser.close();
}
if (fails.length) {
  console.error(`\n${fails.length} failure(s):\n` + fails.join("\n"));
  process.exit(1);
}
console.log("\nall agent checks passed");
