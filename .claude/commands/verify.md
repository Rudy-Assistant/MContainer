Run the full verification suite:

1. `npx tsc --noEmit` → report error count
2. `npx vitest run` → report test count (passed / failed / todo)
3. Run `/simplify` on changed files
4. Start dev server if not running (`npm run dev`)
5. Walk through the browser verification checklist provided in the current sprint prompt
6. Report PASS/FAIL for each checklist item verbatim

Do NOT proceed past any FAIL without attempting a fix. If the fix exceeds 10 lines, report the issue and stop.
