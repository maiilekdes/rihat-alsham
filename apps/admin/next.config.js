/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a self-contained server bundle so the Docker runtime image does not
  // need the monorepo's node_modules.
  output: 'standalone',
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.rihasham.sa' }],
  },
};

module.exports = nextConfig;
