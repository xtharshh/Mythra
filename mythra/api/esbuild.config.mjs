// Bundles the serverless API into ONE file Vercel can run without
// resolving anything itself. Run: `npm run build:api`.
import { build } from "esbuild";

await build({
  entryPoints: ["api/entry.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/bundle.mjs",
  logLevel: "warning",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
console.log("api/bundle.mjs built");
