---
name: App.tsx required provider wrappers
description: The design subagent may omit QueryClientProvider, TooltipProvider, and WouterRouter from App.tsx — always verify these are present after a first build.
---

## The Rule
After any design subagent completes a first build for a react-vite artifact, verify `App.tsx` contains these wrappers (in this order):

```tsx
<QueryClientProvider client={queryClient}>
  <TooltipProvider>
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {/* app content */}
    </WouterRouter>
    <Toaster />
  </TooltipProvider>
</QueryClientProvider>
```

**Why:** The design subagent rewrites `App.tsx` from scratch and may not include `QueryClientProvider` or the `WouterRouter` base path. Without `QueryClientProvider`, any hook that uses `useQuery` (including auth checks) throws "No QueryClient set" immediately on mount. Without `WouterRouter` with the correct base, routing breaks in the proxied preview environment.

**How to apply:** Take a screenshot after restarting the frontend workflow. If you see a "No QueryClient set" runtime error, check `App.tsx` and add the missing wrappers.
