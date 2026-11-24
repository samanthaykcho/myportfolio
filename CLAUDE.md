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
- `script.js` sections, in order: Lenis smooth scroll → tagline intro animation → Variable Proximity (cursor-weight effect on `.vp` elements, spring "sticky" pull) → name rounding filter → background video (0.5× speed, blur ramps at loop ends) → scroll reveal (`.project`, `[data-reveal]` get `.in`) → parallax → nav + hash router → contact form.
- Router: hashes `#work`, `#about`, `#contact`, `#`. About slides in from the right (WAAPI, `showAbout`), home slides back (`showHome`), contact = show about then Lenis-scroll to `#contact` (call `lenis.resize()` first — the about view is position:fixed during the slide).
- Top nav (work / about / contact) tucks away (`.nav.tucked`) once the white work sheet covers the screen; the same links live in the work page's `.foot` footer.
- Font: Adobe Fonts kit `tfd3zvu`, family `acumin-variable` (weight animated via `font-variation-settings`).
- Easing tokens in `:root`: `--ease-out: cubic-bezier(0.23,1,0.32,1)`; view slide uses `cubic-bezier(0.77,0,0.175,1)`.
- Contact form posts to Web3Forms (access key in `data-key` on `#contact-form`), so her email is never on the page. Has a `botcheck` honeypot.

## Bio pop-ups
Highlighted phrases (`mark.hl`) show a polaroid (`.pop` with `img` + `.cap`) on hover/focus. Thumbnails are `assets/pop-*.webp`, 600px wide, uncropped, made with sharp (`.rotate().resize({width:600}).webp({quality:84})`). HEIC files need converting first (sharp can't read them; WPF BitmapDecoder works).

## Assets
- Full-size originals (photos, stock, HEIC) are gitignored — only the web-sized versions are committed.
- Project frame images + spill-out cut-outs (`kove-cutout.webp`, `isogu-lid-cutout.webp`) were made with sharp + `@imgly/background-removal-node`.
- `ray-sprite.png` is the animated home icon (thickened from `RAY.GIF`).

## Open items
- Project detail pages (project cards link to `#` for now).
- `assets/pop-hollywood.webp` is made but unused (idea: a highlight on "the USA").
- `ISOGU LOGO 1.png` — purpose not decided yet.
- Possibly revisit the "tide line" wave edge on the contents sheet (CSS is there, switched off).
