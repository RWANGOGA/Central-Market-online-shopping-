import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Vite app at the repo root also has a lockfile; pin the tracing root
  // here so Next.js does not walk up into the frontend's node_modules.
  outputFileTracingRoot: apiDir,
};

export default nextConfig;