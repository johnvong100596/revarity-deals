/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    largePageDataBytes: 512 * 1024,
    // Optional cloud deps — resolved at runtime in cloud deploys only, never bundled
    // so the default `fs` build doesn't require them to be installed.
    serverComponentsExternalPackages: ["@vercel/blob"],
  },
};
export default nextConfig;
