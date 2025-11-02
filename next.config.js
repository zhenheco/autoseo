const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['googleapis', 'lucide-react', '@radix-ui/react-icons'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'googleapis': 'commonjs googleapis',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
