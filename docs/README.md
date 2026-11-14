# EmberTrace Docs

Read in order. When two docs disagree, the **newer** one wins (see "Precedence" below).

| # | Doc | What it is | Date | Status |
|---|---|---|---|---|
| 00 | [Problem Statement](00-problem-statement.md) | NASA Space Apps 2026, Challenge 15, and our definition of done | — | Final |
| 01 | [PRD](01-prd.md) | Users, Must/Should/Could features, NFRs, validation criteria (V1 to V13), open decisions (D1 to D10) | 12 Nov | v1.0 draft |
| 02 | [Architecture & Methodology](02-architecture-methodology.md) | The science: harmonization strategy, the 7 pipeline stages, validation plan | 9 Nov | ⚠️ **Outdated draft**, see banner |
| 03 | [Implementation Plan](03-implementation-plan.md) | Hackathon build plan: 5 owners, folders, handoff files H1 to H4, task IDs, schedule (IST) | 14 Nov | **Current** |
| 04 | [API Spec](04-api-spec.md) | `GET /api/meta`, `POST /api/calendar`, downloads, errors, mock responses | 13 Nov | v0.1 draft |
| 05 | [Task Delegation (prep)](05-task-delegation-prep.md) | Pre-hackathon prep roles (12 to 13 Nov) | 12 Nov | Historical, superseded by 03 |
| 06 | [Deployment](06-deployment.md) | Google Cloud Run setup, deploy commands, what the code must do to run there | 14 Nov | **Current** |

## Precedence

1. **Implementation Plan (03)**: decisions closed at kickoff and corrected constants
2. **API Spec (04)**: the API contract
3. **PRD (01)**: product requirements
4. **Architecture (02)**: science and methodology, where not overridden above

## Role names across docs

The prep docs (01, 04, 05) use **Roles 1 to 5**. The build plan (03) uses **Persons 1 to 5** with different responsibilities. They do not map one to one:

| Prep (Task Delegation) | Build (Implementation Plan) |
|---|---|
| Role 1: Pipeline Verifier | Person 1: Ingest Engineer (stages 1 to 4) |
| Role 2: Conversion Scientist | Person 2: Calibration & Data Engineer (stages 5 to 7) |
| Role 3: Product Lead (PRD) | (no product role) |
| Role 4: API and Backend Lead | Person 3: Backend Engineer |
| Role 5: UI Prototype | Persons 4 and 5: Frontend (app/map, charts) |

## Docs still to write (from the Implementation Plan)

- `DECISIONS.md`: decisions closed at the Sat 09:20 kickoff
- `explainer.md`: plain-language harmonization text for the app (CAL-10)
- `errata.md`: PRD corrections, e.g. the NOAA-21 date (setup task, Person 2)
- `submission/`: slides, video, submission page material
