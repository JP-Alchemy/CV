/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export — required for GitHub Pages
  output: 'export',

  // GitHub Pages serves from a subdirectory when using a repo page
  // (e.g. https://jp-bothma.github.io/my-site → basePath: '/my-site')
  // Leave empty when using a custom domain or a user/org page (username.github.io)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',

  // Next.js image optimisation requires a server; disable for static export
  images: {
    unoptimized: true,
  },

  // Generates /cv/index.html instead of /cv.html — better GitHub Pages compatibility
  trailingSlash: true,

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
