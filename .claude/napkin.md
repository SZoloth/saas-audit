# Napkin — saas-audit

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
| --- | --- | --- | --- |
| 2026-11-27 | self | `.chips{display:flex}` overrode `[hidden]` during search, and WebKit drew a second native `×` in `#q` | Keep `[hidden]{display:none !important}` and `.search input::-webkit-search-cancel-button{-webkit-appearance:none}` in `bake.ts` |
| 2026-11-27 | self | Daily CDC Action commits to `main`, causing non-fast-forward `git push` rejections locally | Always `git pull --rebase` before pushing changes to `main` |

## Patterns That Work
- **Baked Data + verbatim evidence snippets:** Compute `rawSha256` on the full `/pricing` HTML and store extracted price tiers, SSO/Sales-wall flags, and verbatim quote snippets in slim JSON receipts.
- **Hardened baseline from day 1:** `vitest@^5.1.2` (0 CVEs), zero runtime deps, ES5 inline JS with zero `innerHTML`, strict CSP/security headers in `vercel.json`, SHA-pinned GitHub Actions, Dependabot enabled.

## Domain Notes
- Live URL: `https://saas.samzoloth.com` (Vercel Hobby `sams-projects-4f0dc80a/saas-audit-preview`, auto-builds on push to `SZoloth/saas-audit` via `pnpm crawl && pnpm bake && pnpm verify`).
- 25 SaaS & AI pricing pages monitored daily; cross-linked with `https://jobs.samzoloth.com`.
