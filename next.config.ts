/** @type {import('next').Next.Config} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // NOTE: If your repository name is NOT '<username>.github.io', 
  // uncomment the lines below and replace 'YOUR_REPO_NAME' with your actual GitHub repository name:
  // basePath: '/YOUR_REPO_NAME',
  // assetPrefix: '/YOUR_REPO_NAME/',
};

export default nextConfig;

