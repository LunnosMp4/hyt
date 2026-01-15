import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { directoryExists, fileExists } from './fs.js';
import { HytaleError } from './errors.js';

/** Common Hytale installation locations by platform */
function getHytaleSearchPaths(): string[] {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return [
      // Primary location: %APPDATA%\Hytale (user's Roaming directory)
      path.join(process.env.APPDATA || '', 'Hytale'),
      // Full path to game files
      path.join(process.env.APPDATA || '', 'Hytale', 'install', 'release', 'package', 'game', 'latest'),
      // Fallback locations
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Hytale'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Hytale'),
      path.join(process.env.LOCALAPPDATA || '', 'Hytale'),
    ];
  } else if (platform === 'darwin') {
    return [
      '/Applications/Hytale.app',
      path.join(os.homedir(), 'Applications', 'Hytale.app'),
    ];
  } else {
    // Linux
    return [
      '/opt/hytale',
      path.join(os.homedir(), '.hytale'),
      path.join(os.homedir(), 'hytale'),
    ];
  }
}

/** Find Hytale installation directory */
export async function findHytaleInstall(): Promise<string | null> {
  const searchPaths = getHytaleSearchPaths();
  
  for (const searchPath of searchPaths) {
    try {
      const stats = await fs.stat(searchPath);
      if (stats.isDirectory()) {
        // Verify this directory contains Server/ and Assets.zip
        const hasServer = await directoryExists(path.join(searchPath, 'Server'));
        const hasAssets = await fileExists(path.join(searchPath, 'Assets.zip'));
        
        if (hasServer && hasAssets) {
          return searchPath;
        }
      }
    } catch {
      // Path doesn't exist, continue searching
      continue;
    }
  }
  
  return null;
}

/** Verify Hytale installation path is valid */
export async function verifyHytaleInstall(hytaleInstallPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(hytaleInstallPath);
    if (!stats.isDirectory()) return false;
    
    // Verify Assets.zip exists
    const hasAssets = await fileExists(path.join(hytaleInstallPath, 'Assets.zip'));
    return hasAssets;
  } catch {
    return false;
  }
}
