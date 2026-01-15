import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { loadConfig } from '../utils/config.js';
import { downloadFile, getTemplateUrl, getCfrUrl } from '../utils/download.js';
import { startSpinner, success, error, info, warn } from '../utils/ui.js';
import { ConfigError, HytaleError } from '../utils/errors.js';
import { copyDirectory, extractZip, replaceInFiles, askYesNo } from '../utils/fs.js';
import { toPascalCase } from '../utils/string.js';

const TEMPLATE_VERSION = '0.0.1';

export function initCommand(): Command {
  return new Command('init')
    .description('Create a new Hytale plugin project')
    .argument('<project-name>', 'Name for your plugin project')
    .option('--with-cfr', 'Download CFR and generate reference sources (takes ~10 minutes)')
    .option('--skip-git', 'Skip git initialization')
    .action(async (projectName: string, options) => {
      try {
        console.log(`\n🚀 Creating new Hytale plugin project: ${projectName}\n`);

        // Verify setup has been run
        const config = await loadConfig();
        if (!config) {
          throw new ConfigError(
            'HYT is not configured. Please run "hyt setup" first.'
          );
        }

        // Define paths
        const workspaceDir = process.cwd();
        const projectDir = path.join(workspaceDir, projectName);
        const serverDir = path.join(projectDir, 'Server');
        const pluginsDir = path.join(serverDir, 'Plugins');
        const pluginSourceDir = path.join(pluginsDir, projectName);
        const modsDir = path.join(projectDir, 'mods');

        // Check if directory already exists
        let savedCfrPath: string | null = null;
        try {
          await fs.access(projectDir);
          
          // Directory exists, ask for confirmation
          warn(`\nDirectory "${projectName}" already exists.`);
          console.log('⚠️  This will DELETE the existing project and create a new one.');
          
          // Check if CFR sources exist
          const existingSrcRef = path.join(projectDir, 'Server', 'Plugins', 'src-ref');
          let hasCfrSources = false;
          try {
            const stats = await fs.stat(existingSrcRef);
            if (stats.isDirectory()) {
              const files = await fs.readdir(existingSrcRef);
              hasCfrSources = files.length > 0;
              if (hasCfrSources) {
                info('📚 Detected existing reference sources - they will be preserved');
              }
            }
          } catch {
            // No CFR sources, continue
          }
          
          const answer = await askYesNo('\nDo you want to continue?');
          
          if (!answer) {
            info('Operation cancelled.');
            process.exit(0);
          }
          
          // Save CFR sources if they exist
          if (hasCfrSources) {
            savedCfrPath = path.join(process.cwd(), `.hyt-temp-cfr-${Date.now()}`);
            const saveSpinner = startSpinner('Saving reference sources...');
            await fs.rename(existingSrcRef, savedCfrPath);
            saveSpinner.succeed('Reference sources saved');
          }
          
          // Delete existing directory
          const deleteSpinner = startSpinner('Removing existing project...');
          await fs.rm(projectDir, { recursive: true, force: true });
          deleteSpinner.succeed('Existing project removed');
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
          // Directory doesn't exist, continue normally
        }

        // Create workspace structure
        const structureSpinner = startSpinner('Creating workspace structure...');
        await fs.mkdir(projectDir, { recursive: true });
        await fs.mkdir(serverDir, { recursive: true });
        await fs.mkdir(pluginsDir, { recursive: true });
        await fs.mkdir(modsDir, { recursive: true });
        structureSpinner.succeed('Workspace structure created');

        // Copy server files from Hytale installation
        const copySpinner = startSpinner('Copying server files from Hytale installation...');
        const hytaleServerPath = path.join(config.hytaleInstallPath, 'Server');
        const hytaleAssetsPath = path.join(config.hytaleInstallPath, 'Assets.zip');
        
        try {
          // Copy Server folder
          await copyDirectory(hytaleServerPath, serverDir);
          // Copy Assets.zip
          await fs.copyFile(hytaleAssetsPath, path.join(projectDir, 'Assets.zip'));
          copySpinner.succeed('Server files copied');
        } catch (err) {
          copySpinner.fail('Failed to copy server files');
          throw new HytaleError(
            `Could not copy server files from Hytale installation. ` +
            `Make sure "${config.hytaleInstallPath}" contains Server/ and Assets.zip`
          );
        }

        // Download template
        const templateSpinner = startSpinner('Downloading plugin template...');
        const templateZipPath = path.join(pluginsDir, 'template.zip');
        try {
          await downloadFile(getTemplateUrl(), templateZipPath);
          templateSpinner.succeed('Template downloaded');
        } catch (err) {
          templateSpinner.fail('Failed to download template');
          throw new HytaleError(
            `Could not download plugin template. Check your internet connection.`
          );
        }

        // Extract template
        const extractSpinner = startSpinner('Extracting template...');
        try {
          await extractZip(templateZipPath, pluginsDir);
          // Rename extracted folder to project name
          const extractedDir = path.join(pluginsDir, `example-mod-${TEMPLATE_VERSION}`);
          await fs.rename(extractedDir, pluginSourceDir);
          // Clean up zip
          await fs.unlink(templateZipPath);
          extractSpinner.succeed('Template extracted');
        } catch (err) {
          extractSpinner.fail('Failed to extract template');
          throw err;
        }

        // Update project name in template files
        const renameSpinner = startSpinner('Configuring project name...');
        const packageName = projectName.toLowerCase().replace(/-/g, '_');
        await replaceInFiles(pluginSourceDir, 'ExamplePlugin', toPascalCase(projectName));
        await replaceInFiles(pluginSourceDir, 'example-mod', projectName);
        await replaceInFiles(pluginSourceDir, 'org.example', `com.${packageName}`);
        
        // Rename the main Java file to match the new class name
        const pascalName = toPascalCase(projectName);
        const oldJavaFile = path.join(pluginSourceDir, 'app', 'src', 'main', 'java', 'org', 'example', 'ExamplePlugin.java');
        const newJavaFile = path.join(pluginSourceDir, 'app', 'src', 'main', 'java', 'org', 'example', `${pascalName}.java`);
        
        try {
          await fs.rename(oldJavaFile, newJavaFile);
        } catch {
          // File might already be renamed or in different location
        }
        
        // Rename the test file to match the new class name
        const oldTestFile = path.join(pluginSourceDir, 'app', 'src', 'test', 'java', 'org', 'example', 'ExamplePluginTest.java');
        const newTestFile = path.join(pluginSourceDir, 'app', 'src', 'test', 'java', 'org', 'example', `${pascalName}Test.java`);
        
        try {
          await fs.rename(oldTestFile, newTestFile);
        } catch {
          // File might already be renamed or in different location
        }
        
        // Rename package directory structure from org/example to com/packageName
        const mainJavaDir = path.join(pluginSourceDir, 'app', 'src', 'main', 'java');
        const testJavaDir = path.join(pluginSourceDir, 'app', 'src', 'test', 'java');
        
        // Create new package structure
        const newPackageDir = path.join('com', packageName);
        const newMainPackageDir = path.join(mainJavaDir, newPackageDir);
        const newTestPackageDir = path.join(testJavaDir, newPackageDir);
        
        await fs.mkdir(newMainPackageDir, { recursive: true });
        await fs.mkdir(newTestPackageDir, { recursive: true });
        
        // Move files from org/example to com/packageName
        const oldMainPackageDir = path.join(mainJavaDir, 'org', 'example');
        const oldTestPackageDir = path.join(testJavaDir, 'org', 'example');
        
        try {
          const mainFiles = await fs.readdir(oldMainPackageDir);
          for (const file of mainFiles) {
            await fs.rename(
              path.join(oldMainPackageDir, file),
              path.join(newMainPackageDir, file)
            );
          }
          // Clean up old directory structure
          await fs.rm(path.join(mainJavaDir, 'org'), { recursive: true, force: true });
        } catch {
          // Directory might not exist or already moved
        }
        
        try {
          const testFiles = await fs.readdir(oldTestPackageDir);
          for (const file of testFiles) {
            await fs.rename(
              path.join(oldTestPackageDir, file),
              path.join(newTestPackageDir, file)
            );
          }
          // Clean up old directory structure
          await fs.rm(path.join(testJavaDir, 'org'), { recursive: true, force: true });
        } catch {
          // Directory might not exist or already moved
        }
        
        renameSpinner.succeed('Project name configured');

        // Download CFR (optional)
        if (options.withCfr) {
          const cfrSpinner = startSpinner('Downloading CFR decompiler...');
          const cfrPath = path.join(serverDir, 'cfr.jar');
          try {
            await downloadFile(getCfrUrl(), cfrPath);
            cfrSpinner.succeed('CFR decompiler downloaded');

            // Generate reference sources with live timer
            const srcRefDir = path.join(pluginsDir, 'src-ref');
            await fs.mkdir(srcRefDir, { recursive: true });
            
            info('⏱️  Generating reference sources (this may take several minutes)...');
            
            try {
              const startTime = Date.now();
              
              // Create a spinner with live updates
              const refSpinner = startSpinner('Generating reference sources...');
              
              // Update spinner text every second
              const timerInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                refSpinner.text = `Generating reference sources... (${elapsed}s elapsed)`;
              }, 1000);

              try {
                await execa(config.javaPath, [
                  '-jar', cfrPath,
                  path.join(serverDir, 'HytaleServer.jar'),
                  '--outputdir', srcRefDir
                ], { 
                  cwd: serverDir,
                  stdio: 'pipe',
                });
              } finally {
                clearInterval(timerInterval);
              }

              const elapsed = Math.round((Date.now() - startTime) / 1000);
              refSpinner.succeed(`Reference sources generated in ${elapsed}s`);
            } catch {
              warn('Reference source generation failed (non-critical)');
            }
          } catch {
            cfrSpinner.warn('CFR download failed (non-critical, you can download manually)');
          }
        }

        // Restore saved CFR sources if they exist
        if (savedCfrPath) {
          const restoreSpinner = startSpinner('Restoring reference sources...');
          const srcRefDir = path.join(pluginsDir, 'src-ref');
          try {
            await fs.rename(savedCfrPath, srcRefDir);
            restoreSpinner.succeed('Reference sources restored');
          } catch (err) {
            restoreSpinner.fail('Failed to restore reference sources');
            // Clean up temp directory
            try {
              await fs.rm(savedCfrPath, { recursive: true, force: true });
            } catch {}
          }
        }

        // Initialize git (optional)
        if (!options.skipGit) {
          const gitSpinner = startSpinner('Initializing git repository...');
          try {
            await execa('git', ['init'], { cwd: pluginSourceDir });
            
            // Create .gitignore
            const gitignore = `# Build outputs
build/
.gradle/

# IDE
.idea/
*.iml
.vscode/

# OS
.DS_Store
Thumbs.db
`;
            await fs.writeFile(path.join(pluginSourceDir, '.gitignore'), gitignore);
            gitSpinner.succeed('Git repository initialized');
          } catch {
            gitSpinner.warn('Git initialization failed (git may not be installed)');
          }
        } else {
          info('Skipping git initialization');
        }

        // Success!
        success('\n✨ Project created successfully!');
        console.log(`
📁 Project structure:
   ${projectName}/
   ├── Assets.zip
   ├── mods/                  # Compiled plugins go here
   └── Server/
       ├── HytaleServer.jar
       └── Plugins/
           └── ${projectName}/   # Your plugin source code

🚀 Next steps:
   cd ${projectName}/Server/Plugins/${projectName}
   hyt build                  # Build your plugin
   hyt dev                    # Start development mode

📖 Plugin source is in: Server/Plugins/${projectName}/app/src/

💡 Generate decompiled reference sources to explore the Hytale API
   hyt generate-references    # Takes ~10 minutes
`);
        process.exit(0);

      } catch (err) {
        if (err instanceof ConfigError || err instanceof HytaleError) {
          error(err.message);
        } else {
          error(`Init failed: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    });
}
