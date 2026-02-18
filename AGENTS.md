# AGENTS.md

This file defines execution standards for agents working in this repository.

## 1) TODO Discipline

- Start every non-trivial task with a concrete TODO list before making changes.
- Keep TODOs small, testable, and outcome-focused.
- Maintain TODO status as `todo`, `in_progress`, `done`, or `blocked`.
- Do not mark a TODO `done` until verification has been run (tests, build, or direct runtime check).

## 2) Ticketization (\"tizketization\")

- Break all medium/large requests into numbered tickets before implementation.
- Each ticket must include:
  - Scope (what is included, what is explicitly out of scope).
  - Acceptance criteria (clear pass/fail conditions).
  - Verification plan (which command/test proves completion).
  - Dependencies/blockers.
- Keep ticket size incremental. Prefer multiple small tickets over one large ticket.
- Execute tickets in dependency order and continuously update ticket status.

## 3) Live Progress Documentation

- Document progress live while work is happening, not only at the end.
- For each ticket, log:
  - Start timestamp.
  - Current status.
  - Key actions taken.
  - Evidence (commands run, test/build outcomes, notable errors).
  - Next action.
- Record blockers immediately with exact failure details and required unblock action.
- Keep progress notes concise but sufficient for a handoff without extra context.

## 4) Progress Until Fully Done

- Default behavior is to continue execution until all accepted tickets are complete.
- Do not stop at partial implementation if remaining work is executable.
- If blocked, attempt at least one practical workaround before escalating.
- Escalate only with specific blocking facts, what was tried, and the smallest decision needed.
- A task is complete only when:
  - Acceptance criteria are met.
  - Verification has passed.
  - Final status/progress documentation is updated.

## 5) No Fallback Implementations

- Do not implement fallback code paths unless the user explicitly requests a fallback.
- When a direction is chosen (for example, WebAudio-only), remove or avoid alternate legacy paths (for example, `HTMLAudioElement` pools).
- Do not keep "temporary compatibility" branches by default.
- If a no-fallback decision increases risk, document the risk in ticket scope/acceptance criteria and proceed without adding fallback paths.
