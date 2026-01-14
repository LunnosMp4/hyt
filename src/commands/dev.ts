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

export function devCommand(): Command {
  return new Command('dev')
    .description('Start development mode with hot reload')
    .option('--no-initial-build', 'Skip initial build on startup')
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
            'Make sure you are in your plugin directory (e.g., Server/Plugins/your-plugin/)'
          );
        }

        // Determine project structure
        // Expected: we're in project/Server/Plugins/plugin-name/
        // Project root: ../../../
        // Server dir: ../../
        const projectRoot = path.resolve(projectDir, '..', '..', '..');
        const serverDir = path.resolve(projectDir, '..', '..');
        const modsDir = path.join(projectRoot, 'mods');
        const serverJarPath = path.join(serverDir, 'HytaleServer.jar');
        const assetsPath = path.join(projectRoot, 'Assets.zip');

        // Verify required files exist
        try {
          await fs.access(serverJarPath);
          await fs.access(assetsPath);
        } catch {
          throw new HytaleError(
            'Hytale server files not found.\n' +
            `Expected structure:\n` +
            `  - Server/HytaleServer.jar\n` +
            `  - Assets.zip\n` +
            `Make sure you ran "hyt init" to create the project structure.`
          );
        }

        // Initial build
        if (options.initialBuild !== false) {
          info('Running initial build...\n');
          try {
            await runGradleBuild(projectDir);
            success('✔ Initial build complete\n');
          } catch (err) {
            throw new GradleError('Initial build failed. Fix the errors and try again.');
          }

          // Copy JAR to mods folder
          await copyJarToMods(projectDir, modsDir);
        }

        // Start Hytale server
        info('Starting Hytale server...\n');
        const serverOptions = {
          javaPath: config.javaPath,
          serverJarPath,
          assetsPath,
          workingDir: projectRoot,
        };

        try {
          await launchHytaleServer(serverOptions);
          success('✔ Hytale server started\n');
          console.log('📝 Once the server console is ready, run the authentication command:');
          console.log('   /auth login device\n');
        } catch (err) {
          throw new HytaleError(`Failed to start server: ${(err as Error).message}`);
        }

        // Start watching for file changes
        info('👀 Watching for file changes...\n');
        console.log('Press Ctrl+C to stop development mode\n');

        const srcDir = path.join(projectDir, 'app', 'src');
        
        watcher = watchFiles(srcDir, {
          onFileChange: async (filePath: string) => {
            if (isRebuilding) {
              return; // Avoid concurrent rebuilds
            }

            isRebuilding = true;
            const fileName = path.basename(filePath);
            console.log(`\n📝 File changed: ${fileName}`);

            try {
              // Rebuild
              const buildSpinner = startSpinner('Rebuilding...');
              await runGradleBuild(projectDir);
              buildSpinner.succeed('Build complete');

              // Copy new JAR
              await copyJarToMods(projectDir, modsDir);

              // Restart server
              if (isServerRunning()) {
                const restartSpinner = startSpinner('Restarting server...');
                await restartHytaleServer(serverOptions);
                restartSpinner.succeed('Server restarted');
                console.log('💡 Remember to authenticate: /auth login device\n');
              } else {
                warn('Server not running, starting it...');
                await launchHytaleServer(serverOptions);
                console.log('💡 Remember to authenticate: /auth login device\n');
              }

              success('✨ Hot reload complete!\n');
            } catch (err) {
              if (err instanceof GradleError) {
                error(`Build failed: ${err.message}`);
              } else {
                error(`Hot reload failed: ${(err as Error).message}`);
              }
              info('Fix the errors and save again to rebuild.\n');
            } finally {
              isRebuilding = false;
            }
          },
        });

        // Handle graceful shutdown
        const cleanup = async () => {
          console.log('\n\n🛑 Shutting down...');
          
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
    
    await fs.copyFile(srcPath, destPath);
    info(`✔ Copied ${jarFile} to mods/`);
  } catch (err) {
    throw new GradleError(`Failed to copy JAR: ${(err as Error).message}`);
  }
}
