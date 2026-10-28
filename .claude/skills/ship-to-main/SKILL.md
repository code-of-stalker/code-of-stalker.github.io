---
name: ship-to-main
description: Merge an approved branch into main, which deploys the live site. Use only after Art explicitly approved shipping this exact change («пушим», «на сайт», «ок, пуш»).
argument-hint: "[branch, default: current]"
---

Branch: $ARGUMENTS (empty means the current branch)

0. **Precondition.** Art's explicit OK in this conversation for what is being shipped. If he
   asked to ship several branches together, collect every one of them first. Without the OK,
   stop and ask him.
1. **Update the branch.** `git fetch origin`, then merge `origin/main` into the branch. Merge,
   do not rebase or force-push a pushed branch. If both sides changed Rust sources, rebuild the
   generated outputs from the merged source.
2. **Checks.** `npx tsc --noEmit`, `npx expo lint`, `npm run test:web-cache`, the build script of
   every touched crate (afterwards `git status` shows no changes under `public/graphics/`),
   `npm run export:web`, and a quick look at the changed pages in the exported app.
3. **Record first.** Run `/handoff` on the branch, writing the change as shipped to `main` today,
   so the merge carries the updated state.
4. **Merge.** `git switch main`, `git pull --ff-only`, `git merge --no-ff <branch> -m "Merge <what, in words>"`,
   `git push origin main`. A big binary push can fail with a GitHub 500: retry, or push the
   commits one by one.
5. **Deploy.** Follow the "Deploy web build to GitHub Pages" run (`gh run list --workflow pages.yml`
   if `gh` is installed, otherwise the repo's Actions page). Tell Art in Russian: what shipped,
   the merge commit, the deploy result. He checks the live site himself.
