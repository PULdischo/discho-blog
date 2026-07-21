---
title: Building this site with Eleventy
date: 2026-06-15
description: Notes on the folder layout for posts and pages, and why Eleventy was a good fit.
tags: ["posts"]
---

This site is built with [Eleventy](https://www.11ty.dev/). Content lives in
two collections:

- `src/posts/` — dated blog entries, newest first
- `src/pages/` — standalone pages like About

Each collection has a small `*.json` data file next to it that sets the
layout, tag, and permalink for everything in that folder, so individual posts
and pages only need their own front matter.
