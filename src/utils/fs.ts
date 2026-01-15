import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import readline from 'readline';

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Copy a directory recursively
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  await fs.mkdir(dest, { recursive: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Extract a ZIP file
 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  if (process.platform === 'win32') {
    await execa('powershell', [
      '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
    ]);
  } else {
    await execa('unzip', ['-o', zipPath, '-d', destDir]);
  }
}

/**
 * Replace a string in all files within a directory recursively
 */
export async function replaceInFiles(dir: string, search: string, replace: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await replaceInFiles(entryPath, search, replace);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const textExtensions = ['.java', '.kt', '.kts', '.gradle', '.json', '.xml', '.properties', '.md', '.txt'];
      
      if (textExtensions.includes(ext) || entry.name === 'gradlew') {
        try {
          let content = await fs.readFile(entryPath, 'utf-8');
          if (content.includes(search)) {
            content = content.replace(new RegExp(search, 'g'), replace);
            await fs.writeFile(entryPath, content, 'utf-8');
          }
        } catch {
          // Skip binary files or files we can't read
        }
      }
    }
  }
}

/**
 * Ask a yes/no question in the terminal
 */
export async function askYesNo(question: string, defaultYes = false): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = defaultYes ? '(Y/n)' : '(y/N)';
    rl.question(`${question} ${prompt}: `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === '') {
        resolve(defaultYes);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}
