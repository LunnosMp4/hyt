## [2.1.1](https://github.com/LunnosMp4/hyt/compare/v2.1.0...v2.1.1) (2026-01-18)


### Bug Fixes

* allow unknown options for set-jvm-args command in config ([e54c1c4](https://github.com/LunnosMp4/hyt/commit/e54c1c4dba402d9157da33e584cdeaa035f22606))

# [2.1.0](https://github.com/LunnosMp4/hyt/compare/v2.0.3...v2.1.0) (2026-01-15)


### Features

* add config command for managing HYT configuration and JVM arguments ([b58ed84](https://github.com/LunnosMp4/hyt/commit/b58ed846d77b679fa44ede59252e380c10b9fcbb))

## [2.0.3](https://github.com/LunnosMp4/hyt/compare/v2.0.2...v2.0.3) (2026-01-15)


### Bug Fixes

* normalize Hytale installation paths and improve validation checks ([7cfbd32](https://github.com/LunnosMp4/hyt/commit/7cfbd32da16141e6b885e35cba2c20a29e4c47b5))

## [2.0.2](https://github.com/LunnosMp4/hyt/compare/v2.0.1...v2.0.2) (2026-01-15)


### Bug Fixes

* enhance Hytale installation validation and path handling in setup command ([60bb84e](https://github.com/LunnosMp4/hyt/commit/60bb84efa629bc51d3302bf33abe18720682ffda))

## [2.0.1](https://github.com/LunnosMp4/hyt/compare/v2.0.0...v2.0.1) (2026-01-15)


### Bug Fixes

* improve Java installation feedback in setup command ([ebba827](https://github.com/LunnosMp4/hyt/commit/ebba827d392ce49c6a08e0f69d4dd8aeb71cf685))

# [2.0.0](https://github.com/LunnosMp4/hyt/compare/v1.1.3...v2.0.0) (2026-01-15)


### Bug Fixes

* add process.exit(0) to commands for graceful termination ([a532510](https://github.com/LunnosMp4/hyt/commit/a5325100d7f0b1b436bf9aa43588569d45e141f7))
* update plugin configuration in main class for proper initialization ([e5affb8](https://github.com/LunnosMp4/hyt/commit/e5affb8e7213a99b5ba8938b2c70ab5ba34b97fe))


* feat!: Update to new code template with new project structure ([1d127d7](https://github.com/LunnosMp4/hyt/commit/1d127d797f6422f34471f3fff906dba573da0531))


### BREAKING CHANGES

* Project structure has changed significantly

Project Structure Changes:
- Changed from Server/Plugins/plugin-name/ to project root layout
- Server files now located in server/Server/ (not committed)
- Assets.zip now in project root (required for server startup)
- src-ref/ for decompiled references directly in project root (not committed)
- mods/ folder for compiled plugins

Features:
- Add --without-docs flag to remove documentation examples on init
- Auto-suppress deprecation warnings in build.gradle.kts

Other:
- Update init success message with --without-docs note
- Update error messages to reflect new project structure

## [1.1.3](https://github.com/LunnosMp4/hyt/compare/v1.1.2...v1.1.3) (2026-01-15)

## [1.1.2](https://github.com/LunnosMp4/hyt/compare/v1.1.1...v1.1.2) (2026-01-15)

## [1.1.1](https://github.com/LunnosMp4/hyt/compare/v1.1.0...v1.1.1) (2026-01-15)

# [1.1.0](https://github.com/LunnosMp4/hyt/compare/v1.0.1...v1.1.0) (2026-01-14)


### Features

* remove auto generate cfr, customizable debounce, remove auto-restart, reduce logs, update docs ([66c762a](https://github.com/LunnosMp4/hyt/commit/66c762a5dc586e495861b81038fa81f9567d18a2))

## [1.0.1](https://github.com/LunnosMp4/hyt/compare/v1.0.0...v1.0.1) (2026-01-14)


### Bug Fixes

* add credits section to README and improve setup command output ([7619995](https://github.com/LunnosMp4/hyt/commit/7619995caf4b608dcc41983137bf768bec3a6100))

# 1.0.0 (2026-01-14)


### Features

* initial release with CI/CD, setup/init/dev/build commands ([ad370a3](https://github.com/LunnosMp4/hyt/commit/ad370a3f53976e29c41ec8eab5633da1dafaa885))
