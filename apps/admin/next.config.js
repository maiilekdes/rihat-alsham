/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.rihasham.sa' }],
  },
};

module.exports = nextConfig;
