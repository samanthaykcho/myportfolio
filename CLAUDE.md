# Samantha Cho — industrial design portfolio

Static site (plain HTML/CSS/JS, no build step). Repo: https://github.com/samanthaykcho/myportfolio (branch `main`; renamed from `portfolio2`). Hosted on GitHub Pages: https://samanthaykcho.github.io/myportfolio/ (deploys from `main`, root).
Open `index.html` directly in a browser to view it.

## Working with Sam
- **Do all the coding yourself.** Sam wants to do as little coding work as possible — never hand her code to paste.
- **Ignore prefers-reduced-motion entirely.** Don't add reduced-motion rules.
- **Intuitive design comes first**, over flashy effects.
- She likes to be **asked for an opinion before bigger changes** — give a recommendation, then build when she says go.
- **Commit / push only when she asks.**
- Keep copy lowercase-and-friendly in UI labels (nav, captions); résumé content keeps normal capitalization.
- You can't see the site in a browser here (Playwright MCP times out; starting a local server is blocked). Say so when a change needs her eyes, and ask for screenshots.

## Structure
- `index.html` holds **both views**: `#home-view` (title page + white "work" contents sheet + footer) and `#about-view` (bio, "currently…", résumé, contact form, fun fact). `about.html` is just a redirect to `index.html#about`.
- `script.js` sections, in order: Lenis smooth scroll → tagline intro animation → Variable Proximity (cursor-weight effect on `.vp` elements, spring "sticky" pull) → name rounding filter → background video (0.5× speed, blur ramps at loop ends) → water ripples → custom cursor → scroll reveal (`.project`, `[data-reveal]` get `.in`) → parallax → nav + hash router → contact form → lightbox (`[data-zoom]` buttons open `#lightbox`; closes on outside click, ×, Esc, back; plain overlay not `<dialog>` so the custom cursor stays on top).
- Router: hashes `#work`, `#about`, `#contact`, `#`, plus one per project page (`#isogu`). Any page slides in from the right (WAAPI, `showPage`; `current` tracks the showing page, null = home), home slides back (`showHome`; back button returns to the saved scroll spot), contact = show about then Lenis-scroll to `#contact` (call `lenis.resize()` first — the about view is position:fixed during the slide).
- Project pages: `<div class="view view--project" id="<name>-view" data-title="<name>" hidden>` > `main.case`. The router picks them up automatically from the id; the card links to `#<name>`. Hero = full-screen `.case-hero` (`.case-hero-img` photo, cover, + `.case-logo` floating above the product — Sam's chosen look); below it a white `.case-sheet` (like the work sheet) with `.case-intro` (num + skills) then story sections: `.case-section` > `.case-heading` (no label above it — Sam dropped "the problem") (big lowercase, rounded by SVG filter `#round-head` to mimic Sam's 5% Illustrator path smoothing) + `.case-pair` (two 3:2 `.case-fig` photos, 2nd dropped 12vh) + `.case-takeaway` (big "so what" line under the right column). Then `.case-hcw`: the "how can we" design question, big + centred, key phrases in `<em>` (blue). Then "research": `.case-block`s with `.case-sub` subheads — `.case-compare` (3 `.case-option` columns, `.proscons` list with blue + / grey − marks and `.sr` screen-reader text) and `.case-criteria` (numbered rows: `.crit-name` + `.crit-desc`). Then "ideation": `.case-lead` intro, `.case-sketches` (sketchbook pages `isogu-sketches-1/2.webp`, rendered from `MATCHA SKETCHES.pdf` with mupdf in the scratchpad, rotated -90°, spine cropped; side by side, straight, no frame — each a `button.sketch-paper[data-zoom]` that opens the `#lightbox` overlay), then `.case-concepts` (3 trimmed digital sketches `isogu-concept-1/2/3.webp` from `concept<n>sketch.PNG`: 1 = drawer jar, 2 = spout tin + measuring lid, 3 = whisk-shaped bamboo tin; labels "concept n") and `.case-eval` (concept evaluation + extra notes — Sam's exact wording, don't edit; a `.link-btn[data-zoom-panel="matrix-tpl"]` opens the evaluation matrix, an HTML table in `<template id="matrix-tpl">`, in the lightbox. Matrix: 0 = existing products baseline, concepts scored +/− relative to it; (n) = category max). Concepts are introduced by Sam's line "I took 3 of the best concepts digital…" and labelled with their matrix names. Prototype photos waiting in assets: `TIN PROTOTYPE.JPG`, `tin3dprint1.JPG`, `whiskprototype.JPG`. Planned order after: prototyping → cad + details → brand + cmf → final (isogu.jpg) → reflection. The hero pushes in with the slide, logo trails. Nav is dark across project pages; cursor is white over the hero photo (Sam's call), blue over the sheet. On a project page, nav "work" sits heavier (aria-current).
- Top nav (work / about / contact) tucks away (`.nav.tucked`) once the white work sheet covers the screen; the same links live in the work page's `.foot` footer.
- Font: Adobe Fonts kit `tfd3zvu`, family `acumin-variable` (weight animated via `font-variation-settings`).
- Easing tokens in `:root`: `--ease-out: cubic-bezier(0.23,1,0.32,1)`; view slide uses `cubic-bezier(0.77,0,0.175,1)`.
- Contact form posts to Web3Forms (access key in `data-key` on `#contact-form`), so her email is never on the page. Has a `botcheck` honeypot.

## Water ripples + cursor
- The video is redrawn on WebGL canvas `#bg-water` and **bent only** (refraction) by a CPU wave sim around the cursor; tuning constants sit at the top of the "Water ripples" section. Sam approved this look.
- Rejected: lit/shaded glints on the waves (looked like "bumps on skin"), and long trails that spread across the screen. Keep it bend-only, short wake near the cursor.
- Only works when served over http(s) — from `file://` the browser won't share video pixels, so it silently falls back to the plain video. Check on the live site.
- Custom cursor: a bubble (`.cursor` > `.cursor-bubble`, mouse only, via `html.has-cursor`); swells over clickables, pops into a `.cursor-pop` ring on click, blue over the white `.contents` sheet, hidden in text fields. Rare `.cursor-drift` mini-bubbles float up over the video only (tuning constants at the top of the "Custom cursor" section). Sam wants it aquatic but low-key.

## Work grid (contents sheet)
- Two-column grid in `.projects`; cards are `a.project` (num + title `.vp`, `.frame` > `.media` img, optional `.cutout`, `.desc`). Order: 01 isogu, 02 kove, 03 nimi.
- Zig-zag: card 2 drops 16vh; later left-hand (odd) cards pull up -16vh so rows don't inherit the drop. `row-gap: 6vh` (Sam asked for it tight). Left cards use `data-speed="0"`, right cards `0.09` (parallax).
- Adding a card: frame image 1200×1200 jpg; cut-out positioned in % of the frame (`.cutout--name`). If a cut-out dips below the frame, narrow that card's `.desc` (nimi uses `.desc--clear-spill`, 58%).
- Sam's naming taste: short, soft, lowercase product names (isogu, kove, nimi).

## Bio pop-ups
Highlighted phrases (`mark.hl`) show a polaroid (`.pop` with `img` + `.cap`) on hover/focus. Thumbnails are `assets/pop-*.webp`, 600px wide, uncropped, made with sharp (`.rotate().resize({width:600}).webp({quality:84})`). HEIC files need converting first (sharp can't read them; WPF BitmapDecoder works).

## Assets
- Full-size originals (photos, stock, HEIC) are gitignored — only the web-sized versions are committed.
- Project frame images + spill-out cut-outs (`kove-cutout.webp`, `isogu-lid-cutout.webp`) were made with sharp + `@imgly/background-removal-node`.
- nimi (03, AI cloud camera for kids): Sam's own cut-out (`nimi png.PNG`) didn't line up with her hero render, so `nimi.jpg` is the cut-out composited on a hero-matched blue gradient (square crop at x159 y265 size1431 of the 2048 canvas), and `nimi-cutout.webp` is the same cut-out (low-alpha haze removed, cast shadow removed outside the frame) so the strap spills out. sharp isn't installed in the repo — install it in the scratchpad when needed.
- `ray-sprite.png` is the animated home icon (thickened from `RAY.GIF`).

## Open items
- Project detail pages: isogu has its hero + "context" section (stock photos `isogu-context-whisk/sift.webp`, from AdobeStock_1925547367 and Downloads/AdobeStock_1992320945); more isogu sections to come. kove and nimi have placeholder "coming soon" pages (`.soon` layout on the video: num, rounded `.soon-title`, tags, `.soon-note` pill, `a.back` link, card photo + cut-out on the right; nav stays white there) until Sam sends their content.
- Local git remote still points at the old `portfolio2` URL (GitHub redirects, pushes work). Changing it with `git remote set-url` was blocked by the permission system — ask Sam before retrying.
- `assets/pop-hollywood.webp` is made but unused (idea: a highlight on "the USA").
- `ISOGU LOGO 1.png` (gitignored original) → trimmed `isogu-logo.webp`, used on the isogu page hero.
- Possibly revisit the "tide line" wave edge on the contents sheet (CSS is there, switched off).
