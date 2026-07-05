/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off: el doble montaje de StrictMode en dev pierde el contexto WebGL
  // del canvas 3D de la home (react-three-fiber) y queda en negro.
  reactStrictMode: false,
  transpilePackages: ["@cancerianas/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
