// assets/js/pages/events-page.js
// Responsibility: Events page orchestrator — manages calendar and list views,
//                 loads events from API, shows add-event button for coordinators.

let eventsState = {
  viewMode: 'calendar',
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  calendarEvents: [],
  selectedDay:    null,
  currentUser:    null,
};

document.addEventListener('DOMContentLoaded', initEventsPage);

/**
 * Purpose: Initialize the events page — read user, bind toggle, load data.
 * @returns {void}
 * Algorithm:
 * 1. Read current user from session
 * 2. Show add-event button if coordinator+
 * 3. Bind calendar/list view toggle buttons
 * 4. Load calendar for current month
 */
function initEventsPage() {
  eventsState.currentUser = _readSessionUser();
  showAddEventButtonIfAllowed(eventsState.currentUser);
  bindViewToggle();
  loadCalendarMonth(eventsState.currentYear, eventsState.currentMonth);
}

/**
 * Purpose: Show the Add Event button for coordinator+ users.
 * @param {Object|null} user - Current user or null
 * @returns {void}
 */
function showAddEventButtonIfAllowed(user) {
  const btn = document.getElementById('add-event-btn');
  if (!btn || !user) return;
  if (['coordinator', 'staff', 'admin'].includes(user.role)) btn.style.display = 'inline-flex';
}

/**
 * Purpose: Bind the calendar/list view toggle buttons.
 * @returns {void}
 * Algorithm:
 * 1. Find both toggle buttons
 * 2. Bind click to switchView
 */
function bindViewToggle() {
  const calBtn  = document.getElementById('view-calendar-btn');
  const listBtn = document.getElementById('view-list-btn');

  if (calBtn)  calBtn.addEventListener('click',  () => switchView('calendar'));
  if (listBtn) listBtn.addEventListener('click',  () => switchView('list'));
}

/**
 * Purpose: Switch between calendar and list view modes.
 * @param {string} mode - 'calendar' or 'list'
 * @returns {void}
 * Algorithm:
 * 1. Update button pressed states
 * 2. Show/hide calendar and list sections
 * 3. If switching to list: load all events
 */
function switchView(mode) {
  eventsState.viewMode = mode;

  const calView  = document.getElementById('calendar-view');
  const listView = document.getElementById('list-view');
  const calBtn   = document.getElementById('view-calendar-btn');
  const listBtn  = document.getElementById('view-list-btn');

  if (mode === 'calendar') {
    if (calView)  calView.style.display  = '';
    if (listView) listView.style.display = 'none';
    if (calBtn)  { calBtn.className  = 'btn btn-secondary btn-sm'; calBtn.setAttribute('aria-pressed', 'true'); }
    if (listBtn) { listBtn.className = 'btn btn-outline btn-sm';   listBtn.setAttribute('aria-pressed', 'false'); }
  } else {
    if (calView)  calView.style.display  = 'none';
    if (listView) listView.style.display = '';
    if (calBtn)  { calBtn.className  = 'btn btn-outline btn-sm';    calBtn.setAttribute('aria-pressed', 'false'); }
    if (listBtn) { listBtn.className = 'btn btn-secondary btn-sm'; listBtn.setAttribute('aria-pressed', 'true'); }
    loadAllEventsList();
  }
}

/**
 * Purpose: ORCHESTRATOR — fetch and render the monthly calendar.
 * @param {number} year  - 4-digit year
 * @param {number} month - Month number (1-12)
 * @returns {void}
 * Algorithm:
 * 1. Show loading in calendar container
 * 2. Fetch events for month
 * 3. Render calendar grid with event dots
 */
function loadCalendarMonth(year, month) {
  const container = document.getElementById('pnec-calendar');
  if (!container) return;
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span></div>';

  fetchEventsForMonth(month, year)
    .then(events => {
      eventsState.calendarEvents = events;
      renderCalendar(container, year, month, events);
    })
    .catch(() => {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Unable to load calendar</h3><p>Please try again later.</p></div>';
    });
}

/**
 * Purpose: Render a full monthly calendar grid.
 * @param {HTMLElement} container - Container to render into
 * @param {number}      year      - 4-digit year
 * @param {number}      month     - Month number (1-12)
 * @param {Array}       events    - Events for this month
 * @returns {void}
 * Algorithm:
 * 1. Calculate first day and days in month
 * 2. Build header with prev/next nav
 * 3. Build day cells, marking days with events
 * 4. Bind day click to show sidebar events
 */
function renderCalendar(container, year, month, events) {
  const firstDay   = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today       = new Date();

  // Map events by day number for quick lookup
  const eventsByDay = {};
  events.forEach(event => {
    const d = new Date(event.date);
    const day = d.getDate();
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(event);
  });

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const weekdays   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const headerHtml = `
    <div class="calendar-grid">
      <div class="calendar-header">
        <button id="cal-prev-btn" aria-label="Previous month">‹</button>
        <h3>${monthNames[month - 1]} ${year}</h3>
        <button id="cal-next-btn" aria-label="Next month">›</button>
      </div>
      <div class="calendar-weekdays">
        ${weekdays.map(d => `<div class="weekday">${d}</div>`).join('')}
      </div>
      <div class="calendar-days">
        ${buildCalendarDayCells(firstDay, daysInMonth, year, month, today, eventsByDay)}
      </div>
    </div>`;

  container.innerHTML = headerHtml;

  document.getElementById('cal-prev-btn').addEventListener('click', () => {
    eventsState.currentMonth -= 1;
    if (eventsState.currentMonth < 1) { eventsState.currentMonth = 12; eventsState.currentYear -= 1; }
    loadCalendarMonth(eventsState.currentYear, eventsState.currentMonth);
  });
  document.getElementById('cal-next-btn').addEventListener('click', () => {
    eventsState.currentMonth += 1;
    if (eventsState.currentMonth > 12) { eventsState.currentMonth = 1; eventsState.currentYear += 1; }
    loadCalendarMonth(eventsState.currentYear, eventsState.currentMonth);
  });

  container.querySelectorAll('.calendar-day[data-day]').forEach(cell => {
    cell.addEventListener('click', () => {
      const day = parseInt(cell.dataset.day, 10);
      container.querySelectorAll('.calendar-day.selected').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      showSidebarEvents(eventsByDay[day] || [], day, month, year);
    });
  });
}

/**
 * Purpose: Build the HTML string for all day cells in the calendar grid.
 * @param {number} firstDay    - Day of week for the 1st (0=Sun)
 * @param {number} daysInMonth - Total days in the month
 * @param {number} year        - 4-digit year
 * @param {number} month       - Month number 1-12
 * @param {Date}   today       - Today's date
 * @param {Object} eventsByDay - Map of day number → events array
 * @returns {string} HTML string of day cells
 */
function buildCalendarDayCells(firstDay, daysInMonth, year, month, today, eventsByDay) {
  let cells = '';

  for (let i = 0; i < firstDay; i++) {
    cells += '<div class="calendar-day other-month"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = (day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear());
    const hasEvents = !!eventsByDay[day];
    const classes = ['calendar-day', isToday ? 'today' : '', hasEvents ? 'has-events' : ''].filter(Boolean).join(' ');
    const dots = hasEvents ? eventsByDay[day].map(() => '<span class="event-dot"></span>').join('') : '';
    cells += `<div class="${classes}" data-day="${day}" role="button" tabindex="0" aria-label="${month}/${day}/${year}${hasEvents ? ', has events' : ''}">
      <div class="day-number">${day}</div>${dots}
    </div>`;
  }
  return cells;
}

/**
 * Purpose: Render events for a selected day in the calendar sidebar.
 * @param {Array}  events - Events on the selected day
 * @param {number} day    - Day number
 * @param {number} month  - Month number
 * @param {number} year   - 4-digit year
 * @returns {void}
 */
function showSidebarEvents(events, day, month, year) {
  const sidebar = document.getElementById('calendar-event-sidebar');
  if (!sidebar) return;

  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (events.length === 0) {
    sidebar.innerHTML = `<div class="card"><div class="card-header"><strong>${dateStr}</strong></div><div class="card-body" style="color:#5a5a5a;font-size:14px">No events scheduled for this day.</div></div>`;
    return;
  }

  const eventsHtml = events.map(event => buildEventCardHtml(event)).join('');
  sidebar.innerHTML = `<div style="margin-bottom:8px;font-size:13px;font-weight:700;color:#0a1628">${dateStr}</div>${eventsHtml}`;
}

/**
 * Purpose: Build an event card HTML string for a single event.
 * @param {Object} event - { title, description, date, location }
 * @returns {string} HTML string
 */
function buildEventCardHtml(event) {
  const d = new Date(event.date);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day   = d.getDate();

  return `<div class="event-card" style="margin-bottom:16px">
    <div class="event-body" style="padding:16px">
      <div class="event-date-badge" style="display:inline-flex">
        <span class="event-month">${month}</span>
        <span class="event-day">${day}</span>
      </div>
      <h3 style="font-size:1rem;margin:8px 0 4px">${escapeHtml(event.title)}</h3>
      ${event.location ? `<div class="event-location">📍 ${escapeHtml(event.location)}</div>` : ''}
      ${event.description ? `<p style="margin-top:8px;font-size:13px">${escapeHtml(event.description.slice(0, 120))}${event.description.length > 120 ? '…' : ''}</p>` : ''}
      ${buildGoogleCalendarLink(event)}
    </div>
  </div>`;
}

/**
 * Purpose: Build a "Add to Google Calendar" link for an event.
 * @param {Object} event - Event object with title, date, location
 * @returns {string} HTML anchor string
 */
function buildGoogleCalendarLink(event) {
  try {
    const d    = new Date(event.date);
    const pad  = n => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text:   event.title,
      dates:  `${date}/${date}`,
      details: event.description || '',
      location: event.location || 'Poway, CA',
    });
    return `<a href="https://calendar.google.com/calendar/render?${params}" target="_blank" rel="noopener" style="font-size:12px;color:#c0392b">+ Add to Google Calendar</a>`;
  } catch {
    return '';
  }
}

/**
 * Purpose: Load all events and render them as a list of cards.
 * @returns {void}
 * Algorithm:
 * 1. Show loading
 * 2. Fetch all events
 * 3. Render as grid of event cards
 */
function loadAllEventsList() {
  const container = document.getElementById('events-list-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Loading events…</div>';

  fetchEvents()
    .then(events => renderEventsList(container, events))
    .catch(() => {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Unable to load events</h3><p>Please try again later.</p></div>';
    });
}

/**
 * Purpose: Render the list of all events as cards in a grid.
 * @param {HTMLElement} container - Container to render into
 * @param {Array}       events    - Array of event objects
 * @returns {void}
 */
function renderEventsList(container, events) {
  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h3>No upcoming events</h3><p>Check back soon — PNEC hosts training events and community meetings throughout the year.</p></div>';
    return;
  }

  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px">
    ${events.map(event => buildEventCardHtml(event)).join('')}
  </div>`;
}

/**
 * Purpose: Read the cached user from sessionStorage.
 * @returns {Object|null} Parsed user or null
 */
function _readSessionUser() {
  try { return JSON.parse(sessionStorage.getItem('pnec_user')); }
  catch { return null; }
}
