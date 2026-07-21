---
title: Adding search with Pagefind
date: 2026-07-01
description: How the /search/ page works, and why indexing happens after the build.
tags: ["posts"]
---

[Pagefind](https://pagefind.app/) indexes the static output in `_site` after
Eleventy builds it, so it always reflects what's actually deployed. The
`postbuild` npm script runs `pagefind --site _site` automatically after every
`npm run build`.

The `<main>` element carries `data-pagefind-body`, so navigation and the
footer are excluded from search results — only page content is indexed.
