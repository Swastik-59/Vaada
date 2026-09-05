import type { NextConfig } from "next";

export function resolveApiOrigin(raw = process.env.VAADA_API_ORIGIN ?? "http://127.0.0.1:8000"): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("VAADA_API_ORIGIN must be an absolute HTTP(S) origin.");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("VAADA_API_ORIGIN must be an absolute HTTP(S) origin without a path, query, or fragment.");
  }

  return parsed.origin;
}

const apiOrigin = resolveApiOrigin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
