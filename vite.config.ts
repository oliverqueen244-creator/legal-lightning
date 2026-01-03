import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "favicon.ico", "robots.txt", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Nyay-Hub — Litigation Operating System",
        short_name: "Nyay-Hub",
        description: "Litigation Operating System for Rajasthan High Court. Connection-aware design ensures accurate court information.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["productivity", "business"],
        icons: [
          {
            src: "/favicon.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        // INSTALLABILITY SAFETY: No shortcuts that imply offline works fully
        shortcuts: [
          {
            name: "Today's Docket",
            short_name: "Docket",
            url: "/",
            description: "View today's court schedule",
          },
        ],
      },
      workbox: {
        // SAFE PWA AUTO-UPDATE: Take control immediately when new SW activates
        clientsClaim: true,
        // SAFE PWA AUTO-UPDATE: Skip waiting - new SW activates immediately
        // Note: Actual reload is controlled by usePWAUpdate safety checks
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
        runtimeCaching: [
          // P1 FIX: Supabase REST API - ALWAYS NetworkFirst (never serve stale court data)
          {
            urlPattern: /^https:\/\/.*supabase.*\/rest\/v1\//i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes max
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // P1 FIX: Supabase Realtime/Auth - NetworkOnly (never cache)
          {
            urlPattern: /^https:\/\/.*supabase.*\/(auth|realtime)\//i,
            handler: "NetworkOnly",
          },
          // P1 FIX: Live Board endpoints - NetworkFirst with short cache
          {
            urlPattern: /^https:\/\/.*supabase.*\/functions\/v1\/(sync-live-board|scrape-live-board)/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "live-board-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60, // 1 minute max
              },
            },
          },
          // P1 FIX: Other Edge Functions - NetworkFirst
          {
            urlPattern: /^https:\/\/.*supabase.*\/functions\/v1\//i,
            handler: "NetworkFirst",
            options: {
              cacheName: "edge-functions-cache",
              networkTimeoutSeconds: 15,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 10, // 10 minutes
              },
            },
          },
          // Cache PDF documents
          {
            urlPattern: /\.pdf$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "pdf-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache Supabase storage (documents) - StaleWhileRevalidate is OK for static files
          {
            urlPattern: /^https:\/\/.*supabase.*\/storage\//i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));