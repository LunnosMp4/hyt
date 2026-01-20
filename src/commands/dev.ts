import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig } from '../utils/config.js';
import { runGradleBuild, hasGradleWrapper } from '../utils/gradle.js';
import { getBuildOutputDir } from '../utils/paths.js';
import { watchFiles, stopWatcher } from '../utils/watcher.js';
import { launchHytaleServer, stopHytaleServer, restartHytaleServer, isServerRunning } from '../utils/server.js';
import { startSpinner, success, error, info, warn } from '../utils/ui.js';
import { ConfigError, GradleError, HytaleError } from '../utils/errors.js';
import type { FSWatcher } from 'chokidar';

let isRebuilding = false;
let watcher: FSWatcher | null = null;
let rebuildTimeout: NodeJS.Timeout | null = null;

export function devCommand(): Command {
  return new Command('dev')
    .description('Start development mode')
    .option('--no-initial-build', 'Skip initial build on startup')
    .option('--watch', 'Enable auto-rebuild on file changes')
    .option('--debounce <seconds>', 'Seconds to wait after last change before rebuilding (default: 5)', '5')
    .option('--dir <directory>', 'Root directory for server and mods.')
    .action(async (options) => {
      try {
        console.log('\n🔥 Starting development mode...\n');

        // Verify setup has been run
        const config = await loadConfig();
        if (!config) {
          throw new ConfigError(
            'HYT is not configured. Please run "hyt setup" first.'
          );
        }

        // Check if we're in a valid plugin directory
        const projectDir = process.cwd();
        if (!(await hasGradleWrapper(projectDir))) {
          throw new GradleError(
            'No Gradle wrapper found in current directory.\n' +
            'Make sure you are in your plugin project root directory'
          );
        }

        // Determine project structure (new layout)
        // Expected: we're in project root (where gradlew is)
        // Server: ./server/Server/
        // Mods: ./mods/
        
        const modsDir = path.join(options.dir || projectDir, 'mods');
        const serverDir = path.join(options.dir || projectDir, 'server', 'Server');
        const serverJarPath = path.join(serverDir, 'HytaleServer.jar');
        const assetsPath = path.join(options.dir || projectDir, 'Assets.zip');

        try {
          await fs.access(serverJarPath);
          await fs.access(assetsPath);
        } catch {
          throw new HytaleError(
            'Hytale server files not found.\n' +
            `Expected structure in ${options.dir || projectDir}:\n` +
            `  - server/Server/HytaleServer.jar\n` +
            `  - Assets.zip\n` +
            `Make sure you ran "hyt init" to create the project structure.`
          );
        }

        // Initial build and copy (always done unless --no-initial-build)
        if (options.initialBuild !== false) {
          info('Building plugin before starting server...\n');
          try {
            await runGradleBuild(projectDir);
            success('✔ Build complete\n');
          } catch (err) {
            throw new GradleError('Initial build failed. Fix the errors and try again.');
          }

          // Copy JAR to mods folder
          await copyJarToMods(projectDir, modsDir);
          console.log('');
        }

        // Start Hytale server
        info('Starting Hytale server...\n');
        // Use JVM args from config, or fall back to defaults
        const defaultJvmArgs = ['-Xmx2G', '-Xms1G'];
        const serverOptions = {
          javaPath: config.javaPath,
          serverJarPath,
          assetsPath,
          workingDir: options.dir || projectDir,
          jvmArgs: config.jvmArgs || defaultJvmArgs,
        };

        try {
          launchHytaleServer(serverOptions);
          success('✔ Hytale server started\n');
          console.log('📝 Once the server console is ready, run the authentication command:');
          console.log('   /auth login device\n');
        } catch (err) {
          throw new HytaleError(`Failed to start server: ${(err as Error).message}`);
        }

        // Start watching for file changes (only if --watch flag is provided)
        if (options.watch) {
          info('👀 Watching for file changes...\n');
          console.log('💡 Files will auto-rebuild to check for errors.');
          console.log('⚠️  You need to restart the server manually to apply plugin changes.');
          console.log('Press Ctrl+C to stop development mode\n');

          const debounceMs = parseInt(options.debounce) * 1000;
          const srcDir = path.join(projectDir, 'app', 'src');
          
          watcher = watchFiles(srcDir, {
            onFileChange: async (filePath: string) => {
              if (isRebuilding) {
                return;
              }

              if (rebuildTimeout) {
                clearTimeout(rebuildTimeout);
              }

              const fileName = path.basename(filePath);
              console.log(`\n📝 ${fileName} changed`);

              rebuildTimeout = setTimeout(async () => {
                isRebuilding = true;

                try {
                  // Rebuild with force to ensure changes are compiled
                  const buildSpinner = startSpinner('Building...');
                  await runGradleBuild(projectDir, true); // Force rebuild
                  buildSpinner.succeed('Build complete');

                  // Copy new JAR
                  await copyJarToMods(projectDir, modsDir);

                  success('✨ Build successful! Restart server with Ctrl+C to apply changes.\n');
                } catch (err) {
                  if (err instanceof GradleError) {
                    error(`Build failed: ${err.message}`);
                  } else {
                    error(`Build failed: ${(err as Error).message}`);
                  }
                  info('Fix the errors and save again.\n');
                } finally {
                  isRebuilding = false;
                }
              }, debounceMs);
            },
          });
        } else {
          console.log('💡 Auto-rebuild disabled. Restart with Ctrl+C when you make changes.');
          console.log('💡 Use --watch to enable live error checking during development.');
          console.log('Press Ctrl+C to stop the server\n');
        }

        const cleanup = async () => {
          console.log('\n\n🛑 Shutting down...');
          
          if (rebuildTimeout) {
            clearTimeout(rebuildTimeout);
          }
          
          if (watcher) {
            await stopWatcher(watcher);
            watcher = null;
          }
          
          await stopHytaleServer();
          
          console.log('✔ Development mode stopped\n');
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Keep process alive
        await new Promise(() => {});

      } catch (err) {
        if (err instanceof ConfigError || err instanceof GradleError || err instanceof HytaleError) {
          error(err.message);
        } else {
          error(`Dev mode failed: ${(err as Error).message}`);
        }
        
        // Cleanup on error
        if (rebuildTimeout) {
          clearTimeout(rebuildTimeout);
        }
        if (watcher) {
          await stopWatcher(watcher);
        }
        await stopHytaleServer();
        
        process.exit(1);
      }
    });
}

async function copyJarToMods(projectDir: string, modsDir: string): Promise<void> {
  const buildOutputDir = getBuildOutputDir(path.join(projectDir, 'app'));
  
  try {
    await fs.mkdir(modsDir, { recursive: true });
    
    const files = await fs.readdir(buildOutputDir);
    const jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources'));
    
    if (!jarFile) {
      throw new Error('JAR file not found in build output');
    }
    
    const srcPath = path.join(buildOutputDir, jarFile);
    const destPath = path.join(modsDir, jarFile);
    
    // Verify source file exists
    await fs.access(srcPath);
    
    // Copy the file
    await fs.copyFile(srcPath, destPath);
    
    // Verify destination file exists
    await fs.access(destPath);
    
    info(`✔ Copied ${jarFile} to ${destPath}`);
  } catch (err) {
    error(`Failed to copy JAR: ${(err as Error).message}`);
    error(`Source: ${buildOutputDir}`);
    error(`Destination: ${modsDir}`);
    throw new GradleError(`Failed to copy JAR: ${(err as Error).message}`);
  }
}
