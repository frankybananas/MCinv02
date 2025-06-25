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
  // External packages configuration moved out of experimental
  transpilePackages: ["mongoose"],
  webpack: (config) => {
    
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      layers: true, // Fix for 'entryOptions.layer' error
    };

    return config;
  },
}

export default nextConfig