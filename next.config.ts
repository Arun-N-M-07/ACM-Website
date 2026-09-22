import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three / drei ship modern ESM; transpiling keeps older Safari builds happy.
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        // Large static media and (future) GLB models are content-addressed by name,
        // so let browsers cache them aggressively.
        source: '/:dir(models|media|brand)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
