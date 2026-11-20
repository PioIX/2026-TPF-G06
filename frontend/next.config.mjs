/** @type {import('next').NextConfig} 
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,
};

export default nextConfig;
*/


/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,

  turbopack: {
    root: process.cwd(),
  },

  allowedDevOrigins: ["192.168.56.1"],
};

export default nextConfig;
