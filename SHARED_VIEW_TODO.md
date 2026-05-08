# Shared View Improvement Todo

These items are intentionally kept separate so each one can be planned and implemented one at a time.

## 1. Cycle Info Header

- Show only the cycle name and status in the shared view header.
- Example:
  - `Cycle: Meal_Summer-26_1`
  - `Status: Active`
- Keep this compact and informational, not a large summary section.

## 2. Access Code Entry Page Polish

- Make the shared landing page feel like a deliberate access screen.
- Include:
  - `Enter Access Code`
  - short helper text
  - invalid-code error state
  - loading state before redirect or data load
- Keep the direct shared link behavior unchanged.

## 3. Member-Focused Summary Mode

- Add a quick selector in shared view:
  - `All Members`
  - `Single Member`
- In single-member mode, allow the viewer to select their name.
- Show only that member's summary row/card so the member does not need to scan the full list.
- Keep all-members mode as the default.

## 4. Empty And No-Data States

- Improve shared-view empty states for:
  - no expenses yet
  - no meal logs yet
  - invalid access code
  - disabled share link
- Make each message specific enough that the viewer understands what happened.

