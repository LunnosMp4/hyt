export class JavaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JavaError';
  }
}

export class GradleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GradleError';
  }
}

export class HytaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HytaleError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
