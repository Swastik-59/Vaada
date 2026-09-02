# Frontend

Next.js App Router.

- `/` public marketing site. GSAP motion, reduced-motion respected. No invented recovery totals.
- `/login` operator sign-in. Session cookies against the FastAPI API.
- `/queue` live recovery queue. Requires authentication.
- `/cases/[id]` case detail, decision trace, compliance, override.

API access goes through `lib/api.ts`. The browser never stores tenant ids or roles as an authorization source.

The recovered-amount figure, if shown in the console, must come from `GET` metrics on the backend. The public page must not animate a fake rupee counter.
