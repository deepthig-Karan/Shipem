// tracking-render.js
// JSONP fetch + renderer that outputs the tracking layout matching the provided design.
// Edit APPS_SCRIPT_URL to your Apps Script /exec URL.

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzXtAKOeqg0bHRrtIiy78P8hbTNaGYYf1NKyQaXzwIKq0n-0ir1Oc_Id0_3mIbCkIJ/exec";

(function () {
  function $ (s) { return document.querySelector(s); }
  const trackInput = $('#trackInput');
  const trackBtn = $('#trackBtn');
  const trackResult = $('#trackResult');

  if (!trackInput || !trackBtn || !trackResult) {
    console.warn('tracking-render: missing elements (#trackInput, #trackBtn, #trackResult)');
    return;
  }

  trackBtn.addEventListener('click', function () {
    const id = (trackInput.value || '').trim();
    if (!id) return showMessage('Please enter a consignment number', true);
    showLoading();
    fetchJsonp(APPS_SCRIPT_URL, id, renderResult, showError);
  });

  trackInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trackBtn.click();
  });

  function showMessage(msg, isError) {
    trackResult.innerHTML = `<div class="track-message ${isError ? 'error' : ''}">${escapeHtml(msg)}</div>`;
  }
  function showLoading() {
    trackResult.innerHTML = '<div class="track-loading">Searching…</div>';
  }
  function showError(msg) {
    trackResult.innerHTML = `<div class="track-message error">${escapeHtml(msg || 'Network error')}</div>`;
  }

  // JSONP helper
  function fetchJsonp(baseUrl, id, onSuccess, onError) {
    const cb = 'trkcb_' + Date.now() + '_' + Math.floor(Math.random()*10000);
    window[cb] = function (data) {
      try { onSuccess(data); }
      finally {
        cleanup();
      }
    };
    function cleanup() {
      try { delete window[cb]; } catch(e){}
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    const script = document.createElement('script');
    script.src = `${baseUrl}?id=${encodeURIComponent(id)}&callback=${cb}`;
    script.onerror = function () {
      cleanup();
      if (onError) onError();
    };
    document.body.appendChild(script);
  }

  // Main renderer: builds markup matching the screenshot design
  function renderResult(data) {
    if (!data) return showMessage('Empty response', true);
    if (!data.found) return showMessage(data.message || 'Consignment not found', true);

    // Build header block
    const consign = escapeHtml(data.consignment_no || '');
    // If you store origin/destination in your sheet, you can pull from data; fallback placeholders:
    const originText = escapeHtml(data.origin || 'India');
    const destText = escapeHtml(data.destination || 'New Zealand');

    let html = '';
    html += '<div class="track-left">';
    html += '<div class="consign-row">';
    html += '<div class="consign-label">Consignment no</div>';
    html += '<div class="consign-no">' + consign + '</div>';
    html += '</div>';
    html += '<div class="location-bars">';
    html += '<div class="bar origin">' + originText + '</div>';
    html += '<div class="bar destination">' + destText + '</div>';
    html += '</div>';
    html += '<div class="track-right">';
    html += '<img src="Logo/el_logo.svg" alt="ShipEm" class="track-logo">';
    html += '</div>';
    html += '</div>';


    html += '</div>'; // track-header

    // table header (visual only)
    html += '<table class="track-table"><colgroup><col/><col/><col/></colgroup>';
    html += '<thead><tr><th>Status</th><th>Current place</th><th>Details</th></tr></thead></table>';

    // For each event group render a boxed area
    data.events.forEach(group => {
      html += '<div class="group-box">';
      html += '<div class="group-status-title">' + escapeHtml(group.status) + '</div>';
      html += '<div class="group-items">';
      group.items.forEach((it, idx) => {
        html += '<div class="row">';
        html += '<div class="cell date">' + escapeHtml(it.date || '') + '</div>';
        html += '<div class="cell place">' + escapeHtml(it.place || '') + '</div>';
        html += '<div class="cell details">' + escapeHtml(it.details || '') + '</div>';
        html += '</div>';
      });
      html += '</div>'; // group-items
      html += '</div>'; // group-box
    });

    trackResult.innerHTML = html;
  }

  // small sanitizer
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

})();


