/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["mongoose"],
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Enable compression
  compress: true,
  webpack: (config, { dev, isServer }) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Disable chunk splitting in development to prevent ChunkLoadError
    if (dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
      };
    }

    return config;
  },
  async headers() {
    return [
      {
        // Match all API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    return config;
  },
}

export default nextConfig