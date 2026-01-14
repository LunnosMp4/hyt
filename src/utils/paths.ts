import path from 'path';
import os from 'os';

/** Get HYT config directory (~/.hyt/) */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.hyt');
}

/** Get HYT config file path (~/.hyt/config.json) */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/** Resolve project paths consistently */
export function resolveProjectPath(projectDir: string, ...pathSegments: string[]): string {
  return path.join(projectDir, ...pathSegments);
}

/** Get Gradle build output directory */
export function getBuildOutputDir(projectDir: string): string {
  return path.join(projectDir, 'build', 'libs');
}
