## 2024-05-24 - [Avoid Direct Prop Mutation]
**Learning:** In React, `.sort()` mutates the original array in place, which is an anti-pattern when dealing with props. Always clone the array using the spread operator (e.g., `[...members].sort(...)`) before sorting.
**Action:** When sorting prop arrays, always prepend `[...arrayName]` to prevent mutating the original prop array.
