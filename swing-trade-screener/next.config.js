/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@vercel/kv": false,
      "@std/testing/mock": false,
      "@std/testing/bdd": false,
      "@gadicc/fetch-mock-cache": false,
      "@gadicc/fetch-mock-cache/runtimes/deno.ts": false,
    };
    return config;
  },
};

module.exports = nextConfig;
