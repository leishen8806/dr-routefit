# DR RouteFit website

Static Astro website for the public-facing RouteFit pages. It contains no backend, form submission, analytics or visitor tracking. Language preference is stored only in browser `localStorage`.

## Build

- Node.js: 24
- Install: `npm ci`
- Local development: `npm run dev`
- Build and verify: `npm test`
- Static output: `dist/`

`PUBLIC_SITE_ORIGIN` can override the approved public origin. The repository fallback is the approved website origin. `robots.txt` blocks all indexing until the launch owner explicitly approves indexing.

## Static hosting

1. Build from `website/` with Node 24 and publish only `website/dist/`.
2. Configure the static host to serve `index.html` for directory routes and preserve trailing slashes.
3. Configure the approved root host to redirect permanently to `[官网主机名]`, preserving the path and query string. This redirect belongs in the hosting configuration, not this repository.
4. Keep `[根域]` and `[官网主机名]` as private deployment values; do not add real DNS values, credentials or account identifiers to source control.
5. Run `npm test` against the exact commit before publishing. Do not deploy while the Khmer content file is marked as awaiting native-speaker review.

## Language behavior

Routes use `/km/`, `/en/` and `/zh/`. The root page prefers an explicit local choice, then the browser language, and otherwise defaults to Khmer. Language links keep the visitor on the equivalent page.

## Evidence

The browser verification creates a 390 px Khmer screenshot and a 1440 px Chinese screenshot outside the repository. Set `EVIDENCE_DIR` to the intended evidence directory; otherwise the system temporary directory is used. These are synthetic static pages and contain no visitor or business data.
