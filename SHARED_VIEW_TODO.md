# App Improvement Todo

These items are intentionally kept separate so each one can be planned and implemented one at a time.

## ✅ 1. Main App Settings Page

- Add a dedicated `Settings` page to the main app.
- Move existing settings-style controls into this page where appropriate.
- Add any new future configuration options here instead of scattering them across feature pages.
- Decide what belongs in settings during the implementation plan before moving controls.
- add cycle names and add active cycle rename in setting

## ✅ 2. Shared View Cycle Info Header

- Show only the cycle name and status in the shared view header.
- Example:
  - `Cycle: Meal_Summer-26_1`
  - `Status: Active`
- Keep this compact and informational, not a large summary section.

## ✅ 3. Shared View Access Code Entry Page Polish

- Make the shared landing page feel like a deliberate access screen.
- Include:
  - `Enter Access Code`
  - short helper text
  - invalid-code error state
  - loading state before redirect or data load
- Keep the direct shared link behavior unchanged.

## ✅ 4. Shared View Member-Focused Summary Mode

- Add a quick selector in shared view:
  - `All Members`
  - `Single Member`
- In single-member mode, allow the viewer to select their name.
- Show only that member's summary row/card so the member does not need to scan the full list.
- Keep all-members mode as the default.

## ✅ 5. Table usability
- make horizontal tables easier to read on mobile:
  - stronger sticky first column
  - subtle row highlighting
  - clearer total row styling
- this is a UI improvement, not a new feature, but it matters
for now apply it only in mobile view. for shared view  meal table

## ✅ 6. Shared View Empty And No-Data States

- Improve shared-view empty states for:
  - no expenses yet
  - no meal logs yet
  - invalid access code
  - disabled share link
- Make each message specific enough that the viewer understands what happened.


# Fix needed later

## ⌛ 1. Shared view Access Code Entry page Fix
- Remove the Read only badge from the shared view Access Code Entry page
- Instead of "open the read-only cycle view." write "open the shared view."
- Remove "Full shared links still open directly." this text from the page
