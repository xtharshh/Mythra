// Vercel serverless entry: re-exported from the prebuilt bundle
// (`npm run build:api`) so Vercel resolves ZERO relative imports itself —
// the crash in the logs (`Cannot find module .../src/schemas`) can't recur.
export { default } from "./bundle.mjs";
