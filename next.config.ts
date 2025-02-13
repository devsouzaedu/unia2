import { NextConfig } from 'next';

/** @type {NextConfig} */
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // Ignora erros de lint no build
  },
  typescript: {
    ignoreBuildErrors: true,  // Ignora erros de TypeScript no build
  },
};


export default nextConfig;
