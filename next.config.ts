/**
 * @file next.config.ts
 * @description Next.js configuration: image remote patterns derived from NEXT_PUBLIC_SUPABASE_URL.
 *   Called by: Next.js build and dev server
 */

import type { NextConfig } from 'next'

// Derive hostname + port from NEXT_PUBLIC_SUPABASE_URL so this works for both
// local Supabase (http://127.0.0.1:<port>) and hosted Supabase (https://xxx.supabase.co).
const supabaseOrigin = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    return {
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
    }
  } catch {
    return null
  }
})()

const nextConfig: NextConfig = {
    images: {
        ...(process.env.NODE_ENV === 'development' ? { unoptimized: true } : {}),
        remotePatterns: [
            { protocol: 'https', hostname: 'picsum.photos' },
            ...(supabaseOrigin ? [supabaseOrigin] : []),
        ],
    },
}

export default nextConfig
