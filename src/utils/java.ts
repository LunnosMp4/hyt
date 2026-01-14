import { execa } from 'execa';
import { JavaError } from './errors.js';
import fs from 'fs/promises';
import path from 'path';

const REQUIRED_JAVA_VERSION = 25;

/** Detect Java installation on the system */
export async function detectJava(): Promise<string | null> {
  try {
    // Try 'java' command first
    const { stdout } = await execa('java', ['-version']);
    
    // If successful, get the full path
    const whichResult = process.platform === 'win32' 
      ? await execa('where', ['java'])
      : await execa('which', ['java']);
    
    return whichResult.stdout.split('\n')[0].trim();
  } catch {
    // Java not found in PATH
    return null;
  }
}

/** Validate Java version meets requirements */
export async function validateJavaVersion(javaPath: string): Promise<boolean> {
  try {
    const { stderr } = await execa(javaPath, ['-version']);
    
    // Java version output is in stderr
    const versionMatch = stderr.match(/version "(\d+)/);
    if (!versionMatch) {
      throw new JavaError('Could not parse Java version');
    }

    const majorVersion = parseInt(versionMatch[1], 10);
    
    if (majorVersion < REQUIRED_JAVA_VERSION) {
      throw new JavaError(
        `Java ${REQUIRED_JAVA_VERSION} or higher is required. Found version ${majorVersion}.`
      );
    }

    return true;
  } catch (error) {
    if (error instanceof JavaError) {
      throw error;
    }
    throw new JavaError(`Failed to validate Java version: ${(error as Error).message}`);
  }
}

/** Verify Java path exists and is executable */
export async function verifyJavaPath(javaPath: string): Promise<boolean> {
  try {
    await fs.access(javaPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
