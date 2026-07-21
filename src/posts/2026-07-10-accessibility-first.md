---
title: Checking accessibility on every deploy
date: 2026-07-10
description: An axe-core scan runs before each deploy and publishes its results.
tags: ["posts"]
---

Every deploy runs an [axe-core](https://github.com/dequelabs/axe-core) scan
over the built HTML and publishes the results on the
[Accessibility](/accessibility/) page. The scan runs as part of the GitHub
Actions workflow, right before the site is published, so the report always
matches what's live.
