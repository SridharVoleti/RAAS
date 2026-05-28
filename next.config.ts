import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pino', 'razorpay'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

export default nextConfig
