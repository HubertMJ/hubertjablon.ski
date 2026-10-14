# hubertjablon.ski

The site at https://hubertjablon.ski/: the landing page and the pages of projects that do not run
their own deployment.

| Path | What | Source |
|---|---|---|
| `/` | Landing page: intro, project cards, "The way in" diagram, About | `src/landing.html`, `src/landing.ts` |
| `/lab/` | Detection lab, design preview: a synthetic replay of scenario C (a new hash and a new name for every copy) | `src/lab.html`, `src/ui/lab.ts`, `src/lib/lab.ts`, `src/lib/lab-replay.json` |
| `/cluster/`, `/api` | Self-defending cluster | [self-defending-portfolio](https://github.com/HubertMJ/self-defending-portfolio) |

Assets live under `/site-assets/`, not `/assets/`: both images sit behind one hostname, and
`/assets/`, `/favicon.svg` and `/robots.txt` belong to the cluster page. The Gateway sends `/`
(exact), `/lab/` and `/site-assets/` here and everything else to self-defending-portfolio.

The landing page sends old single-page links (`/#verify`, `/?mock=1`, ...) on to `/cluster/`.

The detection lab data is synthetic: no machine ran it, and the page says so. The real generator
will live in [detection-lab](https://github.com/HubertMJ/detection-lab).

## Develop

```sh
npm ci --ignore-scripts
npm run lint && npm test       # typecheck, unit tests (vitest)
npm run build                  # dist/
npm run serve -- --port 4173   # static server for dist/
npm run test:e2e               # playwright (desktop + phone)
```

`PW_CHROMIUM_PATH` points Playwright at a preinstalled Chromium when the bundled one is missing.

## Rules the code keeps

- CSP `style-src 'self'` and Trusted Types: no inline styles or `innerHTML`; the DOM is built with
  `h()`/`replace()` from `src/lib/dom.ts`, dynamic sizes go through `style.setProperty`.
- The page never scrolls or jumps by itself; a click redraws only its own panel.

## Image

`Dockerfile` builds the bundle (lint, unit tests, build) and serves `dist/` from
nginx-unprivileged on :8080 with the headers in `security-headers.conf`.
`.github/workflows/build-image.yml` runs the e2e tests, then on `main` builds
`ghcr.io/hubertmj/hubertjablon.ski/site`, gates it with Trivy, attests an SPDX SBOM and signs it
keylessly with cosign.

Not deployed yet. Serving it needs, in self-defending-portfolio: an HTTPRoute for `/` to this
image, the cluster page moved under `/cluster/`, an Argo CD application, and this workflow's
identity added to the Kyverno image-verification policy.
