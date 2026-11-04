import type { NextConfig } from 'next';

// GitHub Pages 프로젝트 사이트는 https://<user>.github.io/<repo>/ 아래에서 열린다.
// 배포 워크플로가 PAGES_BASE_PATH=/<repo> 를 넘겨준다 (사용자 도메인이면 빈 값).
const basePath = process.env.PAGES_BASE_PATH || undefined;

// 서버 없이 동작하는 정적 사이트 (기획서 6장)
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath,
};

export default nextConfig;
