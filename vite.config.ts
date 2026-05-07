import { defineConfig } from 'vite';

// Yandex Games requires fully relative asset paths inside the uploaded zip.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    // `terser` produces a noticeably smaller JS bundle than esbuild
    // (extra constant-folding + property hoisting passes). The bundle is
    // shipped to Yandex Games inside a zip with a hard size budget, so
    // every kilobyte counts. We only run terser on the production build —
    // dev still uses esbuild via the default fast path.
    minify: 'terser',
    terserOptions: {
      ecma: 2020,
      // The bundle is emitted as a single ESM chunk, so terser can
      // safely treat top-level identifiers as renameable (they're not
      // globals). Combined with `compress.toplevel`, this removes
      // top-level dead bindings the bundler couldn't statically prove
      // unused.
      module: true,
      compress: {
        // Two passes lets terser pick up dead code that becomes
        // unreachable only after the first round of inlining (e.g.
        // `if (false)` branches synthesised from inlined consts).
        passes: 2,
        // Strip dev logging from the production bundle. The wrappers we
        // ship (`yandex.ts`, `i18n/index.ts`) only `console.warn` from
        // catch-blocks for non-fatal SDK fallbacks — losing the
        // diagnostic noise is fine in prod and saves ~1KB raw.
        drop_console: true,
        drop_debugger: true,
        // Allow dead-code elimination of unused top-level functions and
        // vars. Safe because `module: true` already renames them — we
        // never reach into the bundle by name from outside.
        toplevel: true,
      },
      mangle: {
        // Mangle top-level names. `module: true` above guarantees we
        // own the namespace; nothing dynamically reads the bundle's
        // own identifiers.
        toplevel: true,
        // Keep the `__proto__` and `constructor` slots — anything else
        // is fair game.
      },
      format: {
        // We don't ship third-party code that requires legal comment
        // preservation, so dropping the `/*! … */` blocks shrinks the
        // file a touch more.
        comments: false,
      },
    },
    // CSS minification stays on the default esbuild minifier — we tried
    // `lightningcss` for ~10–15% extra compression but it threw on a
    // non-standard token in the source CSS. Esbuild handles every rule
    // in the file without modification, so it stays the default.
    // Skips a (slow) gzip pass over the final bundle just to print the
    // gzipped size in the build log. Doesn't affect output size — only
    // build-time metrics.
    reportCompressedSize: false,
    // The hand-written game state machine + sprite bake-once tables
    // legitimately tip past Vite's default 500KB chunk-warning. Bumping
    // the threshold avoids a noisy CI log without hiding genuine
    // regressions: future PRs will still trigger the warning if they
    // add another ~1MB of code.
    chunkSizeWarningLimit: 1000,
  },
  esbuild: {
    // The dev build (vite dev / vite preview) and the dependency
    // pre-bundle pass still go through esbuild. Drop `debugger`
    // statements there too so a `debugger;` left in source can't break
    // a player's first paint.
    drop: ['debugger'],
    legalComments: 'none',
  },
  server: {
    host: true,
    port: 5173,
  },
});
