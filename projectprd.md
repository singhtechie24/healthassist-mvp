<!-- 📘 Intelligent Health Assistant Web Platform
Product Requirements Document (PRD) + Technical Design Doc
0) Product vision & scope
•	Goal: a non clinical, AI assisted web app that (a) offers symptom guidance, (b) tracks mood/health logs, (c) sends simple reminders, (d) simulates an emergency response (fake ETA + steps), and (e) gathers usability feedback.
•	Non goals: clinical diagnosis; real dispatch; clinician integration; PHI export.
•	Success signals (MVP): user can complete one full session: login → chat → log mood → set reminder → run emergency simulation → submit feedback.
1) Target users & top user journeys
•	Users: students/young adults/general users with basic health app familiarity.
•	Core journeys:
1.	Onboard → accept consent → explore dashboard.
2.	Start Symptom Chat → get non clinical guidance + safety signposting.
3.	Add Mood Log → see weekly/monthly charts.
4.	Create Medicine Reminder → receive in app/local notification.
5.	Trigger Emergency Simulation → fake ETA + what to do checklist.
6.	Submit quick feedback (Google Form or in app).
2) Tech Stack (Locked & Stable)
Frontend
•	React 18 + TypeScript + Vite (fastest, stable).
•	Tailwind CSS + shadcn/ui (modern component library).
•	React Router (SPA routing).
•	React Query (server state).
•	React Hook Form + Zod (forms/validation).
•	Recharts (charts).
•	Lucide icons.
•	Framer Motion (light animations).
Backend / Infra
•	Firebase Authentication (anonymous + upgrade to email).
•	Firebase Firestore (data storage).
•	Firebase Hosting (deploy).
•	Firebase Analytics (opt-in, anonymised).
AI / APIs
•	OpenAI API (Chatbot, with multiple prompts/orchestration).
•	Google Maps API (optional, for emergency sim map render).
•	OpenFoodFacts API + QuaggaJS (optional food scanner).
•	Web Speech API (optional voice input).
Build Tools
•	Node 20 LTS.
•	pnpm package manager.
•	ESLint + Prettier.
•	Vitest + React Testing Library (unit/integration).
•	Playwright (E2E smoke).
•	GitHub Actions (CI/CD).
•	Testing: Vitest + React Testing Library (unit), Playwright (E2E smoke).
•	Notifications: Web Notifications API + Service Worker (in app/local). (FCM push optional; skip for speed.)
3) Architecture Overview
Pattern: Client-heavy SPA (React + Firebase).
Flow:
•	React UI → Firebase Auth (identity) → Firestore (data) → OpenAI API (chat) → optional APIs.
•	All data secured by Firebase rules.
•	Hosting via Firebase Hosting (tight integration).
•	Optional deploy to Vercel if migrated to Next.js later.
Why not Next.js?
•	Next.js pairs well with Vercel and SSR, but adds overhead.
•	For a 2-day sprint → Vite is leaner, faster, simpler.
•	Data flow: UI triggers actions → Firestore CRUD via client SDK (secured by rules) → OpenAI calls from client (preferred) or Callable Function (optional) → results shown, small metadata logged.
•	System architecture (high level)
•	Client (React SPA)
→ Firebase Auth (pseudonymous login)
→ Firestore (mood logs, reminders, chat metadata, emergency events)
→ OpenAI API (chat responses; non clinical, safe prompt)
→ (Optional) Google Maps JS (map render only)
→ Firebase Hosting (static deploy)
→ Service Worker (install for local notifications & offline cache)
5) Data Model
Collections:
•	users/{uid} → pseudonymous profile, settings.
•	moodLogs/{uid}/logs/{logId} → { dateISO, mood, note }.
•	reminders/{uid}/items/{remId} → { title, timeISO, recurrence, status }.
•	chatSessions/{uid}/sessions/{sid} → { startedAt, messagesCount, outcome }.
•	emergencyEvents/{uid}/events/{eid} → { triggeredAt, fakeETAmins, stepsShown }.
Retention: Data tied to account; deletable from Settings.
Collections & sample docs
•	users/{uid}
{ displayName?: string, createdAt, consentAcceptedAt, settings: { locale: "en", notifications: boolean } }
•	moodLogs/{uid}/logs/{logId}
{ dateISO, mood: 1..5, note?: string, createdAt }
•	reminders/{uid}/items/{remId}
{ title, timeISO, recurrence?: "none"|"daily", status: "active"|"done", createdAt }
•	chatSessions/{uid}/sessions/{sid}
{ startedAt, messagesCount, intents?: string[], outcome: "selfCare"|"seekCare"|"unknown" }
•	emergencyEvents/{uid}/events/{eid}
{ triggeredAt, fakeETAmins, stepsShown: string[] }
Indexes: typically not needed beyond single field; add composite if you query by uid + dateISO range.
6) Firebase Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }

    match /users/{uid} { allow read, write: if isOwner(uid); }
    match /moodLogs/{uid}/logs/{log} { allow read, write: if isOwner(uid); }
    match /reminders/{uid}/items/{doc} { allow read, write: if isOwner(uid); }
    match /chatSessions/{uid}/sessions/{doc} { allow read, write: if isOwner(uid); }
    match /emergencyEvents/{uid}/events/{doc} { allow read, write: if isOwner(uid); }
  }
}
7) Environment Variables
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=  # optional
8) UX & navigation (Pages)
•	Onboarding/Consent → Privacy, non diagnostic disclaimer, opt in analytics toggle.
•	Login (email link or anonymous + nickname).
•	Dashboard: quick tiles: Chat, Log Mood, Reminders, Emergency, Tips.
•	Chatbot: chat pane + “How my answer is generated” info popover.
•	Mood Log: rate 1–5, note; Charts (weekly/monthly).
•	Reminders: list, create/edit/delete; in app notifications.
•	Emergency Sim: “Call ambulance (sim)” → fake ETA + step checklist (+ optional map render).
•	Feedback: embedded Google Form or in app form submit.
Accessibility: WCAG 2.1 AA colors, ARIA labels, keyboard traps avoided, focus rings visible. Font sizes ≥ 14px, line height 1.5.
9) Feature specs (user stories, flows, acceptance)
9.1 Auth & Profile
User story: As a user, I want to log in and control my data.
Flow: Open → consent → Login (anonymous or email) → dashboard.
Acceptance:
•	Can create pseudonymous session.
•	Only sees their data.
•	Can delete account & purge data.
Auth & Profile
•	Login via anonymous (upgradeable).
•	Can delete account/data.
9.2 AI Symptom Chatbot (non clinical)
User story: I want quick, plain English guidance and safety signposting.
Flow: Start chat → describe symptoms → receive structured, non clinical guidance + “seek urgent care if…” flags → self care tips → link to emergency sim if needed.
Acceptance:
•	Returns response < 5s P95.
•	Includes non diagnostic disclaimer.
•	Provides explainability note (“This is AI, not medical advice.”)
Symptom Chatbot (AI, non-clinical)
•	Orchestrator routes intents (symptom, wellness, diet, injury, unknown).
•	Each intent has separate system prompt.
•	Output: JSON { summary, suggestions[], safetyNote?, nextSteps[] }.
•	Guardrails: disclaimers, safety notes, non-diagnostic.
OpenAI request (safe prompt):
•	System prompt (core):
“You are a non clinical health assistant. Provide general, educational guidance only. Do not diagnose. Include a ‘Safety note’ if red flag symptoms appear. Keep responses concise, plain language, and suggest contacting local emergency services if severe signs are present. If unsure, advise users to seek professional care.”
•	Tools/formatting (optional): return JSON with { summary, suggestions[], safetyNote?, nextSteps[] } and render nicely.
9.3 Mood Tracker + Dashboard
User story: I want to log my mood daily and see trends.
Acceptance:
•	Can add mood 1–5 with optional note.
•	Weekly/monthly chart renders (Recharts or Chart.js).
•	Data stored in Firestore under user.
Mood Tracker
•	CRUD logs.
•	Weekly/monthly charts.
9.4 Medicine Reminders (in app/local)
User story: I want simple reminders.
Acceptance:
•	Create/edit/delete reminders.
•	Local notification via Service Worker when tab open; fallback to prominent in app banner.
•	No push required for MVP (keep scope lean).
Reminders
•	CRUD reminders.
•	In-app local notifications (Service Worker).
9.5 Emergency Response Simulator
User story: I want to practice what to do in emergencies.
Acceptance:
•	“Call (Sim)” button shows fake ETA (random 4–10 min or seeded).
•	Step by step checklist (e.g., stay with patient, unlock door, medications ready).
•	Optional Google Map render centered on user city (no live routing needed).
Emergency Simulator
•	Simulated ETA (4–10 mins).
•	Step checklist.
•	Optional map render.
9.6 Health Tip of the Day
Acceptance:
•	Displays one tip/day (local JSON or Firestore collection).
•	Mark as read; change tip on new day.
Tips
•	One per day, static or Firestore.
9.7 Food Scanner (prototype) – optional
Acceptance:
•	Webcam barcode scan (QuaggaJS).
•	Fetch OpenFoodFacts; show calories/salt/ingredients if found.
•	Feature flag; safe to hide if unstable.
Food Scanner (optional)
•	Barcode via QuaggaJS.
•	Fetch OpenFoodFacts.
9.8 Voice Input (optional)
Acceptance:
•	Web Speech API for SpeechRecognition where available; graceful fallback to manual typing.
9.9 Feedback
Acceptance:
•	In app link to Google Form (or embedded).
•	Sends current app version and optional feature flags in URL params.
10) API integration details
OpenAI (client-side call)
•	Endpoint: Chat Completions (JSON mode optional).
•	Temperature: 0.2–0.5 for consistency.
•	Max tokens: ~500 out.
•	Safety: never store raw prompts with identifiers; log only counts & coarse intents.
•	Guardrails: pre check for disallowed terms; add “seek professional care” fallback if model returns risky content.
Google Maps (optional)
•	Use simple Maps JS for a static render; skip Directions API to save time/keys.
•	ETA: generate pseudo random value; explain “simulated ETA.”
OpenFoodFacts (optional)
•	GET by barcode → map fields to UI.
11) AI Prompt conditioning/control Strategy
Router Prompt: classify intent → { intent, redFlags }.
Domain Prompts: symptom | wellness | diet | injury.
Shared System Prompt:
“You are a non-clinical health assistant. Provide educational, plain guidance. Do not diagnose. Add safety notes if severe. Always state: ‘I am an AI, not a clinician.’”

example : System:
“You are a non clinical health assistant. Provide brief, plain language guidance. Do not diagnose. Include a ‘Safety note’ if severe/urgent symptoms are mentioned. Encourage contacting local emergency services when appropriate. State limitations and that you are an AI. Keep total response under 180 words.”
User (template):
“Age group: {18–24/25–34/35–44/45+}. My concern: {free text}. Duration: {hours/days}. Severity: {mild/moderate/severe}. Other notes: {optional}.”
JSON schema (optional):
{ summary, suggestions: string[], safetyNote?: string, nextSteps: string[] }

12) Privacy, consent & compliance posture
•	Consent gate on first use: app purpose, non diagnostic disclaimer, data usage (anonymised, deletable).
•	Data minimisation: no DOB, no address, no full names required.
•	Deletion: “Delete my data” in Settings → cascade deletes in user collections.
•	Analytics: toggle; if off, disable Firebase Analytics collection.
•	Logs: store minimal chat metadata (counts, timestamps), not full medical details.
13) Testing strategy
•	Unit: util functions, API wrappers, components without heavy DOM. (Vitest)
•	Integration: forms (React Hook Form), Firestore CRUD via emulator.
•	E2E (smoke): Playwright: onboarding → login → mood add → reminder create → chat one turn → emergency sim.
•	Manual exploratory: across Chrome + Mobile Chrome.
•	Accessibility checks: @axe-core happy path, keyboard nav.
Sample E2E smoke (acceptance):
•	Given I’m a new user, when I accept consent and log in anonymously, then I see the dashboard.
•	When I open Chatbot and send a message, then I get a response with a safety note if needed.
Unit: utils, components.
Integration: Firestore CRUD.
E2E (Playwright):
•	Consent → Login → Dashboard.
•	Add mood → create reminder → chat → emergency sim.
Accessibility: axe-core, keyboard nav.
14) Performance & quality
•	Budgets: First load < 200 KB JS (after gzip) for MVP; code split feature routes.
•	Lazy load: Maps, scanner, voice input behind dynamic imports.
•	Caching: Service Worker to cache static assets; IndexedDB optional for mood logs draft.
•	Lighthouse targets: PWA installable (optional), Perf > 70, A11y > 90.
•	Chatbot <5s response.
14) CI/CD & branching
•	Branching: main (prod), dev (staging), feature branches feat/*.
•	Checks: lint, typecheck, unit tests, build.
•	Deploy: GitHub Actions → Firebase Hosting (dev preview channels, main to prod).
•	Versioning: simple v0.x.y tags.
16) Feature flags
•	FF_TIPS (on), FF_SCANNER (off by default), FF_VOICE (off), FF_MAP (on if key present).
•	Implement as const flags = { ... } loaded from /public/flags.json or Firestore.

16) Design system & styling
•	Tailwind config: base scales, brand colors, dark mode class.
•	Components: Button, Card, Input, Select, Modal, Toast, Sheet (from shadcn/ui).
•	Charts: Recharts (BarChart, LineChart for moods).
•	Icons: Lucide (Ambulance, Pill, Smile, MessageCircle).
17) Risks & mitigations
•	OpenAI latency/cost: cache last response in memory; set token limits.
•	Browser notifications blocked: always show in app reminder banners.
•	API keys exposure: use import.meta.env; never commit real keys; rotate if leaked.
•	Small sample size: manage in write up (already handled in Methodology).
18) Definition of Done
•	Meets acceptance criteria.
•	Tested (unit + E2E).
•	Accessible.
•	No console errors.
•	Screenshots captured for dissertation.
 -->
