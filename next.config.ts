import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/order/guest/:orderId',
        destination: '/order/:orderId',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
