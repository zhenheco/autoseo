const createNextIntlPlugin = require("next-intl/plugin");
const path = require("node:path");
const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        // 舊的同步目標頁面重定向到新的外部網站頁面
        source: "/dashboard/admin/sync-targets",
        destination: "/dashboard/websites/external",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // API routes CORS configuration
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: (
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3168"
            ).trim(),
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
      {
        // Public assets except SHOPLINE admin iframe entrypoint.
        source: "/((?!shopline/admin(?:/.*)?$).*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "googleapis",
      "lucide-react",
      "@radix-ui/react-icons",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        googleapis: "commonjs googleapis",
      });
    }
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
