/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
      },
    ];
  },
};

export default nextConfig;
