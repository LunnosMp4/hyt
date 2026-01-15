import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { loadConfig } from '../utils/config.js';
import { downloadFile, getCfrUrl } from '../utils/download.js';
import { startSpinner, success, error, info, warn } from '../utils/ui.js';
import { ConfigError, HytaleError } from '../utils/errors.js';
import { directoryExists } from '../utils/fs.js';
export function referencesCommand(): Command {
  return new Command('generate-references')
    .description('Generate decompiled reference sources from Hytale server JAR (takes ~10 minutes)')
    .action(async () => {
      try {
        console.log('\n📚 Generating reference sources...\n');

        // Verify setup has been run
        const config = await loadConfig();
        if (!config) {
          throw new ConfigError(
            'HYT is not configured. Please run "hyt setup" first.'
          );
        }

        // Find project structure
        const cwd = process.cwd();
        
        // Try to locate Server directory
        let serverDir: string;
        let pluginsDir: string;
        
        // Check if we're in plugin directory
        if (await directoryExists(path.join(cwd, 'app'))) {
          // We're in Server/Plugins/plugin-name/
          serverDir = path.resolve(cwd, '..', '..');
          pluginsDir = path.resolve(cwd, '..');
        }
        // Check if we're in Plugins directory
        else if (await directoryExists(path.join(cwd, '..', 'Server'))) {
          serverDir = path.join(cwd, '..', 'Server');
          pluginsDir = path.join(serverDir, 'Plugins');
        }
        // Check if we're in project root
        else if (await directoryExists(path.join(cwd, 'Server'))) {
          serverDir = path.join(cwd, 'Server');
          pluginsDir = path.join(serverDir, 'Plugins');
        }
        else {
          throw new HytaleError(
            'Could not find Hytale server directory.\n' +
            'Run this command from your project root, Plugins directory, or plugin directory.'
          );
        }

        // Verify HytaleServer.jar exists
        const serverJarPath = path.join(serverDir, 'HytaleServer.jar');
        try {
          await fs.access(serverJarPath);
        } catch {
          throw new HytaleError(
            `HytaleServer.jar not found at: ${serverJarPath}\n` +
            'Make sure you ran "hyt init" to set up the project.'
          );
        }

        // Download CFR if not present
        const cfrPath = path.join(serverDir, 'cfr.jar');
        try {
          await fs.access(cfrPath);
          info('Using existing CFR decompiler');
        } catch {
          const cfrSpinner = startSpinner('Downloading CFR decompiler...');
          try {
            await downloadFile(getCfrUrl(), cfrPath);
            cfrSpinner.succeed('CFR decompiler downloaded');
          } catch (err) {
            cfrSpinner.fail('Failed to download CFR');
            throw new HytaleError(
              `Could not download CFR: ${(err as Error).message}`
            );
          }
        }

        // Generate reference sources
        const srcRefDir = path.join(pluginsDir, 'src-ref');
        await fs.mkdir(srcRefDir, { recursive: true });

        info('⏱️  This will take several minutes (typically 5-10 minutes)');
        info('💡 You can continue working in another terminal while this runs\n');

        const startTime = Date.now();
        const refSpinner = startSpinner('Generating reference sources...');

        // Update spinner text every second
        const timerInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          refSpinner.text = `Generating reference sources... (${timeStr} elapsed)`;
        }, 1000);

        try {
          await execa(config.javaPath, [
            '-jar', cfrPath,
            serverJarPath,
            '--outputdir', srcRefDir
          ], {
            cwd: serverDir,
            stdio: 'pipe',
          });

          clearInterval(timerInterval);
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          
          refSpinner.succeed(`Reference sources generated in ${timeStr}`);
          success(`\n✨ Reference sources available at: ${srcRefDir}`);
          console.log('\nYou can now explore the decompiled Hytale API to understand how to use it.\n');
        } catch (err) {
          clearInterval(timerInterval);
          refSpinner.fail('Failed to generate reference sources');
          throw new HytaleError(
            `CFR decompilation failed: ${(err as Error).message}`
          );
        }

        process.exit(0);

      } catch (err) {
        if (err instanceof ConfigError || err instanceof HytaleError) {
          error(err.message);
        } else {
          error(`Reference generation failed: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });
}
