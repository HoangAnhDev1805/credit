/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', '127.0.0.1', 'checkcc.live', 'www.checkcc.live'],
    unoptimized: false,
  },
  env: {
    // Make optional to avoid build error when not provided
    CUSTOM_KEY: process.env.CUSTOM_KEY || '',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/uploads/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, must-revalidate' },
        ],
      },
      {
        source: '/(.*)\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2)$',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    // Only add a rewrite when NEXT_PUBLIC_API_URL is provided (dev).
    // In production, we call relative '/api' and let Nginx proxy to backend.
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Custom webpack configuration
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;
