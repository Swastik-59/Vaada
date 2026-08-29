import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;

