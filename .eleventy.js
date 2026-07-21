const { execSync } = require("node:child_process");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ admin: "admin" });
  eleventyConfig.addPassthroughCopy("src/assets");

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(dateObj));
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    if (!dateObj) return "";
    return new Date(dateObj).toISOString().slice(0, 10);
  });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());

  // Deterministic 0-6 index so a given post always gets the same "spine"
  // color, on the homepage, the full listing, and its own post page.
  eleventyConfig.addFilter("spineIndex", (str) => {
    let hash = 0;
    for (const ch of String(str)) hash = (hash * 31 + ch.charCodeAt(0)) % 7;
    return hash;
  });

  // Newest-first collection of posts, regardless of front matter order.
  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getFilteredByTag("posts").sort((a, b) => b.date - a.date)
  );

  // Alphabetical collection of standalone pages.
  eleventyConfig.addCollection("pages", (collectionApi) =>
    collectionApi
      .getFilteredByTag("pages")
      .sort((a, b) => a.data.title.localeCompare(b.data.title))
  );
  // Reindex Pagefind after every build, including `eleventy --serve` rebuilds
  // during local dev, not just one-off `npm run build` invocations.
  eleventyConfig.on("eleventy.after", () => {
    execSync("npx pagefind --site _site", { stdio: "inherit" });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
  
};
