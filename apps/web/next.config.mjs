/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@surface-studio/engine', '@surface-studio/studio'],
  reactStrictMode: true,
  poweredByHeader: false,
};
export default nextConfig;
