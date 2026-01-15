import { Command } from 'commander';
import path from 'path';
import { loadConfig, saveConfig, ConfigSchema } from '../utils/config.js';
import { detectJava, validateJavaVersion, verifyJavaPath } from '../utils/java.js';
import { findHytaleInstall, verifyHytaleInstall } from '../utils/hytale.js';
import { downloadAndInstallJava, hasInstalledJava, getJavaExecutablePathAsync } from '../utils/javaDownload.js';
import { startSpinner, success, error, info, warn } from '../utils/ui.js';
import { JavaError, HytaleError, ConfigError } from '../utils/errors.js';
import { askYesNo } from '../utils/fs.js';

export function setupCommand(): Command {
  return new Command('setup')
    .description('Configure HYT with Java and Hytale installation paths')
    .option('--java-path <path>', 'Manually specify Java executable path')
    .option('--hytale-path <path>', 'Manually specify Hytale installation path')
    .action(async (options) => {
      try {
        console.log('🔧 Setting up HYT...\n');

        const existingConfig = await loadConfig();
        const config: Partial<ConfigSchema> = existingConfig || {};
        
        // Validate existing Hytale path in config
        if (config.hytaleInstallPath) {
          const isValid = await verifyHytaleInstall(config.hytaleInstallPath);
          if (!isValid) {
            warn('Existing Hytale path is invalid, will attempt to re-detect');
            config.hytaleInstallPath = undefined;
          }
        }

        let javaPath: string;
        if (options.javaPath) {
          info(`Using manually specified Java path: ${options.javaPath}`);
          javaPath = options.javaPath;
          
          if (!(await verifyJavaPath(javaPath))) {
            throw new JavaError(`Java executable not found at: ${javaPath}`);
          }
        } else {
          if (await hasInstalledJava()) {
            javaPath = await getJavaExecutablePathAsync();
            info(`Using HYT-installed Java at: ${javaPath}`);
          } else {
            const spinner = startSpinner('Detecting Java installation...');
            const detectedJava = await detectJava();
            
            if (!detectedJava) {
              spinner.fail('Java not found in PATH');
              
              console.log('\n💡 Java 25 is required but not found on your system.');
              console.log('Would you like HYT to download and install Java 25 automatically?');
              console.log('(It will be installed to ~/.hyt/java25/ and will not affect your system Java)\n');
              
              const answer = await askYesNo('Download Java 25 now?', true);
              
              if (answer) {
                const downloadSpinner = startSpinner('Downloading Java 25 (this may take a few minutes, ~200MB)...');
                try {
                  javaPath = await downloadAndInstallJava();
                  downloadSpinner.succeed(`Java 25 installed successfully to: ${javaPath}`);
                } catch (err) {
                  downloadSpinner.fail('Failed to download Java');
                  throw new JavaError(
                    `Could not download Java 25: ${(err as Error).message}\n` +
                    'Please install Java manually or use --java-path to specify the location.'
                  );
                }
              } else {
                throw new JavaError(
                  'Java 25 or higher is required. Please install Java manually or use --java-path to specify the location.'
                );
              }
            } else {
              javaPath = detectedJava;
              spinner.succeed(`Found Java at: ${javaPath}`);
            }
          }
        }

        // Validate Java version
        const versionSpinner = startSpinner('Validating Java version...');
        let versionValid = false;
        try {
          await validateJavaVersion(javaPath);
          versionSpinner.succeed('Java version is compatible');
          versionValid = true;
        } catch (err) {
          versionSpinner.fail('Java version check failed');
          
          // If version is incompatible and not manually specified, offer to download
          if (err instanceof JavaError && !options.javaPath) {
            console.log(`\n${(err as JavaError).message}`);
            console.log('\n💡 Would you like HYT to download and install Java 25 automatically?');
            console.log('(It will be installed to ~/.hyt/java25/ and will not affect your system Java)\n');
            
            const answer = await askYesNo('Download Java 25 now?', true);
            
            if (answer) {
              const downloadSpinner = startSpinner('Downloading Java 25 (this may take a few minutes, ~200MB)...');
              try {
                downloadSpinner.stop();
                javaPath = await downloadAndInstallJava();
                success(`Java 25 installed successfully to: ${javaPath}`);
                
                // Validate the downloaded version
                await validateJavaVersion(javaPath);
                versionValid = true;
              } catch (downloadErr) {
                error('Failed to download Java');
                throw new JavaError(
                  `Could not download Java 25: ${(downloadErr as Error).message}\n` +
                  'Please install Java 25 manually or use --java-path to specify the location.'
                );
              }
            } else {
              throw err;
            }
          } else {
            // Manual path specified with wrong version, or other error
            throw err;
          }
        }

        if (!versionValid) {
          throw new JavaError('Java version validation failed');
        }

        config.javaPath = javaPath;

        // Hytale installation detection/validation
        let hytaleInstallPath: string;
        if (options.hytalePath) {
          const cleanPath = path.normalize(options.hytalePath.replace(/['"]/g, ''));
          info(`Using manually specified Hytale path: ${cleanPath}`);
          let basePath = cleanPath;
          
          // Check if the path already ends with the full structure
          const subfolderStructure = path.join('install', 'release', 'package', 'game', 'latest');
          if (!basePath.endsWith(subfolderStructure.replace(/\\/g, path.sep))) {
            const fullPath = path.join(basePath, subfolderStructure);
            const fullPathExists = await verifyHytaleInstall(fullPath);
            
            if (fullPathExists) {
              hytaleInstallPath = fullPath;
              info(`Using Hytale game files at: ${hytaleInstallPath}`);
            } else {
              hytaleInstallPath = basePath;
            }
          } else {
            hytaleInstallPath = basePath;
          }
          
          // Verify path exists and has Assets.zip
          if (!(await verifyHytaleInstall(hytaleInstallPath))) {
            throw new HytaleError(
              `Hytale installation not found at: ${hytaleInstallPath}\n` +
              'Make sure Assets.zip exists in the specified directory.'
            );
          }
        } else {
          // Auto-detect
          const spinner = startSpinner('Detecting Hytale installation...');
          const detectedHytale = await findHytaleInstall();
          
          if (!detectedHytale) {
            spinner.fail('Hytale installation not found');
            throw new HytaleError(
              'Hytale installation not found. Please install Hytale or use --hytale-path to specify the location.'
            );
          }
          
          hytaleInstallPath = detectedHytale;
          spinner.succeed(`Found Hytale at: ${hytaleInstallPath}`);
        }

        config.hytaleInstallPath = hytaleInstallPath;

        // Save configuration
        const saveSpinner = startSpinner('Saving configuration...');
        await saveConfig(config as ConfigSchema);
        saveSpinner.succeed('Configuration saved');

        success('\n✨ HYT setup complete!');
        console.log('\nYou can now use the following commands:');
        console.log('  hyt init <project-name>  - Create a new Hytale plugin project');
        console.log('  hyt build                - Build your plugin');
        console.log('  hyt dev                  - Start development mode with hot reload');

        process.exit(0);

      } catch (err) {
        if (err instanceof JavaError || err instanceof HytaleError || err instanceof ConfigError) {
          error(err.message);
        } else {
          error(`Setup failed: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });
}
