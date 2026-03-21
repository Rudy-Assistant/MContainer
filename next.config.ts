import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Pin workspace root to MContainer — prevents Next.js from inferring
  // C:\MHome as root due to the parent lockfile, which breaks public/ resolution.
  outputFileTracingRoot: resolve(import.meta.dirname ?? __dirname, "."),
};

export default nextConfig;
