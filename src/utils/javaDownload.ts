import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execa } from 'execa';
import { downloadFile } from './download.js';
import { JavaError } from './errors.js';

const JAVA_VERSION = '25';

// Eclipse Temurin (Adoptium) download URLs
const DOWNLOAD_URLS = {
  win32: {
    x64: `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/windows/x64/jdk/hotspot/normal/eclipse`,
  },
  darwin: {
    x64: `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/mac/x64/jdk/hotspot/normal/eclipse`,
    arm64: `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/mac/aarch64/jdk/hotspot/normal/eclipse`,
  },
  linux: {
    x64: `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/linux/x64/jdk/hotspot/normal/eclipse`,
    arm64: `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/linux/aarch64/jdk/hotspot/normal/eclipse`,
  },
};

/** Get the HYT Java installation directory */
export function getJavaInstallDir(): string {
  return path.join(os.homedir(), '.hyt', 'java25');
}

/** Get the Java executable path, searching versioned subdirectories if needed */
export async function getJavaExecutablePathAsync(): Promise<string> {
  const javaDir = getJavaInstallDir();
  const platform = os.platform();
  
  let directPath: string;
  if (platform === 'win32') {
    directPath = path.join(javaDir, 'bin', 'java.exe');
  } else if (platform === 'darwin') {
    directPath = path.join(javaDir, 'Contents', 'Home', 'bin', 'java');
  } else {
    directPath = path.join(javaDir, 'bin', 'java');
  }
  
  try {
    await fs.access(directPath, fs.constants.X_OK);
    return directPath;
  } catch {
    try {
      const entries = await fs.readdir(javaDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('jdk-')) {
          let javaExePath: string;
          
          if (platform === 'win32') {
            javaExePath = path.join(javaDir, entry.name, 'bin', 'java.exe');
          } else if (platform === 'darwin') {
            javaExePath = path.join(javaDir, entry.name, 'Contents', 'Home', 'bin', 'java');
          } else {
            javaExePath = path.join(javaDir, entry.name, 'bin', 'java');
          }
          
          try {
            await fs.access(javaExePath, fs.constants.X_OK);
            return javaExePath;
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't read
    }
    
    return directPath;
  }
}

function getDownloadUrl(): string {
  const platform = os.platform();
  const arch = os.arch();
  
  const platformUrls = DOWNLOAD_URLS[platform as keyof typeof DOWNLOAD_URLS];
  if (!platformUrls) {
    throw new JavaError(`Unsupported platform: ${platform}`);
  }
  
  const archUrl = platformUrls[arch as keyof typeof platformUrls];
  if (!archUrl) {
    throw new JavaError(`Unsupported architecture: ${arch} on ${platform}`);
  }
  
  return archUrl;
}

/** Download and install Java 25 to ~/.hyt/java25 */
export async function downloadAndInstallJava(): Promise<string> {
  const javaDir = getJavaInstallDir();
  const platform = os.platform();
  
  // Create installation directory
  await fs.mkdir(javaDir, { recursive: true });
  
  // Download Java
  const downloadUrl = getDownloadUrl();
  const ext = platform === 'win32' ? '.zip' : '.tar.gz';
  const downloadPath = path.join(javaDir, `java25${ext}`);
  
  await downloadFile(downloadUrl, downloadPath);
  
  // Extract archive
  await extractJavaArchive(downloadPath, javaDir);
  
  // Clean up archive
  await fs.unlink(downloadPath);
  
  // Find and return Java executable path
  const javaExe = await findJavaExecutable(javaDir);
  if (!javaExe) {
    throw new JavaError('Java installation completed but java executable not found');
  }
  
  return javaExe;
}

async function extractJavaArchive(archivePath: string, destDir: string): Promise<void> {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const tempDir = path.join(destDir, 'temp_extract');
    await execa('powershell', [
      '-Command',
      `Expand-Archive -Path "${archivePath}" -DestinationPath "${tempDir}" -Force`
    ]);
    
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    const jdkFolder = entries.find(e => e.isDirectory() && e.name.startsWith('jdk-'));
    
    if (jdkFolder) {
      const jdkPath = path.join(tempDir, jdkFolder.name);
      // Move contents up to destDir
      const jdkContents = await fs.readdir(jdkPath);
      for (const item of jdkContents) {
        await fs.rename(
          path.join(jdkPath, item),
          path.join(destDir, item)
        );
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } else {
    // Use tar for Unix systems with strip-components to remove version folder
    await execa('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1']);
  }
}

async function findJavaExecutable(dir: string): Promise<string | null> {
  const platform = os.platform();
  
  const standardPath = await getJavaExecutablePathAsync();
  try {
    await fs.access(standardPath, fs.constants.X_OK);
    return standardPath;
  } catch {
    // Not in standard location, search recursively
  }
  
  const javaExeName = platform === 'win32' ? 'java.exe' : 'java';
  return await findFileRecursive(dir, javaExeName);
}

async function findFileRecursive(dir: string, fileName: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const found = await findFileRecursive(fullPath, fileName);
        if (found) return found;
      } else if (entry.name === fileName) {
        try {
          await fs.access(fullPath, fs.constants.X_OK);
          return fullPath;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Directory not accessible, skip
  }
  
  return null;
}

/** Check if Java is already installed in HYT directory */
export async function hasInstalledJava(): Promise<boolean> {
  try {
    const javaExe = await getJavaExecutablePathAsync();
    await fs.access(javaExe, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
