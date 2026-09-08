import type { NextConfig } from "next";

/**
 * `output: "standalone"` is ONLY for self-hosted Docker / local prod runs
 * (opt in via NEXT_OUTPUT_STANDALONE=1 — see `bun run build:standalone`).
 * On Vercel it must stay OFF: Vercel does its own file tracing + packaging,
 * and a forced standalone build breaks it with
 * "ENOENT .next/next-server.js.nft.json".
 */
const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  allowedDevOrigins: ['192.168.1.184'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
 