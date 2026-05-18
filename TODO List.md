# Notice Feature Implementation
Managers can post a notice with a title, content, and expiry (duration in hours or a specific date-time). Active, non-expired notices are displayed as an animated marquee ticker below the shared view header.


#### Manager UI — Settings page notice card

Add a new NoticeSettingsCard component below ShareSettingsCard. It allows the manager to:

- Post a notice — Title (text input), Content (textarea), and expiry:
    - Toggle between "Duration (hours)" (number input) and "Specific date & time" (datetime-local input)
- View active notice — If one exists and is not expired, show its title, content, and expiry time.
- Delete active notice — Button to delete the current active notice.

# Fixes & Improvements
- Add fixed left Notice label with megaphone icon
- Remove megaphone icon from the scrolling notice text
- Softene the ticker from loud orange to amber styling
- Adde fade edges and more spacing before the notice text enters
- Adjust the marquee speed
- Make posting a new notice expire existing active notices first
- Adjuste Settings text to "Specific date & time"
- Rename the notice section in setting to "Post Notice"
- Make short notices scroll continuously without visible gaps
- Remove right-side fade from the shared notice ticker
- Align notice settings colors with the app theme
- Add edit mode for the active shared-view notice