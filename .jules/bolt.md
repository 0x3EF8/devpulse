## 2026-04-07 - [Bolt: Inline useMemo in JSX props fails with React Compiler]
**Learning:** When using Next.js 16 with React Compiler, placing `useMemo` directly inside JSX props causes an ESLint error (`react-hooks/preserve-manual-memoization`). The compiler cannot preserve the memoization.
**Action:** Always extract memoized values to local variables before the component's `return` statement.
