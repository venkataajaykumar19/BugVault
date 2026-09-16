/**
 * BugVault Frontend Application Logic
 * Implements full CRUD lifecycle: POST, GET, PUT, DELETE with SQLite backend.
 * Supports relational categories: One Category has Many Bugs.
 */

// Production & Local Backend URL configuration
// In production (GitHub Pages/Netlify), it points to the deployed Render backend service.
// In local development, it targets http://localhost:3000.
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:';

const BACKEND_URL = isLocal 
  ? 'http://localhost:3000' 
  : 'https://bugvault-api.onrender.com';

// State variables
let bugs = [];
let categories = [];
let editingBugId = null;
let isSubmitting = false;

// DOM Elements
const bugForm = document.getElementById('bug-form');
const bugIdInput = document.getElementById('bug-id');
const bugTitleInput = document.getElementById('bug-title');
const bugCategorySelect = document.getElementById('bug-category');
const bugErrorInput = document.getElementById('bug-error');
const bugCauseInput = document.getElementById('bug-cause');
const bugSolutionInput = document.getElementById('bug-solution');
const bugDateInput = document.getElementById('bug-date');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const cancelBtn = document.getElementById('cancel-btn');
const formHeading = document.getElementById('form-heading');
const formModeIndicator = document.getElementById('form-mode-indicator');
const bugsContainer = document.getElementById('bugs-container');
const bugCountBadge = document.getElementById('bug-count');
const loadingState = document.getElementById('loading-state');
const loadingMessage = document.getElementById('loading-message');
const errorState = document.getElementById('error-state');
const errorDetail = document.getElementById('error-detail');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');
const alertBanner = document.getElementById('alert-banner');
const refreshBtn = document.getElementById('refresh-btn');
const backendStatusBadge = document.getElementById('backend-status-badge');

/**
 * Initialize today's date as default in the date input
 */
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  bugDateInput.value = today;
}

/**
 * Show a notification message in the alert banner
 */
let alertTimeout;
function showAlert(message, type = 'info', duration = 4000) {
  clearTimeout(alertTimeout);
  alertBanner.textContent = message;
  alertBanner.className = `alert-banner ${type}`;
  alertBanner.classList.remove('hidden');

  if (duration > 0) {
    alertTimeout = setTimeout(() => {
      alertBanner.classList.add('hidden');
    }, duration);
  }
}

/**
 * Hide the notification banner
 */
function hideAlert() {
  alertBanner.classList.add('hidden');
}

/**
 * Update UI loading state
 */
function setLoading(isLoading, message = 'Loading bugs...') {
  if (isLoading) {
    loadingMessage.textContent = message;
    loadingState.classList.remove('hidden');
    if (message !== 'Loading bugs...') {
      // If submitting, updating, or deleting, disable submit button
      submitBtn.disabled = true;
    }
  } else {
    loadingState.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

/**
 * Check backend health status
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        backendStatusBadge.textContent = '● Backend Online';
        backendStatusBadge.className = 'badge online';
        return true;
      }
    }
    throw new Error('Health check failed');
  } catch (err) {
    backendStatusBadge.textContent = '● Backend Offline';
    backendStatusBadge.className = 'badge offline';
    return false;
  }
}

/**
 * Fetch categories from GET /categories and populate the dropdown
 */
async function fetchCategories() {
  try {
    const res = await fetch(`${BACKEND_URL}/categories`);
    if (res.ok) {
      categories = await res.json();
      renderCategoryOptions(categories);
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

/**
 * Render category options in dropdown
 */
function renderCategoryOptions(catList) {
  bugCategorySelect.innerHTML = '<option value="">Select category</option>';
  catList.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    bugCategorySelect.appendChild(opt);
  });
}

/**
 * READ FLOW: Fetch all bugs from GET /bugs
 */
async function fetchBugs() {
  errorState.classList.add('hidden');
  emptyState.classList.add('hidden');
  setLoading(true, 'Loading bugs...');

  try {
    const response = await fetch(`${BACKEND_URL}/bugs`);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    bugs = await response.json();
    renderBugsList(bugs);
    checkBackendHealth();
  } catch (error) {
    console.error('Failed to fetch bugs:', error);
    bugsContainer.innerHTML = '';
    bugCountBadge.textContent = '0 records';
    errorDetail.textContent = 'Unable to connect to the server. Please check that the backend is running and try again.';
    errorState.classList.remove('hidden');
    checkBackendHealth();
  } finally {
    setLoading(false);
  }
}

/**
 * Render the list of bug records in the DOM
 */
function renderBugsList(bugList) {
  bugsContainer.innerHTML = '';
  bugCountBadge.textContent = `${bugList.length} ${bugList.length === 1 ? 'record' : 'records'}`;

  if (bugList.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  bugList.forEach(bug => {
    const card = document.createElement('article');
    card.className = `bug-card ${editingBugId === bug.id ? 'editing' : ''}`;
    card.id = `bug-card-${bug.id}`;

    const categoryLabel = bug.category_name || 'Uncategorized';

    card.innerHTML = `
      <div class="bug-card-header">
        <div class="bug-card-title-group">
          <h3 class="bug-title" id="bug-title-${bug.id}">${escapeHtml(bug.title)}</h3>
          <div class="bug-meta">
            <span class="bug-id-tag">#${bug.id}</span>
            <span class="bug-category-tag">🏷️ ${escapeHtml(categoryLabel)}</span>
            <span class="bug-date">📅 Encountered: ${escapeHtml(bug.date)}</span>
          </div>
        </div>
        <div class="bug-card-actions">
          <button 
            type="button" 
            class="btn btn-edit" 
            id="edit-btn-${bug.id}"
            onclick="startEdit(${bug.id})"
            aria-label="Edit bug ${bug.id}"
          >
            ✏️ Edit
          </button>
          <button 
            type="button" 
            class="btn btn-danger" 
            id="delete-btn-${bug.id}"
            onclick="confirmDelete(${bug.id})"
            aria-label="Delete bug ${bug.id}"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      <div class="bug-details">
        <div class="detail-block error-block">
          <div class="detail-label">Error / Symptom</div>
          <div class="detail-content">${escapeHtml(bug.error)}</div>
        </div>

        <div class="detail-block cause-block">
          <div class="detail-label">Root Cause</div>
          <div class="detail-content">${escapeHtml(bug.cause)}</div>
        </div>

        <div class="detail-block solution-block">
          <div class="detail-label">Solution / Fix</div>
          <div class="detail-content">${escapeHtml(bug.solution)}</div>
        </div>
      </div>
    `;

    bugsContainer.appendChild(card);
  });
}

/**
 * CREATE & UPDATE FLOW: Form submission
 */
bugForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  // Extract form inputs
  const title = bugTitleInput.value.trim();
  const categoryId = parseInt(bugCategorySelect.value, 10);
  const error = bugErrorInput.value.trim();
  const cause = bugCauseInput.value.trim();
  const solution = bugSolutionInput.value.trim();
  const date = bugDateInput.value.trim();

  // Validate fields
  if (!title || !error || !cause || !solution || !date || isNaN(categoryId) || categoryId <= 0) {
    showAlert('Please fill in all required fields and select a valid category.', 'error');
    return;
  }

  const bugData = { title, error, cause, solution, date, category_id: categoryId };

  isSubmitting = true;

  if (editingBugId) {
    // ==========================================
    // UPDATE FLOW: PUT /bugs/:id
    // ==========================================
    setLoading(true, 'Updating...');
    try {
      const response = await fetch(`${BACKEND_URL}/bugs/${editingBugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bugData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Server error: ${response.status}`);
      }

      const updatedBug = await response.json();
      showAlert(`Bug #${updatedBug.id} updated successfully!`, 'success');
      resetForm();
      await fetchBugs();
    } catch (err) {
      console.error('Update error:', err);
      showAlert(`Failed to update bug: ${err.message}`, 'error');
    } finally {
      isSubmitting = false;
      setLoading(false);
    }
  } else {
    // ==========================================
    // CREATE FLOW: POST /bugs
    // ==========================================
    setLoading(true, 'Saving...');
    try {
      const response = await fetch(`${BACKEND_URL}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bugData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Server error: ${response.status}`);
      }

      const newBug = await response.json();
      showAlert(`Bug record #${newBug.id} saved successfully!`, 'success');
      resetForm();
      await fetchBugs();
    } catch (err) {
      console.error('Create error:', err);
      showAlert(`Failed to save bug: ${err.message}`, 'error');
    } finally {
      isSubmitting = false;
      setLoading(false);
    }
  }
});

/**
 * UPDATE FLOW: Enter edit mode
 */
function startEdit(id) {
  const bug = bugs.find(b => b.id === id);
  if (!bug) return;

  editingBugId = id;
  bugIdInput.value = bug.id;
  bugTitleInput.value = bug.title;
  bugCategorySelect.value = bug.category_id || '';
  bugErrorInput.value = bug.error;
  bugCauseInput.value = bug.cause;
  bugSolutionInput.value = bug.solution;
  bugDateInput.value = bug.date;

  // Update form visuals for edit mode
  formHeading.textContent = `Edit Bug Record #${bug.id}`;
  formModeIndicator.textContent = 'Editing Mode';
  formModeIndicator.className = 'mode-badge mode-edit';
  submitBtnText.textContent = 'Update Bug';
  cancelBtn.classList.remove('hidden');

  // Re-render list to highlight the editing card
  renderBugsList(bugs);

  // Scroll form into view
  bugForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  bugTitleInput.focus();
}

/**
 * UPDATE FLOW: Cancel edit mode
 */
function resetForm() {
  editingBugId = null;
  bugIdInput.value = '';
  bugForm.reset();
  bugCategorySelect.value = '';
  setDefaultDate();

  formHeading.textContent = 'Record New Bug';
  formModeIndicator.textContent = 'New Entry';
  formModeIndicator.className = 'mode-badge mode-create';
  submitBtnText.textContent = 'Save Bug Record';
  cancelBtn.classList.add('hidden');

  // Re-render to clear editing highlight
  renderBugsList(bugs);
}

cancelBtn.addEventListener('click', resetForm);

/**
 * DELETE FLOW: DELETE /bugs/:id
 */
async function confirmDelete(id) {
  const bug = bugs.find(b => b.id === id);
  const bugTitle = bug ? `"${bug.title}"` : `Bug #${id}`;

  const confirmed = window.confirm(`Are you sure you want to delete ${bugTitle}? This action cannot be undone.`);
  if (!confirmed) return;

  setLoading(true, 'Deleting...');

  try {
    const response = await fetch(`${BACKEND_URL}/bugs/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server error: ${response.status}`);
    }

    showAlert(`Bug #${id} was deleted successfully.`, 'success');

    // If we were editing this bug, reset form
    if (editingBugId === id) {
      resetForm();
    }

    await fetchBugs();
  } catch (err) {
    console.error('Delete error:', err);
    showAlert(`Failed to delete bug: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Helper to escape HTML characters and prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
refreshBtn.addEventListener('click', async () => {
  await fetchCategories();
  await fetchBugs();
});
retryBtn.addEventListener('click', async () => {
  await fetchCategories();
  await fetchBugs();
});

// Window load initialization
window.addEventListener('DOMContentLoaded', async () => {
  setDefaultDate();
  await fetchCategories();
  await fetchBugs();
});
