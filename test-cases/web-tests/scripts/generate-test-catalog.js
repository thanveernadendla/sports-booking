const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const outputPath = path.join(__dirname, '..', 'reports', 'sportzone-test-case-catalog.xlsx');

const journeys = [
  ['Customer registers with a new mobile number', 'Open registration, enter a new 10-digit number, name, and password, then submit.', 'Unique valid customer details', 'Account is created, session starts, and customer dashboard opens.'],
  ['Customer logs in with valid credentials', 'Open login, enter an existing customer mobile and password, then submit.', 'Approved customer account', 'Customer session is created and dashboard opens.'],
  ['Customer logs out and protected action redirects to login', 'Log out, then attempt to submit a booking.', 'Signed-in customer session', 'Session is cleared and protected action routes to authentication.'],
  ['Customer selects an approved venue', 'Open booking dashboard and inspect the venue selector.', 'At least one approved venue', 'Approved venue names and prices are shown.'],
  ['Customer selects an available time slot', 'Select a venue and inspect available time options.', 'Venue with free slots today', 'Only available valid time slots are selectable.'],
  ['Customer submits a booking request', 'Select venue and time, enter a team name, and submit.', 'Signed-in customer; available slot', 'Booking appears as Pending with matching venue, time, team, and fee.'],
  ['Customer cannot reserve an occupied slot', 'Submit a second booking for a Pending or Approved slot.', 'Slot already reserved by another booking', 'Request is rejected and no duplicate booking is stored.'],
  ['Customer removes their own booking', 'Create a booking and use its Remove action.', 'Signed-in booking owner', 'Booking is removed and its slot becomes available.'],
  ['Customer cannot remove another customer booking', 'Attempt to delete another user booking using its ID.', 'Two customer accounts and one booking', 'Request is denied and original booking remains.'],
  ['Customer submits tournament venue request', 'Complete tournament name, venue, date, and notes, then submit.', 'Signed-in customer; approved venue', 'Request appears in admin queue with Pending status.'],
  ['Admin logs in with valid credentials', 'Open admin login and submit configured admin credentials.', 'Admin account configured', 'Admin dashboard opens and admin session is stored.'],
  ['Admin login rejects invalid credentials', 'Submit an incorrect admin password.', 'Admin login page', 'Login is rejected without creating an admin session.'],
  ['Admin views dashboard metrics', 'Open dashboard and compare rendered metrics to admin API data.', 'Admin session; seeded data', 'Users, requests, bookings, and revenue metrics render consistently.'],
  ['Admin approves a customer booking', 'Open booking approvals and approve a Pending booking.', 'Pending booking; admin session', 'Booking status changes to Approved and customer sees update.'],
  ['Admin rejects a customer booking', 'Open booking approvals and reject a Pending booking.', 'Pending booking; admin session', 'Booking status changes to Rejected and slot is released.'],
  ['Admin approves tournament venue request', 'Open request queue and approve a Pending request.', 'Pending tournament request', 'Request status changes to Approved.'],
  ['Admin rejects tournament venue request', 'Open request queue and reject a Pending request.', 'Pending tournament request', 'Request status changes to Rejected.'],
  ['Admin changes venue fee and saves', 'Edit a venue fee and save the change.', 'Admin session; existing venue', 'Updated fee persists and appears in customer venue selector.'],
  ['Admin adjusts venue fee using increment control', 'Increase and then decrease venue fee using controls.', 'Admin session; existing venue', 'Fee changes by the displayed increment and returns to original.'],
  ['Admin adds a venue', 'Submit a unique venue name, category, and positive fee.', 'Admin session', 'Venue is stored and appears in approved venue selectors.'],
  ['Admin marks venue inactive', 'Change venue status to Inactive.', 'Admin session; approved venue', 'Venue is absent from customer booking options.'],
  ['Admin creates a tournament', 'Submit tournament name, sport, date, and optional venue.', 'Admin session', 'Tournament appears in the admin tournament list.'],
  ['Admin closes an open tournament', 'Change tournament status from Open to Closed.', 'Admin session; open tournament', 'Tournament status persists as Closed.'],
  ['Admin logs out and loses dashboard access', 'Log out, then navigate directly to admin dashboard.', 'Admin session', 'Admin session is cleared and login page is shown.'],
  ['Customer sees booking status after admin decision', 'Create booking, approve it as admin, and refresh customer view.', 'Customer and admin accounts', 'Customer view reflects the latest booking status.']
];

const functionalCases = [
  ['Registration rejects empty name', 'Name=""; valid phone and password', 'Required-name validation appears; no account is created.'],
  ['Registration rejects whitespace-only name', 'Name="   "; valid phone and password', 'Blank name is rejected or normalized before account creation.'],
  ['Registration rejects empty phone', 'Phone=""', 'Required-phone validation appears; no request is sent.'],
  ['Registration rejects a 9-digit phone', 'Phone=123456789', 'API returns validation error; account is not created.'],
  ['Registration rejects alphabetic phone', 'Phone=abcdefghij', 'Invalid phone is rejected; account is not created.'],
  ['Registration rejects special-character phone', 'Phone=12-34-56-78', 'Invalid phone is rejected unless normalized to exactly ten digits by documented policy.'],
  ['Registration rejects missing password', 'Password=""', 'Required-password validation appears; no account is created.'],
  ['Registration rejects duplicate phone', 'Reuse a phone already registered', 'Duplicate account is rejected without changing the existing account.'],
  ['Registration accepts normalized country prefix', 'Phone=+91 followed by a valid 10-digit number', 'Phone follows documented normalization policy and account is created once.'],
  ['Login rejects unknown phone', 'Valid-format phone not registered', 'Login fails with a non-sensitive authentication message.'],
  ['Login rejects wrong password', 'Registered phone; incorrect password', 'Login fails and session remains absent.'],
  ['Login rejects empty phone', 'Phone=""; password populated', 'Required-field validation appears.'],
  ['Login rejects empty password', 'Registered phone; Password=""', 'Required-field validation appears.'],
  ['Booking rejects empty team name', 'Team=""', 'Required-field validation blocks submission.'],
  ['Booking rejects whitespace-only team name', 'Team="   "', 'Blank team is rejected; no booking is stored.'],
  ['Booking rejects missing venue', 'Venue=""', 'Request is rejected and no booking is stored.'],
  ['Booking rejects missing time', 'Time=""', 'Request is rejected and no booking is stored.'],
  ['Booking rejects unknown venue', 'Venue=Unknown Test Venue', 'API returns validation error and database is unchanged.'],
  ['Booking rejects unsupported time', 'Time=25:99', 'API returns validation error and database is unchanged.'],
  ['Booking rejects zero-width team name', 'Team contains only zero-width characters', 'Input is rejected or safely normalized; no misleading booking is stored.'],
  ['Tournament request rejects empty title', 'Tournament name=""', 'Required-field validation prevents submission.'],
  ['Tournament request rejects missing venue', 'Venue=""', 'Request is rejected and no row is created.'],
  ['Tournament request accepts optional notes omitted', 'Valid title and venue; notes omitted', 'Request is created with empty notes.'],
  ['Tournament request handles past date according to policy', 'Requested date is yesterday', 'Date is rejected or accepted according to published booking policy.'],
  ['Venue fee rejects zero', 'Fee=0', 'Form/API rejects non-positive fee.'],
  ['Venue fee rejects negative amount', 'Fee=-1', 'Form/API rejects negative fee.'],
  ['Venue fee rejects nonnumeric amount', 'Fee=abc', 'Validation prevents an invalid fee from being stored.'],
  ['Venue creation rejects missing category', 'Name and fee set; category empty', 'Required-category validation appears.'],
  ['Tournament creation rejects missing sport', 'Name set; sport empty', 'Required-sport validation appears.'],
  ['Date inputs reject malformed date', 'Date=not-a-date', 'Invalid date cannot be submitted or persisted.']
];

const apiCases = [
  ['GET configuration returns venue list', 'GET /api/config', 'HTTP 200; venues, timeSlots, and currency are present.'],
  ['GET dashboard stats returns numeric counts', 'GET /api/dashboard/stats', 'HTTP 200; count and revenue fields have expected types.'],
  ['GET bookings returns a JSON array', 'GET /api/bookings', 'HTTP 200; response is an array.'],
  ['GET slots filters by approved venue', 'GET /api/slots?venue=<approved>', 'HTTP 200; only matching venue and available slots are returned.'],
  ['GET slots handles unknown venue', 'GET /api/slots?venue=<unknown>', 'HTTP 200 with an empty venue list.'],
  ['POST customer registration creates account', 'POST /api/auth/register with valid name, phone, password', 'HTTP 201; token and public user are returned.'],
  ['POST customer login returns session token', 'POST /api/auth/login with valid credentials', 'HTTP 200; token and public user are returned.'],
  ['POST admin login returns admin session', 'POST /api/admin/login with valid admin credentials', 'HTTP 200; admin token and public user are returned.'],
  ['POST booking without token is denied', 'POST /api/bookings without Authorization', 'HTTP 401; booking is not created.'],
  ['POST booking with invalid token is denied', 'POST /api/bookings with malformed Bearer token', 'HTTP 403; booking is not created.'],
  ['POST booking with valid customer token succeeds', 'POST /api/bookings with valid approved customer and available slot', 'HTTP 201; persisted booking fields match request and venue fee.'],
  ['POST duplicate booking returns conflict', 'POST same venue, date, and time twice', 'Second request returns HTTP 409; exactly one booking exists.'],
  ['POST booking with invalid time is rejected', 'POST booking with time=25:99', 'HTTP 400; database remains unchanged.'],
  ['POST tournament request with valid token succeeds', 'POST /api/tournament-venue-requests with valid payload', 'HTTP 201; Pending request is persisted.'],
  ['POST tournament request without token is denied', 'POST /api/tournament-venue-requests without Authorization', 'HTTP 401; request is not created.'],
  ['DELETE booking by owner succeeds', 'DELETE /api/bookings/:id using owner token', 'HTTP 200; booking is removed.'],
  ['DELETE booking by non-owner is denied', 'DELETE /api/bookings/:id using another customer token', 'HTTP 403; original booking remains.'],
  ['PATCH booking status accepts valid admin transition', 'PATCH /api/admin/bookings/:id/status as admin', 'HTTP 200; status is updated and persisted.'],
  ['PATCH booking status rejects invalid value', 'PATCH booking status=Unknown', 'HTTP 400; original status remains unchanged.'],
  ['Admin dashboard returns protected data', 'GET /api/admin/dashboard with admin token', 'HTTP 200; users, venues, bookings, and requests are returned.']
];

const securityCases = [
  ['Admin dashboard denies missing token', 'GET protected endpoint without Authorization', 'HTTP 401; no protected data is disclosed.'],
  ['Admin dashboard denies malformed token', 'Authorization=Bearer invalid.token.value', 'HTTP 403; no protected data is disclosed.'],
  ['Admin dashboard denies customer role', 'Use valid customer token on admin endpoint', 'HTTP 403; admin data is not returned.'],
  ['Admin dashboard denies token with altered signature', 'Change one character in a valid token', 'HTTP 403; request is rejected.'],
  ['Admin login rejects incorrect password', 'Valid username with incorrect password', 'HTTP 401; response does not reveal which credential was wrong.'],
  ['Customer login response omits password', 'Login and inspect public user object', 'Password and secret fields are absent.'],
  ['Admin dashboard user list omits passwords', 'Fetch dashboard with admin token', 'No password hashes or plaintext passwords appear.'],
  ['Registration cannot assign admin role', 'Include role=admin in registration body', 'Created account remains customer role.'],
  ['Booking rejects privilege escalation fields', 'Include status=Approved and userId of another user', 'Server ignores/rejects privileged fields and records authenticated owner.'],
  ['Customer cannot approve another booking', 'Customer token calls admin booking status route', 'HTTP 403; booking status is unchanged.'],
  ['Customer cannot change venue prices', 'Customer token PATCHes venue fee', 'HTTP 401/403; venue fee remains unchanged.'],
  ['Customer cannot read admin user data', 'Customer token requests admin dashboard', 'HTTP 403; other customers are not disclosed.'],
  ['XSS team name is rendered as text', 'Create team name containing <script>alert(1)</script>', 'Script does not execute; content is escaped in UI.'],
  ['XSS tournament name is rendered as text', 'Create title containing HTML event handler', 'Markup does not execute when shown in admin UI.'],
  ['SQL-like input is treated as data', 'Submit OR 1=1 and quotes in text fields', 'No authentication bypass or unauthorized data exposure occurs.'],
  ['Path traversal in record ID is rejected', 'Request protected route with ../ payload in ID', 'Request is rejected without exposing files or server internals.'],
  ['Unknown API route returns safe error', 'GET /api/not-a-real-route', 'No stack trace, secret, or filesystem path is exposed.'],
  ['Expired token is rejected', 'Use signed token with expired expiry', 'HTTP 403; protected operation is not performed.'],
  ['Blocked customer token cannot book', 'Block account then submit booking with prior token', 'Request is denied and booking is not created.'],
  ['CORS response follows configured policy', 'Send cross-origin preflight request', 'Only configured origins/methods are allowed by deployment policy.']
];

const databaseCases = [
  ['New customer persists after reload', 'Register a unique customer, restart API, then query/login', 'Customer record remains available after reload/restart.'],
  ['Duplicate customer phone is unique', 'Register the same normalized phone twice', 'Second registration fails; one customer record exists.'],
  ['Booking persists after reload', 'Create booking, refresh dashboard, query admin data', 'Booking fields and status remain unchanged.'],
  ['Booking approval persists after reload', 'Approve booking, reload API/dashboard', 'Approved status remains stored.'],
  ['Rejected booking releases slot', 'Reject a booking then query slots', 'Previously reserved slot is available again.'],
  ['Deleted booking releases slot', 'Delete an owned booking then query slots', 'Deleted booking is absent and slot is available.'],
  ['Tournament request persists after reload', 'Create request then reload dashboard data', 'Request and notes remain stored.'],
  ['Tournament approval persists after reload', 'Approve request then reload admin data', 'Approved status remains stored.'],
  ['Venue fee persists after update', 'Update fee and reload config endpoint', 'New fee is returned consistently.'],
  ['Venue status controls booking availability', 'Deactivate venue and query customer config', 'Inactive venue is not offered to customers.'],
  ['Tournament creation persists', 'Create tournament and restart API', 'Tournament remains in admin list.'],
  ['Tournament closure persists', 'Close tournament then reload dashboard', 'Closed status remains stored.'],
  ['Booking owner fields are server-derived', 'Submit booking with forged customerName/userId', 'Stored owner matches authenticated account, not forged fields.'],
  ['Failed validation does not partially write data', 'Submit invalid booking and compare database counts', 'No partial booking record is created.'],
  ['Concurrent duplicate slot writes remain unique', 'Send simultaneous requests for one venue/time', 'At most one request succeeds; no duplicate active slot records.']
];

const uiCases = [
  ['Home page navigation links resolve', 'Open each primary navigation link', 'Each link reaches the intended page without 404.'],
  ['Registration mode toggles cleanly', 'Switch Login to Register and back', 'Correct fields, heading, and button label are displayed.'],
  ['Admin errors are visible and recoverable', 'Submit invalid admin login then correct credentials', 'Error is visible and clears after successful retry.'],
  ['Customer validation errors are visible', 'Submit invalid customer credentials', 'Useful error appears without clearing valid fields unexpectedly.'],
  ['Booking submit button prevents duplicate clicks', 'Click submit repeatedly while request is pending', 'Only one booking is created and progress state is visible.'],
  ['Booking list empty state is readable', 'Open dashboard with no bookings today', 'Clear empty-state message is displayed.'],
  ['Pending and approved statuses are distinguishable', 'Render bookings with each status', 'Status text and visual state are understandable.'],
  ['Venue fee formatting uses INR', 'Inspect venue selector and dashboard revenue', 'Amounts use Indian Rupee formatting.'],
  ['Long venue name does not overlap controls', 'Render a long venue name at narrow width', 'Text wraps/truncates cleanly without blocking actions.'],
  ['Long tournament name remains readable', 'Create a long tournament title', 'Title stays within layout and actions remain reachable.'],
  ['Toast confirmation is announced and visible', 'Complete booking or admin update', 'Confirmation appears and does not obscure primary controls.'],
  ['Price controls expose understandable labels', 'Inspect venue price inputs/buttons', 'Each input and action identifies its venue and operation.'],
  ['Tables remain usable at tablet width', 'Set viewport to 768px and inspect admin tables', 'Columns remain readable or table scroll is available.'],
  ['Forms retain entered values after recoverable error', 'Submit invalid data then inspect fields', 'User can correct the problem without re-entering unrelated values.'],
  ['Images load with meaningful alternate text', 'Inspect game gallery images and network state', 'Images load and expose descriptive alt text.']
];

const accessibilityCases = [
  ['Document declares page language', 'Inspect html lang on each primary page', 'A valid language attribute is present.'],
  ['Every form control has an accessible name', 'Inspect labels, aria-label, and associated IDs', 'Each input, select, and button has an accessible name.'],
  ['Keyboard can reach all interactive controls', 'Navigate each page using Tab and Shift+Tab', 'Focus order is logical and all controls are reachable.'],
  ['Keyboard focus is visibly indicated', 'Tab through navigation, forms, and admin actions', 'Focused element has a visible focus indicator.'],
  ['Login form submits using keyboard', 'Fill login and press Enter', 'Form submits once and result is announced.'],
  ['Validation errors are associated with fields', 'Trigger required and server validation errors', 'Error text is perceivable and associated with relevant control.'],
  ['Heading structure is hierarchical', 'Inspect heading sequence for each page', 'Headings describe sections and do not skip levels without reason.'],
  ['Status changes are announced to assistive technology', 'Approve/reject a booking with screen reader enabled', 'Updated status/confirmation is announced.'],
  ['Text remains usable at 200 percent zoom', 'Zoom browser to 200 percent', 'Content and essential actions remain available without clipping.'],
  ['Color is not the only status signal', 'Inspect Pending/Approved/Rejected labels', 'Status is identifiable by text or other non-color cue.']
];

const compatibilityCases = [
  ['Chrome current stable', 'Run customer and admin smoke paths on current Chrome', 'Pages and core flows work without browser-specific errors.'],
  ['Microsoft Edge current stable', 'Run customer and admin smoke paths on current Edge', 'Pages and core flows work without browser-specific errors.'],
  ['Firefox current stable', 'Run customer registration and booking flow on Firefox', 'Forms, storage, and fetch behavior work as expected.'],
  ['Chromium headless CI', 'Run web E2E suite in headless Chromium', 'Suite passes without viewport-only layout regressions.'],
  ['Windows desktop viewport', 'Run at 1366x768', 'Navigation and dashboard fit and remain operable.'],
  ['Tablet viewport', 'Run at 768x1024', 'Tables, forms, and navigation adapt without overlap.'],
  ['Small mobile browser viewport', 'Run at 360x800', 'Primary workflows fit without horizontal page overflow.'],
  ['Browser refresh and history navigation', 'Refresh dashboard and use Back/Forward', 'Routes recover without broken session state.'],
  ['Browser storage persistence', 'Reload after login and inspect expected session behavior', 'Session follows documented persistence/logout policy.'],
  ['Browser with third-party fonts unavailable', 'Block external font request and reload', 'Layout remains readable and controls retain usable styling.']
];

const performanceCases = [
  ['Home page load under 3 seconds', 'Measure cold navigation on baseline network', 'Load event completes under 3 seconds on agreed baseline.'],
  ['Customer dashboard load under 3 seconds', 'Measure navigation and API-backed rendering', 'Dashboard is usable under 3 seconds on agreed baseline.'],
  ['Admin dashboard load under 4 seconds', 'Measure admin dashboard with seeded records', 'Dashboard is usable under 4 seconds on agreed baseline.'],
  ['Config API p95 under 500 ms', 'Collect at least 100 GET /api/config samples', 'p95 latency stays below 500 ms on test environment.'],
  ['Booking API p95 under 1 second', 'Create bookings using isolated test slots', 'p95 response latency stays below 1 second.'],
  ['Concurrent 10-user read load', 'Run dashboard/config reads from 10 virtual users', 'No errors; latency remains within agreed baseline.'],
  ['Concurrent 50-user read load', 'Run dashboard/config reads from 50 virtual users', 'Error rate and latency remain within agreed thresholds.'],
  ['Concurrent 100-user read load', 'Run 100-user baseline profile', 'No unexpected crashes; resource and error metrics are recorded.'],
  ['Repeated navigation memory stability', 'Repeat login/dashboard navigation 20 times', 'No progressive memory growth or stuck loading state.'],
  ['Large booking history rendering', 'Render 1,000 seeded booking records', 'Pagination/scroll remains responsive within agreed threshold.']
];

const regressionCases = [
  ['Default venue catalog remains available', 'Run config API and customer selector checks', 'Seeded approved venues and categories remain correct.'],
  ['Seven default time slots remain valid', 'Inspect config API time slot values', 'Expected seven HH:mm slots are returned.'],
  ['Booking status vocabulary remains stable', 'Create and transition bookings', 'Pending, Approved, and Rejected states behave consistently.'],
  ['Admin role authorization remains enforced', 'Run admin routes with admin and customer tokens', 'Only admin role can access protected admin operations.'],
  ['Customer role authorization remains enforced', 'Run booking operations with no token/customer token', 'Protected booking writes require an active customer.'],
  ['Venue price update remains reflected in booking fee', 'Change venue fee then create booking', 'Booking stores current venue fee.'],
  ['Slot availability follows active booking status', 'Create, reject, and approve bookings', 'Pending/Approved block slots; Rejected releases them.'],
  ['Capacitor assets remain synchronized', 'Compare public web assets with Android bundled assets', 'Current HTML, JS, and CSS are included in APK assets.'],
  ['Excel report schema remains readable', 'Generate test report and open with ExcelJS', 'Summary, case rows, and category analysis are present.'],
  ['Failure screenshot is attached to failed UI case', 'Force a controlled locator failure in isolated run', 'Failure details and screenshot path appear in report.']
];

const mobileCases = [
  ['Android app launches from launcher', 'Install APK and open launcher activity', 'SportZone opens without crash and reaches bundled home page.'],
  ['Android app works with backend reachable over Wi-Fi', 'Set reachable API URL and complete login', 'API-backed customer screen loads successfully.'],
  ['Android app displays offline state', 'Disable network, open dashboard, then restore network', 'Failure is understandable and retry/recovery works.'],
  ['Android back button returns through app navigation', 'Navigate Home to Login to Dashboard and press Back', 'Back behavior is predictable and does not unexpectedly exit.'],
  ['Android system back from home exits or confirms', 'Press system Back from root screen', 'App follows documented exit behavior without losing unsaved data.'],
  ['Soft keyboard does not cover registration submit', 'Focus last registration field with keyboard visible', 'Submit remains reachable by scroll or keyboard action.'],
  ['Soft keyboard uses numeric layout for phone', 'Focus customer phone input', 'Numeric keyboard appears and accepts expected digits.'],
  ['Soft keyboard advances through form controls', 'Use Next/Done actions across login form', 'Focus advances in logical order and form can submit.'],
  ['Screen rotation preserves current form state', 'Enter form values and rotate device', 'Values and current workflow are retained or reset by documented policy.'],
  ['App resumes correctly after backgrounding', 'Open app, background it, then resume', 'Session and current page recover without crash.'],
  ['App handles process recreation after login', 'Login, terminate/recreate activity, then reopen', 'Authentication state follows documented persistence policy.'],
  ['Android permission prompt does not block booking', 'Fresh install and complete booking flow', 'Only necessary permissions are requested and flow remains usable.'],
  ['Small Android screen has no horizontal overflow', 'Use 360px-wide emulator and inspect dashboard', 'Primary controls fit; no unintended horizontal scrolling.'],
  ['Large Android screen layout remains balanced', 'Run on tablet emulator in portrait and landscape', 'Cards and forms use available space without overlap.'],
  ['Android font scaling at 1.3x remains usable', 'Set system font scale to 130 percent', 'Labels and action buttons remain visible and operable.'],
  ['Android accessibility services expose control names', 'Inspect with TalkBack or accessibility scanner', 'Inputs and buttons have meaningful spoken names.'],
  ['WebView links remain inside application where expected', 'Tap internal navigation links', 'Internal routes remain in app WebView.'],
  ['External links use safe platform handling', 'Tap external link if present', 'External destination opens safely and does not expose session token.'],
  ['Android API endpoint is configurable per device', 'Set SPORTZONE_MOBILE_API_URL to LAN host', 'WebView requests reach configured server after navigation.'],
  ['Android app recovers after API server restart', 'Restart API while app is open and retry operation', 'User receives clear error and can succeed after service returns.']
];

const webInputCases = [
  ...[
    ['empty', '', 'Empty phone is rejected by required-field validation.'],
    ['one digit', '7', 'Phone is rejected and no account is created.'],
    ['eight digits', '12345678', 'Phone is rejected and no account is created.'],
    ['nine digits', '123456789', 'Phone is rejected and no account is created.'],
    ['exactly ten digits', '9876543210', 'Valid phone is accepted and creates one account.'],
    ['eleven digits', '19876543210', 'Phone follows the documented last-ten-digit normalization policy.'],
    ['twelve digits', '9119876543210', 'Phone follows the documented country-prefix normalization policy.'],
    ['leading and trailing spaces', ' 9876543210 ', 'Whitespace is normalized and no duplicate account is created.'],
    ['country prefix', '+91 9876543210', 'Phone follows the documented country-prefix normalization policy.'],
    ['hyphen separators', '987-654-3210', 'Phone follows the documented separator normalization policy.'],
    ['letters mixed with digits', '98ab765c3210', 'Invalid characters are rejected or normalized according to phone policy.'],
    ['ASCII punctuation only', '+()-', 'Phone is rejected and no account is created.'],
    ['Arabic-Indic digits', '٩٨٧٦٥٤٣٢١٠', 'Unsupported digit script is rejected with a clear validation result.'],
    ['full-width digits', '９８７６５４３２１０', 'Unsupported digit script is rejected with a clear validation result.'],
    ['leading zero', '0987654321', 'Ten-digit value follows documented phone normalization policy.'],
    ['newline in phone', '98765\n43210', 'Control character is rejected or normalized safely.'],
    ['HTML payload in phone', '<script>1</script>', 'Payload is rejected and does not execute.'],
    ['duplicate normalized phone', '+91 9876543210 after registering 9876543210', 'Duplicate normalized phone is rejected.']
  ].map(([label, value, expected]) => [`Registration phone boundary: ${label}`, `phone=${JSON.stringify(value)}`, expected]),
  ...[
    ['empty team', '', 'Required validation blocks booking.'],
    ['whitespace-only team', '     ', 'Blank team is rejected and no booking is stored.'],
    ['single-character team', 'A', 'Team is accepted if it meets the documented minimum length.'],
    ['two-character team', 'AB', 'Team is accepted and displayed without truncation.'],
    ['30-character team', 'Northside Athletic Club Team', 'Team is stored and displayed completely.'],
    ['250-character team', 'T'.repeat(250), 'Long input is safely bounded or displayed without breaking the layout.'],
    ['Unicode team', 'मुंबई यूनाइटेड', 'Unicode text is preserved and displayed correctly.'],
    ['emoji team', 'Goalkeepers 🥅', 'Emoji input is preserved or safely normalized.'],
    ['apostrophe team', "King's XI", 'Apostrophe is stored and rendered as text.'],
    ['ampersand team', 'Rovers & Rangers', 'Ampersand is rendered as text without markup interpretation.'],
    ['HTML team', '<b>Champions</b>', 'Markup is escaped and never interpreted as executable HTML.'],
    ['newline team', 'Northside\nUnited', 'Newline is normalized or displayed without breaking table structure.'],
    ['tab team', 'Northside\tUnited', 'Control whitespace is normalized safely.'],
    ['zero-width team', '\u200b\u200b', 'Visually blank input is rejected.'],
    ['SQL-like team', "Team' OR '1'='1", 'Input remains plain text and does not alter query behavior.'],
    ['leading/trailing team spaces', '  Rovers XI  ', 'Whitespace handling is consistent and display is readable.'],
    ['repeated team name', 'Rovers XI used by another customer', 'Allowed duplicate team text does not merge or overwrite bookings.'],
    ['right-to-left team', 'نادي الرياض', 'Right-to-left text remains readable and does not overlap controls.']
  ].map(([label, value, expected]) => [`Booking team boundary: ${label}`, `team=${JSON.stringify(value)}`, expected]),
  ...[
    ['empty', '', 'Required validation blocks submission.'],
    ['one character', 'x', 'Behavior follows the documented password policy.'],
    ['seven characters', 'Pass123', 'Behavior follows the documented password policy.'],
    ['eight characters', 'Pass1234', 'Valid credentials can authenticate.'],
    ['64 characters', 'P'.repeat(64), 'Input is handled without truncation or UI failure.'],
    ['128 characters', 'P'.repeat(128), 'Input is handled safely within configured limits.'],
    ['Unicode password', 'क्रिकेट123', 'Password round-trips and authenticates consistently.'],
    ['emoji password', 'Goal🥅2026', 'Password is handled consistently by registration and login.'],
    ['leading/trailing spaces', ' pass123 ', 'Trimming behavior is consistent and documented.'],
    ['all whitespace', '        ', 'Whitespace-only password is rejected.'],
    ['HTML-like password', '<script>', 'Password is treated as a secret string and never rendered as markup.'],
    ['very long password', 'P'.repeat(1024), 'Oversized input is safely rejected or bounded without server error.']
  ].map(([label, value, expected]) => [`Customer password boundary: ${label}`, `password=${JSON.stringify(value)}`, expected])
];

const webViewportCases = ['Chrome', 'Edge', 'Firefox'].flatMap(browser =>
  [[320, 640], [360, 800], [375, 812], [390, 844], [414, 896], [480, 900], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080]]
    .map(([width, height]) => [`${browser} responsive layout at ${width}x${height}`, `Browser=${browser}; viewport=${width}x${height}`, 'Primary navigation, forms, and actions remain visible without unintended horizontal page overflow.'])
);

const webApiMatrix = [
  ['GET config with JSON accept header', 'GET /api/config; Accept=application/json', 'HTTP 200 JSON response with configured venues.'],
  ['GET stats with query string', 'GET /api/dashboard/stats?source=test', 'HTTP 200; unrelated query string does not change response contract.'],
  ['GET slots with encoded venue name', 'GET /api/slots?venue=<URL-encoded name>', 'HTTP 200; exact venue is selected safely.'],
  ['GET slots with empty venue', 'GET /api/slots?venue=', 'HTTP 200; response follows all-venue/empty-filter contract.'],
  ['POST registration with wrong content type', 'POST /api/auth/register as text/plain', 'Request fails safely with a client error and no record.'],
  ['POST registration with JSON null body', 'POST /api/auth/register body=null', 'Request returns a safe client error; server does not crash.'],
  ['POST login with missing JSON fields', 'POST /api/auth/login body={}', 'HTTP 400; no token is issued.'],
  ['POST admin login with missing fields', 'POST /api/admin/login body={}', 'HTTP 401 or validation error; no token is issued.'],
  ['POST booking with array body', 'POST /api/bookings body=[] with valid token', 'Request is rejected safely; no booking is created.'],
  ['POST booking with null body', 'POST /api/bookings body=null with valid token', 'Request returns a safe client error; server does not crash.'],
  ['POST booking with numeric team', 'POST booking team=123', 'Request is rejected or normalizes to documented text behavior.'],
  ['POST booking with fee supplied by client', 'Include fee=1 in booking body', 'Server calculates fee from current venue data.'],
  ['POST tournament request with unknown venue', 'POST request using unknown venue name', 'HTTP 400; request is not persisted.'],
  ['POST tournament request with empty notes', 'POST valid request with notes=""', 'HTTP 201; notes are stored as empty text.'],
  ['DELETE booking with nonnumeric ID', 'DELETE /api/bookings/not-a-number', 'HTTP 404; no unrelated booking is deleted.'],
  ['PATCH admin venue with invalid ID', 'PATCH /api/admin/venues/not-a-number', 'HTTP 404; no venue is changed.'],
  ['PATCH admin booking with unsupported status', 'PATCH status=Cancelled', 'HTTP 400; original status remains unchanged.'],
  ['Unknown route returns JSON-safe response', 'GET /api/unknown-case-route', 'Response does not expose stack traces or secrets.']
].map(([name, data, expected]) => [name, data, expected]);

const webSecurityCases = [
  ['script tag in tournament notes', '<script>alert(1)</script>', 'Script is escaped and does not execute.'],
  ['image onerror payload in team', '<img src=x onerror=alert(1)>', 'Event handler is escaped and does not execute.'],
  ['SVG event handler in venue name', '<svg onload=alert(1)>', 'Payload is rejected or rendered inert.'],
  ['javascript URL in notes', 'javascript:alert(1)', 'Value is treated as text and never navigated.'],
  ['encoded script payload', '%3Cscript%3Ealert(1)%3C/script%3E', 'Decoded input remains inert in rendered UI.'],
  ['double-encoded script payload', '%253Cscript%253E', 'Nested encoding does not bypass output escaping.'],
  ['HTML entity payload', '&lt;script&gt;', 'Entities remain text and do not execute.'],
  ['SQL quote payload in venue search', "' OR 1=1 --", 'No query bypass or data disclosure occurs.'],
  ['null byte in team name', 'Team\u0000Name', 'Input is safely rejected or normalized without server error.'],
  ['bidirectional override in name', 'Team\u202eName', 'Text remains understandable and does not spoof status/identity.'],
  ['large repeated markup payload', '<b>'.repeat(5000), 'Request is bounded or rejected without resource exhaustion.'],
  ['token in query string is not accepted', 'GET protected route?token=<valid-token>', 'Authorization header remains required.'],
  ['wrong authorization scheme', 'Authorization=Basic <token>', 'Protected endpoint denies request.'],
  ['duplicate authorization headers', 'Send two Authorization headers', 'Request is rejected or handled deterministically.'],
  ['malformed bearer whitespace', 'Authorization=Bearer    token', 'Malformed token is denied without exception.'],
  ['oversized record identifier', 'ID contains 10,000 digits', 'Request fails safely without overflow or data disclosure.'],
  ['prototype property in JSON body', 'JSON includes __proto__ and constructor keys', 'No prototype mutation or privilege change occurs.'],
  ['mass assignment of account status', 'Registration includes status=Approved and role=admin', 'Account remains least-privileged customer.']
].map(([name, data, expected]) => [name, data, expected]);

const webDatabaseCases = [
  ['register then login after browser refresh', 'Create customer, refresh, authenticate again', 'Account remains available and only expected session data is retained.'],
  ['register same phone with punctuation variant', 'Register 9876543210 then +91 9876543210', 'Normalization and duplicate policy are applied consistently.'],
  ['create booking then inspect slot API', 'Create booking and GET matching venue slots', 'Reserved slot is absent from available slot list.'],
  ['reject booking then inspect slot API', 'Reject booking and GET matching venue slots', 'Rejected booking no longer blocks slot.'],
  ['approve booking then inspect daily bookings', 'Approve booking and GET customer/admin data', 'Status is Approved in all relevant reads.'],
  ['change fee then create booking', 'Update venue fee then book a slot', 'Booking fee matches updated venue fee.'],
  ['deactivate venue then inspect config', 'Set venue inactive and GET config', 'Inactive venue is excluded; other venues remain.'],
  ['add venue then inspect slots', 'Create venue and GET slot data', 'New approved venue appears with expected slot list.'],
  ['create tournament then close it', 'Create tournament, close, and reload admin data', 'Closed state persists and is reflected in reads.'],
  ['create request with optional date omitted', 'Submit valid tournament request without date', 'Server stores documented default date.'],
  ['delete booking then verify absence', 'Delete booking then query admin dashboard', 'Deleted record is absent from returned booking list.'],
  ['failed status transition leaves data unchanged', 'Submit invalid status and compare stored record', 'Original record remains byte-for-byte equivalent in relevant fields.'],
  ['two users create different slots concurrently', 'Submit two valid different-slot bookings simultaneously', 'Both valid bookings persist independently.'],
  ['two users race for the same slot', 'Submit two same-slot bookings simultaneously', 'At most one active booking is stored for the slot.'],
  ['failed duplicate registration leaves user count stable', 'Repeat registration with existing phone', 'No extra user row is added.'],
  ['price update survives server restart', 'Update fee, restart API, and reload config', 'Updated fee remains persisted.'],
  ['tournament request survives server restart', 'Create request, restart API, query admin dashboard', 'Request and status remain persisted.'],
  ['data restore returns fixture database', 'Back up, run isolated mutation, restore fixture', 'Original fixture state is restored exactly.']
].map(([name, data, expected]) => [name, data, expected]);

const androidAdditionalCases = [
  ...['Android 9', 'Android 10', 'Android 11', 'Android 12', 'Android 13', 'Android 14', 'Android 15', 'Android 16']
    .map(version => [`Launch and booking flow on ${version}`, `OS=${version}`, 'App launches and completes customer booking flow without OS-specific failure.']),
  ...[
    ['Compact phone', 320, 640], ['Small phone', 360, 740], ['Standard phone', 390, 844], ['Large phone', 432, 960], ['Foldable outer display', 360, 800],
    ['Compact tablet', 600, 960], ['Standard tablet', 768, 1024], ['Large tablet', 900, 1280], ['Landscape phone', 844, 390], ['Landscape tablet', 1280, 800]
  ].flatMap(([profile, width, height]) => ['portrait profile', 'rotation profile'].map(mode => [
    `Layout on ${profile} ${mode}`,
    `Device=${profile}; viewport=${width}x${height}; mode=${mode}`,
    'Critical navigation and form controls remain visible, correctly sized, and operable.'
  ])),
  ...[
    'tap login submit once', 'double-tap booking submit', 'tap disabled submit while request is pending', 'scroll to tournament submit', 'select venue using touch',
    'select time using touch', 'open admin action menu', 'tap approve booking', 'tap reject booking', 'tap logout', 'use device Back from dashboard',
    'use device Back from login', 'tap form label to focus input', 'long-press text field', 'paste valid phone number', 'paste script-like team text',
    'dismiss keyboard with system Back', 'reopen keyboard after scrolling', 'tap toast dismissal area', 'rapidly change selected venue'
  ].map(action => [`Touch interaction: ${action}`, `Android action=${action}`, 'Exactly the intended control responds; no duplicate or unintended state change occurs.']),
  ...[
    'stable Wi-Fi', 'stable LTE', 'slow 3G', 'high latency 500ms', 'packet loss 5 percent', 'offline before launch', 'offline during login',
    'offline during booking', 'restore network after timeout', 'switch Wi-Fi to cellular', 'airplane mode toggle', 'DNS lookup failure',
    'API returns HTTP 500', 'API unavailable then restored', 'captive portal network'
  ].map(network => [`Network condition: ${network}`, `Connectivity=${network}`, 'App shows a recoverable state, avoids duplicate writes, and succeeds after connectivity returns.']),
  ...[
    ['phone', 'numeric'], ['password', 'text'], ['customer name', 'text'], ['team name', 'text'], ['tournament name', 'text'],
    ['tournament date', 'date'], ['notes', 'text'], ['admin username', 'text'], ['admin password', 'text'], ['venue fee', 'decimal'],
    ['venue category', 'text'], ['booking team after scroll', 'text'], ['phone with autofill', 'numeric'], ['phone with paste', 'numeric'], ['password with autofill', 'text']
  ].map(([field, keyboard]) => [`Soft keyboard: ${field}`, `Field=${field}; expected keyboard=${keyboard}`, 'Correct keyboard type appears, field stays visible, and entered value is retained.']),
  ...[
    ['font scale 85 percent', 'fontScale=0.85'], ['font scale 100 percent', 'fontScale=1.0'], ['font scale 115 percent', 'fontScale=1.15'], ['font scale 130 percent', 'fontScale=1.3'],
    ['font scale 150 percent', 'fontScale=1.5'], ['display size small', 'displaySize=small'], ['display size default', 'displaySize=default'], ['display size large', 'displaySize=large'],
    ['TalkBack enabled', 'service=TalkBack'], ['high contrast text', 'highContrast=true'], ['bold text enabled', 'boldText=true'], ['dark system theme', 'theme=dark'],
    ['light system theme', 'theme=light'], ['reduced motion', 'animationScale=0'], ['large touch target inspection', 'scanner=accessibility']
  ].map(([name, data]) => [`Accessibility configuration: ${name}`, data, 'Text remains readable and all controls have usable names, focus, and touch targets.']),
  ...[
    'cold launch after install', 'warm launch after background', 'background during API response', 'resume after screen lock', 'resume after notification shade',
    'rotate during customer login', 'rotate during booking form entry', 'rotate during tournament form entry', 'process recreation after login', 'force-stop and relaunch',
    'low-memory activity recreation', 'device date changes while form open', 'device timezone changes while dashboard open', 'permission prompt dismissed',
    'deny optional permission', 'app update over existing install', 'clear app data and relaunch', 'logout then force-stop', 'switch app during keyboard input',
    'system font change while app backgrounded', 'WebView renderer recovery', 'API server restart with app foregrounded'
  ].map(state => [`Lifecycle and system state: ${state}`, `Android state=${state}`, 'App returns to a consistent, secure state without crash or unintended duplicate submission.'])
];

function casesFrom(category, module, entries) {
  return entries.map(([name, testData, expected]) => ({
    category,
    module,
    name,
    preconditions: 'SportZone test environment is available; use isolated test accounts and restore modified data after execution.',
    testData,
    steps: `1. Open the relevant ${module} screen or endpoint. 2. Execute this scenario with the listed test data. 3. Verify the result and check that no unrelated record changed.`,
    expected,
    priority: category === 'Security Testing' || category === 'End-to-End Testing' ? 'P1' : 'P2'
  }));
}

const sharedCases = [
  ...casesFrom('End-to-End Testing', 'Customer and Admin Journeys', journeys.map(([name, steps, data, expected]) => [name, `${data}; steps: ${steps}`, expected])),
  ...casesFrom('Functional Testing', 'Form Validation', functionalCases),
  ...casesFrom('API Testing', 'Backend API', apiCases),
  ...casesFrom('Security Testing', 'Authorization and Input Safety', securityCases),
  ...casesFrom('Database Testing', 'Persistence and Consistency', databaseCases),
  ...casesFrom('UI/UX Testing', 'Interface and Usability', uiCases),
  ...casesFrom('Accessibility Testing', 'Accessibility', accessibilityCases),
  ...casesFrom('Compatibility Testing', 'Browser Compatibility', compatibilityCases),
  ...casesFrom('Performance Testing', 'Performance and Load', performanceCases),
  ...casesFrom('Regression Testing', 'Regression', regressionCases)
];

function platformCases(prefix, platform, platformSpecific = []) {
  const platformLabel = platform === 'Web' ? 'Selenium Web' : 'Appium Android';
  const tool = platform === 'Web' ? 'Selenium WebDriver' : 'Appium with UiAutomator2';
  const common = sharedCases.map(item => ({
    ...item,
    platform: platformLabel,
    name: `${platformLabel}: ${item.name}`,
    preconditions: platform === 'Web'
      ? 'Web server and API are running; supported browser and WebDriver are installed. Use isolated test accounts and restore modified data.'
      : 'APK is built from current public assets; Android device/emulator, Appium, UiAutomator2, and reachable API are ready.',
    steps: `1. Launch the application using ${tool}. 2. ${item.steps.replace(/^1\. /, '')}`
  }));
  const extras = platformSpecific.map(item => ({
    ...item,
    platform: platformLabel,
    name: `${platformLabel}: ${item.name}`,
    preconditions: platform === 'Web'
      ? 'Web server and API are running; target browser and WebDriver are available; use isolated test data.'
      : 'Android APK is installed; device/emulator is configured; Appium, UiAutomator2, and reachable API are available.',
    steps: `1. Launch the application using ${tool}. 2. ${item.steps.replace(/^1\. /, '')}`
  }));
  return [...common, ...extras].map((item, index) => ({ ...item, id: `${prefix}-${String(index + 1).padStart(3, '0')}` }));
}

async function main() {
  const webAdditional = [
    ...casesFrom('Functional Testing', 'Input Boundary Matrix', webInputCases),
    ...casesFrom('Compatibility Testing', 'Browser and Viewport Matrix', webViewportCases),
    ...casesFrom('API Testing', 'API Boundary Matrix', webApiMatrix),
    ...casesFrom('Security Testing', 'Encoding and Injection Matrix', webSecurityCases),
    ...casesFrom('Database Testing', 'Data Integrity Matrix', webDatabaseCases)
  ];
  const androidAdditional = [
    ...casesFrom('Mobile-Specific Testing', 'Android Device Behavior', mobileCases),
    ...casesFrom('Mobile-Specific Testing', 'Android Device and Input Matrix', androidAdditionalCases)
  ];
  const webCases = platformCases('WEB', 'Web', webAdditional);
  const androidCases = platformCases('AND', 'Android', androidAdditional);
  const allCases = [...webCases, ...androidCases];
  if (webCases.length !== 300 || androidCases.length !== 300) {
    throw new Error(`Expected 300 cases per platform; generated ${webCases.length} web and ${androidCases.length} Android cases`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SportZone Test Suites';
  workbook.created = new Date();
  workbook.subject = 'Selenium Web and Appium Android test case catalog';
  workbook.description = `${allCases.length} individually identified test cases. All are marked Not Run until executed.`;

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ header: 'Metric', width: 34 }, { header: 'Value', width: 30 }];
  summary.addRows([
    ['Catalog', 'SportZone Selenium Web + Appium Android'],
    ['Total test cases', allCases.length],
    ['Selenium Web cases', webCases.length],
    ['Appium Android cases', androidCases.length],
    ['Execution status', 'Not Run (test plan; not execution results)'],
    ['Generated at', new Date().toLocaleString()],
    ['', ''],
    ['Coverage category', 'Case count']
  ]);
  const categoryCounts = new Map();
  for (const item of allCases) categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  for (const [category, count] of categoryCounts) summary.addRow([category, count]);

  const columns = [
    { header: 'Case ID', key: 'id', width: 14 },
    { header: 'Platform', key: 'platform', width: 20 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Module', key: 'module', width: 27 },
    { header: 'Priority', key: 'priority', width: 11 },
    { header: 'Test Case', key: 'name', width: 48 },
    { header: 'Preconditions', key: 'preconditions', width: 52 },
    { header: 'Test Data', key: 'testData', width: 54 },
    { header: 'Test Steps', key: 'steps', width: 72 },
    { header: 'Expected Result', key: 'expected', width: 62 },
    { header: 'Execution Status', key: 'status', width: 18 },
    { header: 'Actual Result', key: 'actual', width: 42 },
    { header: 'Defect ID', key: 'defect', width: 16 }
  ];

  for (const [sheetName, items] of [['Selenium Web Cases', webCases], ['Appium Android Cases', androidCases]]) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns;
    for (const item of items) sheet.addRow({ ...item, status: 'Not Run', actual: '', defect: '' });
    sheet.autoFilter = { from: 'A1', to: `M${sheet.rowCount}` };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (let row = 2; row <= sheet.rowCount; row += 1) {
      sheet.getCell(`K${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"Not Run,Pass,Fail,Blocked"']
      };
      sheet.getRow(row).height = 48;
      sheet.getCell(`K${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    }
  }

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.eachRow(row => row.eachCell(cell => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    }));
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`Generated ${allCases.length} separate test cases (${webCases.length} web, ${androidCases.length} Android)`);
  console.log(`Excel catalog: ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});