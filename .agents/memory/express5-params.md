---
name: Express 5 req.params type casting
description: Express 5 types req.params values as string | string[], requiring explicit casting before parseInt or decodeURIComponent.
---

## The Rule
Always cast `req.params["key"]` with `String(...)` before passing to `parseInt` or `decodeURIComponent`:

```ts
const id = parseInt(String(req.params["id"] ?? ""));
const emoji = decodeURIComponent(String(req.params["emoji"] ?? ""));
```

**Why:** Express 5's TypeScript types declare `req.params` values as `string | string[]`. `parseInt` and `decodeURIComponent` only accept `string`, so TypeScript raises TS2345 without an explicit cast.

**How to apply:** Every route handler that reads path parameters should use this pattern. Run `grep -n "req.params\[" src/routes/*.ts` to find all occurrences and verify they all use `String()` wrapping.
