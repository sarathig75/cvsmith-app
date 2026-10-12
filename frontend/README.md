# CVSmith Frontend

React 18 + TypeScript + Vite + Tailwind CSS, React Router, Zustand, Axios.

## Setup
```bash
cp .env.example .env     # set VITE_API_URL and (optionally) VITE_GOOGLE_OAUTH_CLIENT_ID
npm install
npm run dev              # http://localhost:5173
```
Other scripts: `npm run type-check`, `npm run test -- --run`, `npm run build`.

Docker: `docker build -t cvsmith-frontend . && docker run -p 5173:5173 cvsmith-frontend` (Vite dev server on 0.0.0.0).

## Environment
| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8000`) |
| `VITE_API_TIMEOUT` | Request timeout ms |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google Web client ID. If unset, the Google button is replaced by a note. |

## Structure
- `src/components/{Auth,Canvas,Common,Settings}`, `src/pages` (Pricing, Verify)
- `src/store` - `authStore` (token + user persisted to localStorage, try/catch), `uploadStore` (in-memory pending CV)
- `src/services` - `api.ts` (Axios, Bearer interceptor, 401 clears auth so route guards redirect to `/`), auth/cv services
- `src/types` - mirrors `docs/API_CONTRACT.md`; `cvDraft.ts` is local-only canvas state
- `src/utils/validation.ts` - file, email, password rules

## Routes
`/` onboarding (logged-in users go to `/canvas`), `/canvas` `/pricing` `/settings` (auth required), `/verify?token=`.

## Notes
- Canvas edits are local state only; backend wiring is Week 5.
- Max CV size is 10MB (per contract), PDF or .docx only.
