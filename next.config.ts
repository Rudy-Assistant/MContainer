import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Pin workspace root to MContainer — prevents Next.js from inferring
  // C:\MHome as root due to the parent lockfile, which breaks public/ resolution.
  outputFileTracingRoot: resolve(import.meta.dirname ?? __dirname, "."),
};

// Bundle analyzer — opt-in via env var.
// Run with: ANALYZE=true npm run build
// Requires `npm i -D @next/bundle-analyzer` (not installed by default to
// keep the dependency surface small).
let exported: NextConfig = nextConfig;
if (process.env.ANALYZE === 'true') {
  try {
    // Dynamic require — won't fail the build for users who don't want the
    // analyzer installed. Eager `require` would fail at module init.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withBundleAnalyzer = (require('@next/bundle-analyzer') as (opts: { enabled: boolean }) => (cfg: NextConfig) => NextConfig)({ enabled: true });
    exported = withBundleAnalyzer(nextConfig);
  } catch {
    console.warn('[next.config] ANALYZE=true but @next/bundle-analyzer not installed — run `npm i -D @next/bundle-analyzer`.');
  }
}

export default exported;
