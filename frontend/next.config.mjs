/**
 * The browser only ever talks to Next (same origin). /api/* is proxied to the
 * Node/Express REST API, so there is no CORS dance and the API URL lives in one place.
 */
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:5000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
