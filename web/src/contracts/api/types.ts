// Shim: re-exports from the canonical contract file at the repo root.
// This file exists because Person 5's imports use the path
// '../../../contracts/api/types' which, relative to web/src/features/*/,
// resolves here (web/src/contracts/api/types).
export * from '../../../../contracts/api/types';
