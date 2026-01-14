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
- Automatic JAR output to mods folder

**Development Mode**
- File watching with automatic rebuild on changes
- Hot-reload server restart
- Integrated Hytale server management
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
- `--skip-cfr` - Skip decompiler download
- `--skip-git` - Skip git initialization

### Build Plugin

```bash
cd my-plugin/Server/Plugins/my-plugin
hyt build
```

Options:
- `--copy` - Automatically copy JAR to mods folder

### Development Mode

Start file watching with hot reload:

```bash
cd my-plugin/Server/Plugins/my-plugin
hyt dev
```

This will:
1. Build your plugin
2. Start the Hytale server
3. Watch for file changes
4. Rebuild and restart on save

Options:
- `--no-initial-build` - Skip initial build

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

## License

MIT
