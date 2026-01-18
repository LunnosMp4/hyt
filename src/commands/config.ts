import { Command } from 'commander';
import { loadConfig, saveConfig } from '../utils/config.js';
import { success, error, info } from '../utils/ui.js';
import { ConfigError } from '../utils/errors.js';

export function configCommand(): Command {
  const cmd = new Command('config')
    .description('Manage HYT configuration');

  cmd
    .command('get')
    .description('Display current configuration')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `
Examples:
  $ hyt config get
  $ hyt config get --json`)
    .action(async (options: any) => {
      try {
        const config = await loadConfig();
        if (!config) {
          error('No configuration found. Run "hyt setup" first.');
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('\n📋 Current HYT Configuration:\n');
          console.log(`Java Path:         ${config.javaPath}`);
          console.log(`Hytale Install:    ${config.hytaleInstallPath}`);
          if (config.jvmArgs && config.jvmArgs.length > 0) {
            console.log(`JVM Arguments:     ${config.jvmArgs.join(' ')}`);
          } else {
            console.log(`JVM Arguments:     (using defaults: -Xmx2G -Xms1G)`);
          }
          console.log('');
        }
      } catch (err) {
        error(`Failed to read configuration: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  cmd
    .command('set-jvm-args')
    .description('Set JVM arguments for the Hytale server (heap size, GC tuning, etc.)')
    .argument('[args...]', 'JVM arguments (e.g., -Xmx4G -Xms2G)')
    .option('--reset', 'Reset to default JVM arguments (-Xmx2G -Xms1G)')
    .allowUnknownOption()
    .addHelpText('after', `
Examples:
  $ hyt config set-jvm-args -Xmx4G -Xms2G
    Increase max heap to 4GB, initial to 2GB
  $ hyt config set-jvm-args -Xmx8G -Xms4G -XX:+UseG1GC
    Use 8GB max with G1 garbage collector
  $ hyt config set-jvm-args --reset
    Reset to default arguments`)
    .action(async (args: string[], options: any) => {
      try {
        const config = await loadConfig();
        if (!config) {
          error('No configuration found. Run "hyt setup" first.');
          process.exit(1);
        }

        if (options.reset) {
          delete config.jvmArgs;
          await saveConfig(config);
          success('✔ JVM arguments reset to defaults (-Xmx2G -Xms1G)');
        } else if (args.length === 0) {
          error('Please provide JVM arguments or use --reset to restore defaults.');
          console.log('\nExamples:');
          console.log('  hyt config set-jvm-args -Xmx4G -Xms2G');
          console.log('  hyt config set-jvm-args -Xmx8G -Xms4G -XX:+UseG1GC');
          console.log('  hyt config set-jvm-args --reset');
          process.exit(1);
        } else {
          // Validate args start with - or --
          const invalidArgs = args.filter(arg => !arg.startsWith('-'));
          if (invalidArgs.length > 0) {
            error(`Invalid JVM arguments: ${invalidArgs.join(', ')}`);
            console.log('JVM arguments should start with - or --');
            process.exit(1);
          }

          config.jvmArgs = args;
          await saveConfig(config);
          success(`✔ JVM arguments updated: ${args.join(' ')}`);
        }

        console.log('');
      } catch (err) {
        if (err instanceof ConfigError) {
          error(err.message);
        } else {
          error(`Failed to update configuration: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });

  return cmd;
}
