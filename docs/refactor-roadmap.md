# Refactor Roadmap

## Completed

- `MapDefinition` is now the source of truth for editor, sharing, and local storage.
- Share payloads use a versioned `v2.` format, while legacy payloads are migrated on read.
- `GameSession` initialization is separated from UI bootstrap.
- The editor and map list now read and write map definitions instead of mutating raw tile matrices directly.
- Movement search now lives in `src/domain/rules/moveGenerator.js`.
- Capture, jail, escape, and win checks now live in dedicated rule modules.
- Editor preview, map thumbnails, and the game board now render directly from `MapDefinition`.
- The global app state no longer stores a derived legacy tile matrix.
- Movement rules no longer read mixed display/rule metadata from `TILE_TYPES`.
- Automated tests now cover legacy-to-v2 migration, storage/list flows, app bootstrap wiring, and key multi-step movement edge cases.
- Reachable-cell, selectable-unit, and path-preview projection have been split out of `src/features/gameController.js`.
- Editor, map list thumbnails, and the game board now share a common board renderer in `src/ui/board/boardRenderer.js`.
- Unit/token rendering and board highlight DOM mutations now live under `src/ui/game/`.
- Turn, dice, prompt text, and victory modal rendering now live under `src/ui/game/statusRenderer.js`.
- Map list current-map upsert logic now lives in `src/storage/mapRecords.js` with dedicated CRUD-focused tests.
- Editor palette rendering and map-list card rendering now live under `src/ui/editor/` and `src/ui/map-list/`.
- Shared-link vs local-storage boot selection now lives in `src/storage/mapLoadPlan.js` with dedicated tests.
- Legacy tile-matrix payloads and legacy storage keys are now migrated at startup and rewritten into v2 storage.
- Remaining `features/*.js` entry files have been renamed to explicit controllers.

## Current State

- Editor, map list, and game views now follow a `controller + renderer + domain/storage helpers` split.
- The remaining work is product-level iteration on rules and editor capability, not cleanup of the transitional architecture.

## Migration Principle

- Keep share payloads and local storage aligned on the same `MapDefinition` codec.
- Keep compatibility layers explicit and one-way: read legacy data, rewrite to v2, then delete old keys.
