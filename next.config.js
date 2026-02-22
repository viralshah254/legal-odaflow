/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Electron
  output: process.env.ELECTRON ? 'export' : undefined,
  trailingSlash: true,
  // Disable image optimization for Electron builds
  images: {
    unoptimized: process.env.ELECTRON ? true : false,
    domains: [],
  },
  // Ensure static export works properly
  distDir: process.env.ELECTRON ? 'out' : '.next',
}

module.exports = nextConfig
