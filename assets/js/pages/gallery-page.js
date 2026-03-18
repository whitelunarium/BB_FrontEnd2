// assets/js/pages/gallery-page.js
// Responsibility: Gallery page orchestrator — loads media posts, renders masonry grid,
//                 handles upload button visibility for coordinator+ users.

let galleryState = {
  page: 1,
  hasMore: true,
  loading: false,
  currentUser: null,
};

document.addEventListener('DOMContentLoaded', initGalleryPage);

/**
 * Purpose: Initialize the gallery page — load user state, render photos, bind events.
 * @returns {void}
 * Algorithm:
 * 1. Read current user from session
 * 2. Show upload button if coordinator+
 * 3. Load first page of media
 * 4. Bind upload button
 */
function initGalleryPage() {
  galleryState.currentUser = _readSessionUser();
  showUploadButtonIfAllowed(galleryState.currentUser);
  loadGalleryPage(1);
  bindUploadButton();
}

/**
 * Purpose: Show the upload button only for coordinator-or-above users.
 * @param {Object|null} user - Current user object or null
 * @returns {void}
 * Algorithm:
 * 1. Check if user has coordinator, staff, or admin role
 * 2. If yes: display the upload button
 */
function showUploadButtonIfAllowed(user) {
  const btn = document.getElementById('upload-media-btn');
  if (!btn || !user) return;
  const canUpload = ['coordinator', 'staff', 'admin'].includes(user.role);
  if (canUpload) btn.style.display = 'inline-flex';
}

/**
 * Purpose: ORCHESTRATOR — fetch one page of media and render cards into the grid.
 * @param {number} pageNum - 1-based page number to load
 * @returns {void}
 * Algorithm:
 * 1. Show loading if first page
 * 2. Fetch media from API
 * 3. If no items: show empty state
 * 4. Otherwise: render each item as a gallery card
 */
function loadGalleryPage(pageNum) {
  if (galleryState.loading) return;
  galleryState.loading = true;

  const grid = document.getElementById('gallery-masonry');
  if (!grid) return;

  if (pageNum === 1) {
    grid.innerHTML = '<div class="loading-overlay" style="grid-column:1/-1"><span class="spinner"></span> Loading gallery…</div>';
  }

  fetchMediaPosts(pageNum)
    .then(data => renderGalleryItems(grid, data, pageNum))
    .catch(() => showGalleryError(grid))
    .finally(() => { galleryState.loading = false; });
}

/**
 * Purpose: Render fetched media items into the gallery masonry grid.
 * @param {HTMLElement} grid    - The masonry grid element
 * @param {Object}      data    - { items, total, page, pages } from API
 * @param {number}      pageNum - Current page number
 * @returns {void}
 * Algorithm:
 * 1. Clear loading on first page
 * 2. If no items on page 1: show empty state
 * 3. Otherwise: create and append gallery items
 * 4. Track if more pages exist
 */
function renderGalleryItems(grid, data, pageNum) {
  if (pageNum === 1) grid.innerHTML = '';

  const items = data.items || [];
  if (pageNum === 1 && items.length === 0) {
    grid.innerHTML = buildGalleryEmptyState();
    return;
  }

  items.forEach(item => {
    const el = buildGalleryItemElement(item);
    grid.appendChild(el);
  });

  galleryState.hasMore = data.page < data.pages;
  galleryState.page    = data.page;
}

/**
 * Purpose: Build a single gallery card DOM element from a media post.
 * @param {Object} item - { title, caption, media_url, media_type, uploaded_by_name }
 * @returns {HTMLElement} Gallery item element
 * Algorithm:
 * 1. Create container div
 * 2. Build image or video element
 * 3. Build caption overlay
 * 4. Return assembled element
 */
function buildGalleryItemElement(item) {
  const el = document.createElement('div');
  el.className = 'gallery-item';

  const mediaHtml = item.media_type === 'video'
    ? `<video src="${escapeHtml(item.media_url)}" controls style="width:100%;display:block" aria-label="${escapeHtml(item.title)}"></video>`
    : `<img src="${escapeHtml(item.media_url || '/assets/images/gallery-placeholder.jpg')}"
             alt="${escapeHtml(item.caption || item.title)}"
             loading="lazy">`;

  el.innerHTML = `
    ${mediaHtml}
    <div class="gallery-caption">
      <strong>${escapeHtml(item.title)}</strong>
      ${item.caption ? `<p style="margin:4px 0 0;font-size:12px;opacity:0.85">${escapeHtml(item.caption)}</p>` : ''}
    </div>`;

  return el;
}

/**
 * Purpose: Build the empty state HTML for when there are no gallery items.
 * @returns {string} HTML string for empty state
 */
function buildGalleryEmptyState() {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-state-icon">📷</div>
    <h3>No photos yet</h3>
    <p>PNEC coordinators will share training photos and community event highlights here. Check back soon!</p>
  </div>`;
}

/**
 * Purpose: Show an error message in the gallery grid.
 * @param {HTMLElement} grid - The masonry grid element
 * @returns {void}
 */
function showGalleryError(grid) {
  grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">⚠️</div><h3>Unable to load gallery</h3><p>Please try again later.</p></div>';
}

/**
 * Purpose: Bind the upload button to navigate to the upload page.
 * @returns {void}
 */
function bindUploadButton() {
  const btn = document.getElementById('upload-media-btn');
  if (btn) btn.addEventListener('click', () => { window.location.href = '/pages/upload.html'; });
}

/**
 * Purpose: Read the cached user object from sessionStorage.
 * @returns {Object|null} Parsed user object or null
 * Algorithm:
 * 1. Read pnec_user key from sessionStorage
 * 2. Parse JSON
 * 3. Return object or null on parse error
 */
function _readSessionUser() {
  try { return JSON.parse(sessionStorage.getItem('pnec_user')); }
  catch { return null; }
}
