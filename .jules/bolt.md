## 2024-04-08 - Supabase N+1 Pattern
**Learning:** In standard Supabase deployments (such as with devpulse's chat counts pattern), performing multiple parallel separate `.select()` queries to count or query records per-conversation via `Promise.all` triggers a severe N+1 problem.
**Action:** Always combine the queries into a single `.select()` call by dynamically constructing a nested `.or()` string like `and(field_a.eq.A,field_b.eq.B)` and then aggregating the values back in JavaScript. Remember to check that the condition array is not empty before submitting the `.or()` filter.
