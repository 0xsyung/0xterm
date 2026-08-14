/** @type {import('next').Next.Config} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/0xterm',
  assetPrefix: '/0xterm/',
};

export default nextConfig;
