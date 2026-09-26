# FocusFlow

> **Live demo:** https://focus-flow-liard-delta.vercel.app

FocusFlow is a single-page productivity web app built around the Pomodoro technique with tasks, streaks, and simple focus analytics. It runs entirely in the browser and persists data to `localStorage`.

## Features

- Pomodoro timer with Focus / Short Break / Long Break modes
- Task manager with priorities and Pomodoro counts
- Stats view: weekly bar chart, productivity score, and session history
- Streak tracking
- Ambient sounds (Web Audio API)
- Settings: durations, goal, notifications, and sound toggles
- Keyboard shortcuts: Space (play/pause), R (reset), S (skip)

## Project Structure

- `index.html`: UI layout and view containers
- `style.css`: design system + responsive styling
- `app.js`: application logic + state persistence
- `walkthrough.md`: original build walkthrough/notes

## Run Locally

Option A (quickest):

1. Open `index.html` directly in your browser.

Option B (recommended, avoids browser file URL quirks):

```bash
# from the FocusFlow folder

> **Live demo:** https://focus-flow-liard-delta.vercel.app
python -m http.server 5173
```

Then open `http://localhost:5173/`.

## Data & Persistence

FocusFlow stores app state in `localStorage` under the key `focusflow_state`. Clearing browser site data will reset the app.

## Screenshots

Add images under `docs/screenshots/` and update the links below.

Suggested shots:

- `docs/screenshots/timer.png`
- `docs/screenshots/tasks.png`
- `docs/screenshots/stats.png`
- `docs/screenshots/settings.png`

Placeholders (these will show as broken images until you add the files):

![Timer](docs/screenshots/timer.png)
![Tasks](docs/screenshots/tasks.png)
![Stats](docs/screenshots/stats.png)

## Notes

- This project has no backend and no secrets should be committed.
- If you later add APIs/keys, keep them in env vars or server-side code and add them to `.gitignore`.
