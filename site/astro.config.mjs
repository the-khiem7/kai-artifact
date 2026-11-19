import { defineConfig } from "astro/config";

// scripts/build_site.py passes the deployed URL and the output folder through these variables.
const site = process.env.KAI_SITE || "https://the-khiem7.github.io";
const base = process.env.KAI_BASE || "/kai-artifact";
const outDir = process.env.KAI_OUT || "../_site";

export default defineConfig({
  site,
  base,
  outDir,
  trailingSlash: "always",
  build: { format: "directory" },
  markdown: {
    shikiConfig: { theme: "github-dark", wrap: true },
  },
});
