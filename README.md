# discho-blog

An [Eleventy](https://www.11ty.dev/) blog with a Sveltia CMS admin, Pagefind
search, and an automated accessibility report, deployed to GitHub Pages.

## Structure

- `src/posts/` — dated blog posts (`src/posts/posts.json` sets their layout,
  tag, and `/posts/<slug>/` permalink)
- `src/pages/` — standalone pages like About (`src/pages/pages.json` does the
  same for `/pages/<slug>/`)
- `src/index.njk` — homepage: about blurb, 3 most recent posts, CTAs to
  search / browse all posts / browse all pages
- `src/search.njk` — Pagefind search UI at `/search/`
- `src/accessibility.njk` — renders the latest axe-core scan at `/accessibility/`
- `admin/` — Sveltia CMS (`index.html` + `config.yml`)
- `scripts/a11y.mjs` — scans the built `_site` with axe-core and jsdom, writes
  `src/_data/a11y.json`
- `.github/workflows/deploy.yml` — build, scan, and deploy to GitHub Pages

## Local development

```
npm install
npm start          # eleventy --serve, live-reloading dev server + pagefind reindex on every rebuild
npm run build       # one-off build + pagefind indexing (an `eleventy.after` hook in .eleventy.js)
npm run build:report  # build, run the accessibility scan, rebuild with results
```

`npm run build:report` builds twice on purpose: the first build produces the
HTML the scanner needs, the second regenerates `/accessibility/` (and the
Pagefind index) with the fresh results baked in.

## Sveltia CMS setup

`admin/config.yml` defines `posts` and `pages` collections. Before it's
usable against real GitHub data:

1. Update `backend.repo` in `admin/config.yml` to `owner/repo`.
2. GitHub Pages only serves static files, so the CMS's `github` backend needs
   an OAuth proxy to authenticate editors. Deploy
   [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) (works on
   Cloudflare Workers' free tier), register a GitHub OAuth App pointed at it,
   and set `base_url`/`auth_endpoint` in `config.yml` accordingly.
3. Until that's wired up, you can set `backend.name: test-repo` to try the CMS
   locally against in-browser mock data.

## Deploying

1. In the GitHub repo, go to Settings → Pages → Source, and select **GitHub
   Actions**.
2. Push to `main` — `.github/workflows/deploy.yml` builds the site, runs the
   accessibility scan, rebuilds with the report, and publishes `_site`.
3. Update `src/_data/site.json` (`url`) and `admin/config.yml` (`site_url`) to
   match your Pages URL. The workflow auto-detects the path prefix: root for
   an `<owner>.github.io` repo, `/repo-name/` otherwise.

## Accessibility

Every deploy runs [axe-core](https://github.com/dequelabs/axe-core) against
every HTML page in `_site` (via jsdom, no headless browser needed) and
publishes pass/fail counts and violation details at `/accessibility/`.

# Design 
 Based on The infant's library.Individual vols. in pub. paper bds. of various colors (white, off-white, black, blue, tan, rose, orange, or green, and 1 in marbled paper paper), each decorated with small colored paper onlays, with series title, on both upper and lower cover.
 https://dpul.princeton.edu/catalog/dc9019sd49x