const { withSentryConfig } = require('@sentry/nextjs');
const createNextIntlPlugin = require('next-intl/plugin');
const { getProductionSecurityHeaders } = require('./lib/security/content-security-policy');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const isDev = process.env.NODE_ENV === 'development';

/**
 * Firebase Auth helper host for same-origin `/__/auth/*` proxy.
 * Client `authDomain` should be the app host (e.g. umbrella.okaylegal.ai);
 * this rewrite keeps the handler first-party for Safari / ITP.
 * @see https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
function resolveFirebaseAuthHandlerHost() {
  const explicit = process.env.FIREBASE_AUTH_HANDLER_HOST?.trim()
  if (explicit) return explicit.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  if (projectId) return `${projectId}.firebaseapp.com`
  return null
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Electron
  output: process.env.ELECTRON ? 'export' : undefined,
  trailingSlash: true,
  // Firebase Auth helper HTML uses relative script URLs (handler.js). A trailing
  // slash makes the browser request /__/auth/handler/handler.js → blank page.
  // Keep trailingSlash for app routes; skip the automatic redirect so middleware
  // can keep /__/auth/* without a trailing slash.
  skipTrailingSlashRedirect: true,
  // /api/v1 is handled by app/api/v1/[...path]/route.ts (BFF proxy that
  // forwards HttpOnly session cookies as Bearer tokens). Do not rewrite here —
  // a rewrite bypasses the route handler and hits the backend without auth.
  async rewrites() {
    const handlerHost = resolveFirebaseAuthHandlerHost()
    if (!handlerHost || process.env.ELECTRON) {
      return []
    }
    // beforeFiles: transparent proxy (not a 302) so Safari can complete
    // signInWithRedirect without cross-site storage on *.firebaseapp.com.
    return {
      beforeFiles: [
        {
          source: "/__/auth/:path*",
          destination: `https://${handlerHost}/__/auth/:path*`,
        },
      ],
    }
  },
  async headers() {
    const baselineHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ...getProductionSecurityHeaders(process.env),
    ];

    /** Authenticated shells — avoid stale HTML/JS on mobile Safari after deploys. */
    const noStoreHtml = [
      { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
    ];

    // Firebase Auth helper iframes must be frameable by the same origin.
    // Do not attach DENY / CSP frame-ancestors 'none' — Next merges matching
    // header sources and the last conflict wins, which would break the iframe.
    const authHelperHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    return [
      {
        source: "/app/:path*",
        headers: [...baselineHeaders, ...noStoreHtml],
      },
      {
        source: "/consumer/:path*",
        headers: [...baselineHeaders, ...noStoreHtml],
      },
      {
        // Exclude /__/auth/* so DENY never attaches to Firebase Auth helpers.
        source: "/((?!__/auth).*)",
        headers: baselineHeaders,
      },
      {
        // Root path is not covered by the exclusion pattern above.
        source: "/",
        headers: baselineHeaders,
      },
      {
        source: "/__/auth",
        headers: authHelperHeaders,
      },
      {
        source: "/__/auth/:path*",
        headers: authHelperHeaders,
      },
    ];
  },
  // Disable image optimization for Electron builds
  images: {
    unoptimized: process.env.ELECTRON ? true : false,
    domains: [],
  },
  // Ensure static export works properly
  // Keep development and production artifacts separate. Running `next dev`
  // while validating a production build otherwise lets both processes rewrite
  // the same manifests, which can surface valid routes as PageNotFoundError.
  distDir: process.env.ELECTRON ? 'out' : isDev ? '.next-dev' : '.next',
  transpilePackages: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore'],

  // pdfjs-dist ships a separate ESM worker (import.meta / export) that must not
  // be parsed or minified by webpack/Terser — serve it from public/ instead.
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    if (!isServer && config.optimization?.minimizer) {
      for (const plugin of config.optimization.minimizer) {
        if (plugin?.constructor?.name === "TerserPlugin") {
          const prev = plugin.options?.exclude;
          const exclude = Array.isArray(prev) ? prev : prev ? [prev] : [];
          plugin.options = {
            ...plugin.options,
            exclude: [...exclude, /pdf\.worker/],
          };
        }
      }
    }

    return config;
  },
};

const configWithIntl = withNextIntl(nextConfig);

module.exports = isDev
  ? configWithIntl
  : withSentryConfig(configWithIntl, {
      silent: true,
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    });
