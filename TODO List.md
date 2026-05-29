1. add shared view PWA install experience
- Add dedicated MealTrack Shared web manifest
- Switch manifest metadata for shared routes
- Remember the last shared Meal Code locally
- Open the saved shared dashboard from the installed shared app
- Add shared-view install controls

2. add live shared dashboard updates
- Broadcast full shared payloads over server-sent events
- Update shared view data without page reload after meal, expense, deposit, member, and cycle changes
- Reuse the shared payload loader for initial fetch and live broadcasts

3. rename app to MealTrack
- Update visible app branding from MealManager to MealTrack
- Rename PWA manifest, page titles, and social metadata
- Update install prompt copy and package metadata

4. restrict negative expenses
before i have allowed negative expense amount for adjustments, now make it allow only in pending-cycle expense corrections
- Allow negative expense amounts only for pending-cycle corrections
- Enforce active-cycle positive expense validation in dashboard and expenses forms
- Add data-layer guards for negative expense create and update calls

5. Add skeleton loaders for better UX
- Replace plain loading states with skeleton layouts for app, shared view, and settings