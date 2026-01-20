import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { loadConfig } from '../utils/config.js';
import { downloadFile, getTemplateUrl, getCfrUrl, getVineflowerUrl } from '../utils/download.js';
import { startSpinner, success, error, info, warn } from '../utils/ui.js';
import { ConfigError, HytaleError } from '../utils/errors.js';
import { copyDirectory, extractZip, replaceInFiles, askYesNo } from '../utils/fs.js';
import { toPascalCase } from '../utils/string.js';

const TEMPLATE_VERSION = '1.0.0';

type Decompiler = 'cfr' | 'vineflower';

export function initCommand(): Command {
  return new Command('init')
    .description('Create a new Hytale plugin project')
    .argument('<project-name>', 'Name for your plugin project')
    .option('--decompiler <type>', 'Generate reference sources with specified decompiler: cfr or vineflower (takes ~10 minutes)')
    .option('--without-docs', 'Remove documentation examples from the project')
    .option('--skip-git', 'Skip git initialization')
    .option('--dir <directory>', 'Root directory for server and mods.')
    .action(async (projectName: string, options: { decompiler?: string; withoutDocs?: boolean; skipGit?: boolean, dir?: string }) => {
      try {
        console.log(`\n🚀 Creating new Hytale plugin project: ${projectName}\n`);

        const config = await loadConfig();
        if (!config) {
          throw new ConfigError(
            'HYT is not configured. Please run "hyt setup" first.'
          );
        }

        const workspaceDir = process.cwd();
        const projectDir = path.join(workspaceDir, projectName);
        const serverDir = path.join(projectDir, 'server', 'Server');
        const modsDir = path.join(options.dir || projectDir, 'mods');
        const srcRefDir = path.join(projectDir, 'src-ref');

        let savedCfrPath: string | null = null;
        try {
          await fs.access(projectDir);
          
          warn(`\nDirectory "${projectName}" already exists.`);
          console.log('⚠️  This will DELETE the existing project and create a new one.');
          
          const existingSrcRef = path.join(projectDir, 'src-ref');
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
          } catch {}
          
          const answer = await askYesNo('\nDo you want to continue?');
          
          if (!answer) {
            info('Operation cancelled.');
            process.exit(0);
          }
          
          if (hasCfrSources) {
            savedCfrPath = path.join(process.cwd(), `.hyt-temp-cfr-${Date.now()}`);
            const saveSpinner = startSpinner('Saving reference sources...');
            await fs.rename(existingSrcRef, savedCfrPath);
            saveSpinner.succeed('Reference sources saved');
          }
          
          const deleteSpinner = startSpinner('Removing existing project...');
          await fs.rm(projectDir, { recursive: true, force: true });
          deleteSpinner.succeed('Existing project removed');
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
        }

        const templateSpinner = startSpinner('Downloading plugin template...');
        const templateZipPath = path.join(workspaceDir, 'template.zip');
        try {
          await downloadFile(getTemplateUrl(), templateZipPath);
          templateSpinner.succeed('Template downloaded');
        } catch (err) {
          templateSpinner.fail('Failed to download template');
          throw new HytaleError(
            `Could not download plugin template. Check your internet connection.`
          );
        }

        const extractSpinner = startSpinner('Extracting template...');
        try {
          await extractZip(templateZipPath, workspaceDir);
          const extractedDirName = `hyt-template-${TEMPLATE_VERSION.replace(/^v/, '').replace(/#/g, '-')}`;
          const extractedDir = path.join(workspaceDir, extractedDirName);
          
          await fs.rm(projectDir, { recursive: true, force: true });
          await fs.rename(extractedDir, projectDir);
          
          await fs.unlink(templateZipPath);
          extractSpinner.succeed('Template extracted');
        } catch (err) {
          extractSpinner.fail('Failed to extract template');
          throw err;
        }

        await fs.mkdir(serverDir, { recursive: true });
        await fs.mkdir(modsDir, { recursive: true });

        const serverCopySpinner = startSpinner('Copying server files from Hytale installation...');
        const hytaleServerPath = path.join(config.hytaleInstallPath, 'Server');
        const hytaleAssetsPath = path.join(config.hytaleInstallPath, 'Assets.zip');
        
        try {
          if(options.dir) {
            await copyDirectory(hytaleServerPath, serverDir);
            await copyDirectory(hytaleServerPath, path.join(options.dir, 'server', 'Server'));

            await fs.copyFile(hytaleAssetsPath, path.join(options.dir, 'Assets.zip'));
          } else {
            await copyDirectory(hytaleServerPath, serverDir);

            await fs.copyFile(hytaleAssetsPath, path.join(projectDir, 'Assets.zip'));
          }
          serverCopySpinner.succeed('Server files copied');
        } catch (err) {
          serverCopySpinner.fail('Failed to copy server files');
          throw new HytaleError(
            `Could not copy server files from Hytale installation. ` +
            `Make sure "${config.hytaleInstallPath}" contains Server/ and Assets.zip`
          );
        }

        const renameSpinner = startSpinner('Configuring project name...');
        const packageName = projectName.toLowerCase().replace(/-/g, '_');
        await replaceInFiles(projectDir, 'ExamplePlugin', toPascalCase(projectName));
        await replaceInFiles(projectDir, 'example-mod', projectName);
        await replaceInFiles(projectDir, 'org.example', `com.${packageName}`);
        
        const pascalName = toPascalCase(projectName);
        const oldJavaFile = path.join(projectDir, 'app', 'src', 'main', 'java', 'org', 'example', 'ExamplePlugin.java');
        const newJavaFile = path.join(projectDir, 'app', 'src', 'main', 'java', 'org', 'example', `${pascalName}.java`);
        
        try {
          await fs.rename(oldJavaFile, newJavaFile);
        } catch {}
        
        const oldTestFile = path.join(projectDir, 'app', 'src', 'test', 'java', 'org', 'example', 'ExamplePluginTest.java');
        const newTestFile = path.join(projectDir, 'app', 'src', 'test', 'java', 'org', 'example', `${pascalName}Test.java`);
        
        try {
          await fs.rename(oldTestFile, newTestFile);
        } catch {}
        
        const mainJavaDir = path.join(projectDir, 'app', 'src', 'main', 'java');
        const testJavaDir = path.join(projectDir, 'app', 'src', 'test', 'java');
        
        const newPackageDir = path.join('com', packageName);
        const newMainPackageDir = path.join(mainJavaDir, newPackageDir);
        const newTestPackageDir = path.join(testJavaDir, newPackageDir);
        
        await fs.mkdir(newMainPackageDir, { recursive: true });
        await fs.mkdir(newTestPackageDir, { recursive: true });
        
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
          await fs.rm(path.join(mainJavaDir, 'org'), { recursive: true, force: true });
        } catch {}
        
        try {
          const testFiles = await fs.readdir(oldTestPackageDir);
          for (const file of testFiles) {
            await fs.rename(
              path.join(oldTestPackageDir, file),
              path.join(newTestPackageDir, file)
            );
          }
          await fs.rm(path.join(testJavaDir, 'org'), { recursive: true, force: true });
        } catch {}
        
        renameSpinner.succeed('Project name configured');


        ///////////// Fix plugin configuration. Remove after template is updated /////////////
        // const fixConfigSpinner = startSpinner('Fixing plugin configuration...');
        // try {
        //   const mainClassFile = path.join(newMainPackageDir, `${pascalName}.java`);
        //   let mainClassContent = await fs.readFile(mainClassFile, 'utf-8');
          
        //   mainClassContent = mainClassContent.replace(
        //     /(@Override\s+public void setup\(\)\s*\{\s*)config = withConfig\(MyConfig\.CODEC\);/,
        //     '$1// Config is initialized in constructor'
        //   );
          
        //   if (!mainClassContent.includes('config = withConfig(MyConfig.CODEC)')) {
        //     mainClassContent = mainClassContent.replace(
        //       /(public\s+\w+\(JavaPluginInit init\)\s*\{\s*super\(init\);)/,
        //       '$1\n        config = withConfig(MyConfig.CODEC);'
        //     );
        //   }
          
        //   await fs.writeFile(mainClassFile, mainClassContent);
        //   fixConfigSpinner.succeed('Plugin configuration fixed');
        // } catch (err) {
        //   fixConfigSpinner.warn('Could not fix plugin configuration');
        // }
        //////////////////////////////////////////////////////////////////////////////////////

        // Remove docs folder if --without-docs flag is set
        if (options.withoutDocs) {
          const docsSpinner = startSpinner('Removing documentation examples...');
          const docsDir = path.join(newMainPackageDir, 'docs');
          
          try {
            await fs.rm(docsDir, { recursive: true, force: true });
            
            // Update main class to remove docs references
            const mainClassFile = path.join(newMainPackageDir, `${pascalName}.java`);
            let mainClassContent = await fs.readFile(mainClassFile, 'utf-8');
            
            // Add Level import if not present
            if (!mainClassContent.includes('import java.util.logging.Level;')) {
              mainClassContent = mainClassContent.replace(
                /(import com\.hypixel\.hytale\.server\.core\.plugin\.JavaPlugin;)/,
                '$1\nimport java.util.logging.Level;'
              );
            }
            
            // Replace the start() method to remove docs command registration
            mainClassContent = mainClassContent.replace(
              /(@Override\s+public void start\(\)\s*\{)[\s\S]*?(\}\s+@Override\s+public void shutdown)/,
              `$1\n        getLogger().at(Level.INFO).log("${pascalName} plugin started!");\n    $2`
            );
            
            // Remove the docs package comment if it exists
            mainClassContent = mainClassContent.replace(
              /\/\*\*\s*\*[^*]*\*\s*Individual documentation examples.*?\*\//s,
              '/**\n * Main plugin class.\n */'
            );
            
            await fs.writeFile(mainClassFile, mainClassContent);
            docsSpinner.succeed('Documentation examples removed');
          } catch (err) {
            docsSpinner.warn('Could not remove docs (may not exist)');
          }
        }

        const buildGradleSpinner = startSpinner('Configuring Gradle build settings...');
        try {
          const buildGradlePath = path.join(projectDir, 'app', 'build.gradle.kts');
          let buildGradleContent = await fs.readFile(buildGradlePath, 'utf-8');
          
          if (!buildGradleContent.includes('-Xlint:-removal')) {
            buildGradleContent = buildGradleContent.replace(
              /(tasks\.withType<JavaCompile>\s*\{[^}]*)/,
              `$1\n    options.compilerArgs.add("-Xlint:-removal")`
            );
            
            await fs.writeFile(buildGradlePath, buildGradleContent);
          }
          buildGradleSpinner.succeed('Build settings configured');
        } catch (err) {
          buildGradleSpinner.warn('Could not configure build settings');
        }

        if (options.decompiler) {
          const decompiler = options.decompiler.toLowerCase() as Decompiler;
          if (decompiler !== 'cfr' && decompiler !== 'vineflower') {
            throw new HytaleError(
              `Invalid decompiler: ${options.decompiler}. Use 'cfr' or 'vineflower'`
            );
          }

          const decompilerName = decompiler.toUpperCase();
          const decompilerSpinner = startSpinner(`Downloading ${decompilerName} decompiler...`);
          const decompilerPath = path.join(projectDir, `${decompiler}.jar`);
          const decompilerUrl = decompiler === 'cfr' ? getCfrUrl() : getVineflowerUrl();
          
          try {
            await downloadFile(decompilerUrl, decompilerPath);
            decompilerSpinner.succeed(`${decompilerName} decompiler downloaded`);

            await fs.mkdir(srcRefDir, { recursive: true });
            info('⏱️  Generating reference sources (this may take several minutes)...');
            
            try {
              const startTime = Date.now();
              const refSpinner = startSpinner('Generating reference sources...');
              
              const timerInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                refSpinner.text = `Generating reference sources... (${elapsed}s elapsed)`;
              }, 1000);

              try {
                // CFR and Vineflower use different command-line arguments
                const decompileArgs = decompiler === 'cfr'
                  ? ['-jar', decompilerPath, path.join(serverDir, 'HytaleServer.jar'), '--outputdir', srcRefDir]
                  : ['-jar', decompilerPath, path.join(serverDir, 'HytaleServer.jar'), srcRefDir];
                
                await execa(config.javaPath, decompileArgs, { 
                  cwd: projectDir,
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
            decompilerSpinner.warn(`${decompilerName} download failed (non-critical, you can download manually)`);
          }
        }

        if (savedCfrPath) {
          const restoreSpinner = startSpinner('Restoring reference sources...');
          try {
            await fs.rename(savedCfrPath, srcRefDir);
            restoreSpinner.succeed('Reference sources restored');
          } catch (err) {
            restoreSpinner.fail('Failed to restore reference sources');
            try {
              await fs.rm(savedCfrPath, { recursive: true, force: true });
            } catch {}
          }
        }

        if (!options.skipGit) {
          const gitSpinner = startSpinner('Initializing git repository...');
          try {
            await execa('git', ['init'], { cwd: projectDir });
            gitSpinner.succeed('Git repository initialized');
          } catch {
            gitSpinner.warn('Git initialization failed (git may not be installed)');
          }
        } else {
          info('Skipping git initialization');
        }

        success('\n✨ Project created successfully!');
        console.log(`
📁 Project structure:
   ${projectName}/
   ├── app/                   # Your plugin source code
   │   └── src/main/java/     # Java sources
   ├── mods/                  # Compiled plugins go here
   ├── server/
   │   └── Server/            # HytaleServer.jar (not committed)
   └── src-ref/               # Decompiled references (not committed)

📖 Plugin source is in: app/src/main/java/

💡 (Optional) Generate decompiled reference sources to explore the Hytale API
   hyt generate-references --decompiler cfr          # Takes ~10 minutes
   hyt generate-references --decompiler vineflower   # Alternative decompiler
   OR use --decompiler during project creation

📚 Note: If you want to remove documentation examples, use:
   hyt init ${projectName} --without-docs

🚀 Next steps:
   cd ${projectName}
   hyt build                  # Build your plugin
   hyt dev                    # Start development mode
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
