import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: apiDir,
};

export default nextConfig;