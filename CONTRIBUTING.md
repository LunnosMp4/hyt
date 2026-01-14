# Contributing to HYT

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

### Commit Types

- `feat:` - New features (triggers minor version bump)
- `fix:` - Bug fixes (triggers patch version bump)
- `docs:` - Documentation changes (triggers patch version bump)
- `perf:` - Performance improvements (triggers patch version bump)
- `refactor:` - Code refactoring (triggers patch version bump)
- `test:` - Adding or updating tests (no version bump)
- `chore:` - Maintenance tasks (no version bump)
- `ci:` - CI/CD changes (no version bump)

### Examples

```bash
feat: add hot reload support for plugin development
fix: resolve Java version detection on Windows
docs: update README with new commands
perf: optimize file watching performance
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit body or use `!` after the type:

```bash
feat!: change config file format to YAML

BREAKING CHANGE: Configuration is now stored in YAML format instead of JSON.
Users need to run `hyt setup` again to migrate their configuration.
```

This will trigger a major version bump.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Test locally: `npm link` (creates global symlink)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with proper commit messages
3. Ensure `npm run build` succeeds
4. Submit PR to `main` branch
5. Once merged, semantic-release will automatically publish

## Release Process

Releases are fully automated via GitHub Actions:

1. Push commits to `main` branch
2. GitHub Actions runs tests and build
3. Semantic-release analyzes commits and determines version
4. New version is published to npm
5. GitHub release is created with changelog
6. CHANGELOG.md is updated automatically
