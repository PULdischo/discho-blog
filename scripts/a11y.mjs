import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createRequire } from "node:module";
import { JSDOM, VirtualConsole } from "jsdom";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const SITE_DIR = "_site";
const OUTPUT_FILE = "src/_data/a11y.json";
const SKIP_DIRS = new Set(["pagefind"]);

function findHtmlFiles(dir) {
  let results = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(findHtmlFiles(full));
    } else if (entry.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

async function auditFile(filePath) {
  const html = readFileSync(filePath, "utf-8");
  // jsdom logs a "Not implemented" warning for canvas.getContext(), which
  // axe-core's color-contrast check probes for and gracefully falls back
  // on. A silent virtual console keeps that expected noise out of CI logs.
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost/",
    virtualConsole: new VirtualConsole(),
  });
  dom.window.eval(axeSource);
  const results = await dom.window.axe.run(dom.window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] },
  });
  dom.window.close();
  return results;
}

function toUrl(filePath) {
  const rel = relative(SITE_DIR, filePath).split(sep).join("/");
  return "/" + rel.replace(/index\.html$/, "");
}

async function main() {
  const files = findHtmlFiles(SITE_DIR);
  const pages = [];
  let totalViolations = 0;
  let totalPasses = 0;

  for (const file of files) {
    const url = toUrl(file);
    try {
      const results = await auditFile(file);
      totalViolations += results.violations.length;
      totalPasses += results.passes.length;
      pages.push({
        url,
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodeCount: v.nodes.length,
        })),
      });
    } catch (err) {
      pages.push({ url, violations: [], error: err.message });
    }
  }

  pages.sort((a, b) => b.violations.length - a.violations.length);

  const data = {
    generatedAt: new Date().toISOString(),
    pagesScanned: files.length,
    totalViolations,
    totalPasses,
    pages,
  };

  mkdirSync("src/_data", { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `axe-core scanned ${files.length} page(s): ${totalViolations} issue group(s), ${totalPasses} passed checks.`
  );
}

main();
