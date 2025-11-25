/**
 * @file next.config.mjs
 * @responsibility
 *   • Custom webpack rule for SVG ↦ React components.
 *   • Alias pdf.js to the legacy build for worker compatibility.
 *   • Set long-lived cache headers for the PDF worker.
 *   • **NEW:** Add a rewrite so that `/s/:token` routes to the dynamic
 *     page `pages/s/[token].ts` (Phase-1 Share & Invite feature).
 */

const nextConfig = {
  // --- CRITICAL FOR DOCKER ---
  output: 'standalone',
  // Configure remote image hosts for Next.js <Image /> (Google avatars)  // update - 1
  images: {                                                               // update - 2
    remotePatterns: [                                                     // update - 3
      { protocol: "https", hostname: "lh3.googleusercontent.com" },       // update - 4
      { protocol: "https", hostname: "lh4.googleusercontent.com" },       // update - 5
      { protocol: "https", hostname: "lh5.googleusercontent.com" },       // update - 6
      { protocol: "https", hostname: "lh6.googleusercontent.com" },       // update - 7
    ],
  },                                                                      // update - 8

  /** ────────────────────────────────────────────────────────────────────
   *  Webpack customisation
   *  ──────────────────────────────────────────────────────────────────── */
  webpack(config) {
    // 1) Inline SVGs as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });

    // 2) Alias pdfjs-dist to the legacy build
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf'
    };

    return config;
  },

  /** ────────────────────────────────────────────────────────────────────
   *  Static header tweaks
   *  ──────────────────────────────────────────────────────────────────── */
  async headers() {
    return [
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Content-Type',
            value: 'application/javascript'
          }
        ]
      }
    ];
  },

  /** ────────────────────────────────────────────────────────────────────
   *  Rewrite for Share-Invite redemption
   *  ──────────────────────────────────────────────────────────────────── */
  async rewrites() {
    return [
      {
        source: '/s/:token',       // e.g. /s/AbCdEf123
        destination: '/s/:token'   // served by pages/s/[token].ts
      }
    ];
  }
};

export default nextConfig;
