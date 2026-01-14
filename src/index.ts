#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
import { setupCommand } from './commands/setup.js';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';
import { devCommand } from './commands/dev.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('hyt')
  .description('CLI tool for Hytale plugin development automation')
  .version(version);

program.addCommand(setupCommand());
program.addCommand(initCommand());
program.addCommand(buildCommand());
program.addCommand(devCommand());

program.parse(process.argv);
