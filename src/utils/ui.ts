import ora, { Ora } from 'ora';

/** Create and start a spinner */
export function startSpinner(message: string): Ora {
  return ora(message).start();
}

/** Show success message with checkmark */
export function success(message: string): void {
  ora().succeed(message);
}

/** Show error message */
export function error(message: string): void {
  ora().fail(message);
}

/** Show info message */
export function info(message: string): void {
  ora().info(message);
}

/** Show warning message */
export function warn(message: string): void {
  ora().warn(message);
}
