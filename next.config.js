/** @type {import('next').NextConfig} */
const nextConfig = {
    // Windows-specific optimizations
    experimental: {
        // Reduce file system pressure on Windows
        webpackBuildWorker: false,
        // Optimize for Windows file system
        optimizeServerReact: false,
    },

    // Webpack optimizations for Windows
    webpack: (config, { dev, isServer }) => {
        if (dev) {
            // Reduce file system operations in development
            config.watchOptions = {
                poll: 1000, // Check for changes every second instead of real-time
                aggregateTimeout: 300,
                ignored: /node_modules/,
            };

            // Windows-specific cache optimizations
            config.cache = {
                type: 'memory', // Use memory cache instead of filesystem
            };
        }

        return config;
    },

    // Reduce concurrent file operations
    onDemandEntries: {
        maxInactiveAge: 25 * 1000,
        pagesBufferLength: 2,
    },
};

export default nextConfig; 