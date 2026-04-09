## 2024-04-09 - [Typing Latency from Unmemoized Array Operations]
**Learning:** Frequent React re-renders caused by keystrokes in `Chat.tsx` triggered O(N log N) conversation array filtering and sorting operations, leading to noticeable typing latency.
**Action:** Wrap expensive derived array calculations inside `useMemo` hooks, especially when the component handles user input events.
