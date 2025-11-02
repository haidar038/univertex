import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    define: {
        "process.env": {},
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Core React libraries
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],

                    // UI components (Radix UI)
                    'ui-components': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-select',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-popover',
                        '@radix-ui/react-alert-dialog',
                        '@radix-ui/react-label',
                        '@radix-ui/react-checkbox',
                        '@radix-ui/react-radio-group',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-toast',
                        '@radix-ui/react-tooltip',
                        '@radix-ui/react-avatar',
                        '@radix-ui/react-separator',
                        '@radix-ui/react-progress',
                        '@radix-ui/react-scroll-area',
                    ],

                    // Supabase and data fetching
                    'data-layer': ['@supabase/supabase-js', '@tanstack/react-query'],

                    // Form and validation
                    'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

                    // Charts
                    'charts': ['recharts'],

                    // Utilities
                    'utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
                },
            },
        },
        chunkSizeWarningLimit: 1000, // Increase warning limit to 1000kb
    },
}));
