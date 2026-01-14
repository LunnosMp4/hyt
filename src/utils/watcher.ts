import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

export interface WatcherOptions {
  onFileChange: (filePath: string) => void | Promise<void>;
  ignorePatterns?: string[];
}

/** Watch source files for changes */
export function watchFiles(watchDir: string, options: WatcherOptions): FSWatcher {
  const { onFileChange, ignorePatterns = [] } = options;

  // Default ignore patterns
  const defaultIgnores = [
    '**/build/**',
    '**/.gradle/**',
    '**/node_modules/**',
    '**/.git/**',
    '**/*.class',
    '**/*.jar',
  ];

  const watcher = chokidar.watch(watchDir, {
    ignored: [...defaultIgnores, ...ignorePatterns],
    persistent: true,
    ignoreInitial: true, // Don't trigger on startup
    awaitWriteFinish: {
      stabilityThreshold: 300, // Wait 300ms after last change
      pollInterval: 100,
    },
    // Performance optimizations
    usePolling: false,
    interval: 100,
    binaryInterval: 300,
  });

  watcher.on('change', (filePath: string) => {
    onFileChange(filePath);
  });

  watcher.on('add', (filePath: string) => {
    onFileChange(filePath);
  });

  watcher.on('unlink', (filePath: string) => {
    onFileChange(filePath);
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  return watcher;
}

/** Stop watching files */
export async function stopWatcher(watcher: FSWatcher): Promise<void> {
  await watcher.close();
}
