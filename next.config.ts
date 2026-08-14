import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Defense-in-depth against
 * clickjacking, MIME sniffing, and referrer/permission leakage. A strict
 * CSP is intentionally omitted for now because the app relies on Next's
 * inline runtime scripts; revisit with nonces before wider exposure.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
