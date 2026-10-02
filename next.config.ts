import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification services require metadata in the initial HTML head.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
