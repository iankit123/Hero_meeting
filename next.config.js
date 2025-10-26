/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude scripts folder from build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Allow all hosts for development in Replit
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    
    // Exclude scripts folder from build - they're development tools only
    config.module.rules.push({
      test: /\.ts$/,
      include: /scripts/,
      use: {
        loader: 'null-loader',
      },
    });
    
    return config;
  },
}

module.exports = nextConfig
