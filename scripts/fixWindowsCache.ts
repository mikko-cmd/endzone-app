import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import path from 'path';

function fixWindowsCache() {
    console.log('🔧 Fixing Windows Next.js cache issues...');

    try {
        // Force stop any running Next.js processes
        try {
            execSync('taskkill /f /im node.exe', { stdio: 'ignore' });
            console.log('✅ Stopped running Node processes');
        } catch (e) {
            // Process might not be running, continue
        }

        // Wait a moment for file handles to release
        setTimeout(() => {
            // Remove problematic directories
            const dirsToClean = ['.next', 'node_modules/.cache'];

            for (const dir of dirsToClean) {
                if (existsSync(dir)) {
                    try {
                        rmSync(dir, { recursive: true, force: true });
                        console.log(`✅ Cleaned ${dir}`);
                    } catch (error) {
                        console.log(`⚠️  Could not clean ${dir}: ${error}`);
                    }
                }
            }

            // Clear npm cache
            try {
                execSync('npm cache clean --force', { stdio: 'inherit' });
                console.log('✅ Cleared npm cache');
            } catch (error) {
                console.log(`⚠️  Could not clear npm cache: ${error}`);
            }

            console.log('🎉 Windows cache fix complete! Run "npm run dev" to restart.');
        }, 2000);

    } catch (error) {
        console.error('❌ Error during cache fix:', error);
    }
}

fixWindowsCache(); 