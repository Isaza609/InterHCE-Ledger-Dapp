# Repository Guidelines

## Project Structure & Module Organization
This repository is split by responsibility. `frontend/` contains the React + Vite DApp (`src/app`, `src/pages`, `src/features`, `src/shared`). `backend/` contains the Express + TypeScript API and HCE/FHIR services under `src/routes`, `src/hce`, and `src/docs`. `contracts/` is reserved for Solidity sources, tests, and deployment scripts, but is currently scaffolded only (`contracts/`, `test/`, `scripts/`). Shared cross-package artifacts belong in `shared/`. Product and architecture documentation lives in `docs/`, with planning material in `docs_plan/` and developer notes in `docs_dev/`.

## Build, Test, and Development Commands
Run commands from each package directory unless noted otherwise.

- `cd frontend && npm run dev`: start the DApp on Vite dev server (`http://localhost:5173`).
- `cd frontend && npm run build`: type-check and build the frontend bundle.
- `cd frontend && npm run preview`: serve the production frontend locally.
- `cd backend && npm run dev`: start the API with hot reload on port `3001` by default.
- `cd backend && npm run build`: compile backend TypeScript to `backend/dist/`.
- `cd backend && npm run start`: run the compiled backend.

Root `npm test` is a placeholder and should not be used as a quality signal.

## Coding Style & Naming Conventions
Use TypeScript with strict compiler settings already enabled in `frontend/tsconfig.json` and `backend/tsconfig.json`. Follow the existing style: 2-space indentation, semicolons, double quotes, and named exports for shared modules. Use `PascalCase` for React components (`CrearEpisodioPage.tsx`), `camelCase` for functions and variables, and descriptive Spanish domain names where the codebase already uses them (`validarEpisodio`, `documentoClinicoService`).

## Testing Guidelines
There is no committed automated test suite yet. When adding tests, place frontend tests next to the feature or under `frontend/src/**/__tests__/`, backend tests under `backend/src/**/__tests__/` or a dedicated `backend/test/`, and contract tests in `contracts/test/`. Name files `*.test.ts` or `*.test.tsx`. At minimum, validate backend episode routes and HCE schema behavior before merging changes.

## Commit & Pull Request Guidelines
Current history uses short Spanish commit messages (`primer commit`, `Nuevo cambio`). Keep that pattern, but make messages imperative and specific, for example: `Agrega validacion de episodios`. PRs should include scope, affected package(s), manual test steps, linked issue or planning doc, and screenshots for frontend UI changes. Call out any API or contract interface changes explicitly.

## Configuration Notes
Frontend expects the backend at `VITE_API_BASE_URL`; backend defaults to `PORT=3001`. Do not commit generated `dist/` output, credentials, or patient data fixtures.

## Modo de respondeme en español