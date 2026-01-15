import { execa } from 'execa';
import type { ResultPromise } from 'execa';
import path from 'path';
import { HytaleError } from './errors.js';

let serverProcess: ResultPromise | null = null;

export interface ServerOptions {
  javaPath: string;
  serverJarPath: string;
  assetsPath?: string;
  workingDir: string;
}

/** Launch the Hytale server */
export async function launchHytaleServer(options: ServerOptions): Promise<ResultPromise> {
  const { javaPath, serverJarPath, assetsPath, workingDir } = options;

  try {
    // Stop existing server if running
    if (serverProcess) {
      await stopHytaleServer();
    }

    // Build command args - only include --assets if provided
    const args = ['-jar', serverJarPath];
    if (assetsPath) {
      args.push('--assets', assetsPath);
    }

    // Launch server with output streaming
    serverProcess = execa(
      javaPath,
      args,
      {
        cwd: workingDir,
        stdio: 'inherit', // Stream output to console
        cleanup: true,
      }
    );

    // Handle server exit
    serverProcess.on('exit', (code: number | null) => {
      if (code !== 0 && code !== null) {
        console.log(`\n⚠️  Server exited with code ${code}`);
      }
      serverProcess = null;
    });

    return serverProcess;
  } catch (error) {
    throw new HytaleError(`Failed to launch Hytale server: ${(error as Error).message}`);
  }
}

/** Stop the running Hytale server */
export async function stopHytaleServer(): Promise<void> {
  if (!serverProcess) {
    return;
  }

  try {
    // Send stop command to server console
    if (serverProcess.stdin) {
      serverProcess.stdin.write('stop\n');
    }

    // Wait for graceful shutdown (max 10 seconds)
    const timeout = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    }, 10000);

    await serverProcess;
    clearTimeout(timeout);
    serverProcess = null;
  } catch {
    // Process might already be stopped
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
    serverProcess = null;
  }
}

/** Check if server is running */
export function isServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

/** Restart the Hytale server */
export async function restartHytaleServer(options: ServerOptions): Promise<ResultPromise> {
  await stopHytaleServer();
  // Wait a bit before restarting
  await new Promise(resolve => setTimeout(resolve, 2000));
  return launchHytaleServer(options);
}
