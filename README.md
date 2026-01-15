# HYT - Hytale Development Tool

A command-line interface for Hytale plugin development that automates project setup, building, and hot-reload development workflows.

## Features

**Quick Setup**
- Automatic Java 25 detection and installation
- Hytale installation discovery
- Configuration management

**Project Initialization**
- Scaffolds new plugin projects from template
- Decompiles Hytale server JAR for reference sources (CFR)
- Configures Gradle build system
- Git repository initialization

**Build System**
- Gradle wrapper integration
- One-command builds
- Automatic JAR output to mods folder (use `--no-copy` to skip)

**Development Mode**
- Optional file watching with auto-rebuild on changes (use `--watch` flag)
- Integrated Hytale server management
- Always builds and copies before server startup
- Live feedback with progress indicators

## Requirements

- Node.js 18 or higher
- Java 25 (auto-installed if missing)
- Hytale installation

## Installation

```bash
npm install -g @lunnos/hyt
```

After installation, the `hyt` command will be available globally.

## Usage

### Initial Setup

Configure Java and Hytale paths:

```bash
hyt setup
```

Options:
- `--java-path <path>` - Specify Java executable manually
- `--hytale-path <path>` - Specify Hytale installation manually

### Create New Plugin

```bash
hyt init my-plugin
```

This creates a complete project structure with:
- Plugin source template
- Hytale server files
- Decompiled reference sources
- Gradle build configuration

Options:
- `--with-cfr` - Include decompiled reference sources (Takes longer)
- `--skip-git` - Skip git initialization

### Build Plugin

```bash
cd my-plugin/Server/Plugins/my-plugin
hyt build
```

Automatically builds your plugin and copies the JAR to the mods folder.

Options:
- `--no-copy` - Skip copying JAR to mods folder

### Development Mode

Start development mode to run your Hytale server:

```bash
cd my-plugin/Server/Plugins/my-plugin
hyt dev
```

This will:
1. Build your plugin
2. Copy JAR to mods folder
3. Start the Hytale server with your latest plugin

**Note:** The server does NOT auto-restart. When you make code changes, you must:
1. Stop the server with Ctrl+C
2. Make your changes
3. Run `hyt dev` again to rebuild and restart

Options:
- `--no-initial-build` - Skip initial build on startup
- `--watch` - Enable file watching for live error checking (auto-rebuild on changes, but server restart still required)
- `--debounce <seconds>` - Seconds to wait after last change before rebuilding (default: 5)

### Generate Reference Sources

Optionally generate decompiled Hytale server sources for API exploration:

```bash
hyt generate-references
```

This takes 5-10 minutes and creates reference sources in `Server/Plugins/src-ref/`. Useful for understanding the Hytale API and for IDE code completion.

## Project Structure

```
my-plugin/
├── Assets.zip              # Hytale game assets
├── mods/                   # Compiled plugin JARs
└── Server/
    ├── HytaleServer.jar
    └── Plugins/
        └── my-plugin/      # Your plugin source
            ├── app/
            │   └── src/
            ├── gradle/
            ├── gradlew
            └── build.gradle
```

## Configuration

Configuration is stored in `~/.hyt/config.json`:

```json
{
  "javaPath": "/path/to/java",
  "hytaleInstallPath": "/path/to/hytale"
}
```

## Credits

The default plugin template is provided by [hytale-france/example-mod](https://github.com/hytale-france/example-mod).

## License

MIT
