import { execa, ExecaError } from 'execa';
import path from 'path';
import { GradleError } from './errors.js';

/** Run Gradle build in the specified project directory */
export async function runGradleBuild(projectDir: string, forceRebuild: boolean = false): Promise<void> {
  const isWindows = process.platform === 'win32';
  const gradleWrapper = isWindows ? 'gradlew.bat' : './gradlew';
  const gradlePath = path.join(projectDir, gradleWrapper);

  try {
    const args = forceRebuild ? ['clean', 'build', '--rerun-tasks'] : ['build'];
    await execa(gradlePath, args, {
      cwd: projectDir,
      stdio: 'inherit', // Stream output directly to terminal
    });
  } catch (error) {
    const execaErr = error as ExecaError;
    throw new GradleError(
      `Gradle build failed with exit code ${execaErr.exitCode || 'unknown'}. Check the output above for details.`
    );
  }
}

/** Run any Gradle task in the specified project directory */
export async function runGradleTask(projectDir: string, task: string): Promise<void> {
  const isWindows = process.platform === 'win32';
  const gradleWrapper = isWindows ? 'gradlew.bat' : './gradlew';
  const gradlePath = path.join(projectDir, gradleWrapper);

  try {
    await execa(gradlePath, [task], {
      cwd: projectDir,
      stdio: 'inherit',
    });
  } catch (error) {
    const execaErr = error as ExecaError;
    throw new GradleError(
      `Gradle task '${task}' failed with exit code ${execaErr.exitCode || 'unknown'}.`
    );
  }
}

/** Check if Gradle wrapper exists in directory */
export async function hasGradleWrapper(projectDir: string): Promise<boolean> {
  const isWindows = process.platform === 'win32';
  const gradleWrapper = isWindows ? 'gradlew.bat' : 'gradlew';
  const gradlePath = path.join(projectDir, gradleWrapper);

  try {
    const fs = await import('fs/promises');
    await fs.access(gradlePath);
    return true;
  } catch {
    return false;
  }
}
