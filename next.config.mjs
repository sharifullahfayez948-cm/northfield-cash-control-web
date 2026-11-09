const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NORTHFIELD_BUILD_DIR || ".next",
  ...(process.env.NORTHFIELD_LOCAL_BUILD
    ? { cleanDistDir: false, experimental: { webpackBuildWorker: false } }
    : {}),
};
export default nextConfig;
