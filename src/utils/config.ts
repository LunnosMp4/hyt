import fs from 'fs/promises';
import { ConfigError } from './errors.js';
import { getConfigDir, getConfigPath } from './paths.js';

export interface ConfigSchema {
  javaPath: string;
  hytaleInstallPath: string;
}

/** Load configuration from ~/.hyt/config.json */
export async function loadConfig(): Promise<ConfigSchema | null> {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data) as ConfigSchema;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // Config file doesn't exist yet
    }
    throw new ConfigError(`Failed to load configuration: ${(error as Error).message}`);
  }
}

/** Save configuration to ~/.hyt/config.json */
export async function saveConfig(config: ConfigSchema): Promise<void> {
  try {
    const configDir = getConfigDir();
    const configPath = getConfigPath();

    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Write config file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new ConfigError(`Failed to save configuration: ${(error as Error).message}`);
  }
}

/** Validate configuration schema */
export function validateConfig(config: Partial<ConfigSchema>): config is ConfigSchema {
  return (
    typeof config.javaPath === 'string' &&
    config.javaPath.length > 0 &&
    typeof config.hytaleInstallPath === 'string' &&
    config.hytaleInstallPath.length > 0
  );
}
