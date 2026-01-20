import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { runGradleBuild, hasGradleWrapper } from '../utils/gradle.js';
import { getBuildOutputDir } from '../utils/paths.js';
import { startSpinner, success, error, info } from '../utils/ui.js';
import { GradleError } from '../utils/errors.js';

export function buildCommand(): Command {
  return new Command('build')
    .description('Build your Hytale plugin')
    .option('--no-copy', 'Skip copying built JAR to mods folder after build')
    .option('--dir <directory>', 'Root directory for server and mods.')
    .action(async (options) => {
      try {
        const projectDir = process.cwd();
        
        console.log('\n🔨 Building Hytale plugin...\n');

        // Check if we're in a valid plugin directory
        if (!(await hasGradleWrapper(projectDir))) {
          throw new GradleError(
            'No Gradle wrapper found in current directory.\n' +
            'Make sure you are in your plugin project root directory'
          );
        }

        // Run Gradle build
        info('Running Gradle build...\n');
        await runGradleBuild(projectDir);

        // Find the built JAR
        const buildOutputDir = getBuildOutputDir(path.join(projectDir, 'app'));
        let jarFile: string | null = null;

        try {
          const files = await fs.readdir(buildOutputDir);
          jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources')) || null;
        } catch {
          // Build output dir might not exist if build failed
        }

        if (!jarFile) {
          throw new GradleError(
            'Build completed but no JAR file found.\n' +
            `Expected location: ${buildOutputDir}`
          );
        }

        const jarPath = path.join(buildOutputDir, jarFile);
        success(`\n✨ Build successful!`);
        console.log(`\n📦 Output: ${jarPath}`);

        // Copy to mods folder by default (unless --no-copy is specified)
        if (options.copy !== false) {
          const copySpinner = startSpinner('Copying JAR to mods folder...');
          
          // New structure: mods folder is directly in project root
          const modsDir = path.resolve(options.dir || projectDir, 'mods');
          
          try {
            await fs.access(modsDir);
            const destPath = path.join(modsDir, jarFile);
            await fs.copyFile(jarPath, destPath);
            copySpinner.succeed(`Copied to ${destPath}`);
          } catch {
            copySpinner.fail('Could not find mods folder. Copy manually.');
          }
        } else {
          info('Skipped copying JAR (--no-copy flag used)');
        }

        console.log(`\n🚀 Ready to test in mods/ folder`);

        process.exit(0);

      } catch (err) {
        if (err instanceof GradleError) {
          error(err.message);
        } else {
          error(`Build failed: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });
}
