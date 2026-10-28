---
name: handoff
description: Save where the work stands into docs/claude/state.md (and new lessons into docs/claude/art-feedback.md) so it survives /clear or a new session. Use when a task ends, when Art is about to /clear, or when the context is getting large.
---

1. Update `docs/claude/state.md`: the work branch and its head, what is done, approved or
   shipped (merge commit, date), what waits for Art, the next step. Edit stale lines instead
   of appending history; keep the file under ~150 lines. Detail that only matters for one
   scene goes into that crate's `README.txt`.
2. New taste notes or rejections from Art go into `docs/claude/art-feedback.md`, one line each
   with the reason. A new standing rule from Art goes into `CLAUDE.md` only when he states one.
3. Commit on the current work branch: `docs: handoff — <topic>`. Never commit to `main` for
   this alone: on `main`, create a branch first; it ships with the next approved change.
   If `state.md` conflicts later, keep the facts from both sides.
4. Tell Art in Russian in one or two lines that the state is saved and `/clear` is safe.
