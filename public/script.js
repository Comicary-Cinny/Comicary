// ============================================
// COMICARY - FRONTEND AUTHENTICATION
// ============================================

const API_URL = '/api';

// State management
let authState = {
  isSignUp: false,
  currentUser: null,
  token: null,
  isLoggedIn: false
};

let loadedUploads = [];
let activeDetailUploadId = null;
let activeDetailUploadStatus = null;
let uploadPendingDelete = null;
let bookmarkViewActive = false;
let currentSearchQuery = '';
let searchHideTimeout = null;
const BOOKMARKS_KEY = 'comicary_bookmarks';

// Load current user on page load
document.addEventListener('DOMContentLoaded', function() {
  loadUserSession();
  setupEventListeners();
  initializeApp();
});

// ============================================
// USER SESSION MANAGEMENT
// ============================================

function loadUserSession() {
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('currentUser');
  
  if (savedToken && savedUser) {
    authState.token = savedToken;
    authState.currentUser = JSON.parse(savedUser);
    authState.isLoggedIn = true;
    updateUIForLoggedInUser(authState.currentUser.username);
    console.log(`Welcome back, ${authState.currentUser.username}!`);
  } else {
    // User is not logged in, show sign up button
    updateUIForLoggedOutUser();
  }
}

function saveUserSession(token, user) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('currentUser', JSON.stringify(user));
  authState.token = token;
  authState.currentUser = user;
  authState.isLoggedIn = true;
}

function logoutUser() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  authState.isLoggedIn = false;
  authState.currentUser = null;
  authState.token = null;
  updateUIForLoggedOutUser();
  showNotification('You have been logged out.', 'logout');
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

// ============================================
// UI UPDATES
// ============================================

function updateUIForLoggedInUser(username) {
  const navSignUpBtn = document.getElementById('navSignUpBtn');
  const profileDropdownWrapper = document.getElementById('profileDropdownWrapper');
  const navPending = document.getElementById('navPending');
  const navPublish = document.getElementById('navPublish');
  
  // Hide sign up button, show profile dropdown
  if (navSignUpBtn) navSignUpBtn.style.display = 'none';
  if (profileDropdownWrapper) profileDropdownWrapper.style.display = 'block';
  
  // Load profile info in dropdown
  loadProfileDropdown();
  
  // Show role-based tabs
  if (authState.currentUser && authState.currentUser.isAdmin) {
    // Admin: show Publish tab only
    if (navPublish) navPublish.style.display = 'block';
    if (navPending) navPending.style.display = 'none';
  } else {
    // Regular user: show Pending tab only
    if (navPending) navPending.style.display = 'block';
    if (navPublish) navPublish.style.display = 'none';
  }
}

function updateUIForLoggedOutUser() {
  const navSignUpBtn = document.getElementById('navSignUpBtn');
  const profileDropdownWrapper = document.getElementById('profileDropdownWrapper');
  const navPending = document.getElementById('navPending');
  const navPublish = document.getElementById('navPublish');
  
  // Hide profile dropdown, show sign up button
  if (navSignUpBtn) {
    navSignUpBtn.style.display = 'block';
    navSignUpBtn.innerHTML = '<span>👤+</span> Sign Up';
    navSignUpBtn.onclick = (e) => {
      e.preventDefault();
      openAuthModal(false);
    };
  }
  if (profileDropdownWrapper) profileDropdownWrapper.style.display = 'none';
  
  // Hide all user-specific tabs when logged out
  if (navPending) navPending.style.display = 'none';
  if (navPublish) navPublish.style.display = 'none';
}

function showLogoutMenu() {
  logoutUser();
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
  const closeTitleDetailModalBtn = document.getElementById('closeTitleDetailModalBtn');
  if (closeTitleDetailModalBtn) {
    closeTitleDetailModalBtn.addEventListener('click', closeTitleDetailModal);
  }

  const detailModal = document.getElementById('titleDetailModal');
  if (detailModal) {
    detailModal.addEventListener('click', (event) => {
      if (event.target === detailModal) closeTitleDetailModal();
    });
  }

  const commentForm = document.getElementById('commentForm');
  if (commentForm) {
    commentForm.addEventListener('submit', handleCommentSubmit);
  }

  // Sign up button in navbar
  const navSignUpBtn = document.getElementById('navSignUpBtn');
  if (navSignUpBtn && !authState.isLoggedIn) {
    navSignUpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal(false);
    });
  }

  // Auth modal controls
  const closeModalBtn = document.getElementById('closeModalBtn');
  const authForm = document.getElementById('authForm');
  const toggleAuthModeBtn = document.getElementById('toggleAuthModeBtn');
  const adminSignInBtn = document.getElementById('adminSignInBtn');
  const closeVerifyModalBtn = document.getElementById('closeVerifyModalBtn');
  const verifyForm = document.getElementById('verifyForm');
  const closeDeleteConfirmBtn = document.getElementById('closeDeleteConfirmBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  const detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
  if (detailBookmarkBtn) {
    detailBookmarkBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activeDetailUploadId) toggleBookmark(activeDetailUploadId, event);
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeAuthModal);
  }

  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', toggleAuthMode);
  }

  // Admin Sign Up modal handlers
  const closeAdminSignUpModalBtn = document.getElementById('closeAdminSignUpModalBtn');
  const adminSignUpForm = document.getElementById('adminSignUpForm');
  const backToLoginBtn = document.getElementById('backToLoginBtn');

  if (closeAdminSignUpModalBtn) {
    closeAdminSignUpModalBtn.addEventListener('click', closeAdminSignUpModal);
  }

  if (adminSignUpForm) {
    adminSignUpForm.addEventListener('submit', handleAdminSignUpSubmit);
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeAdminSignUpModal();
      openAuthModal(false);
    });
  }

  if (closeVerifyModalBtn) {
    closeVerifyModalBtn.addEventListener('click', closeVerifyModal);
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', handleVerifySubmit);
  }

  if (closeDeleteConfirmBtn) {
    closeDeleteConfirmBtn.addEventListener('click', closeDeleteConfirmModal);
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmPermanentDelete);
  }

  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', (event) => {
      if (event.target === deleteConfirmModal) closeDeleteConfirmModal();
    });
  }

  // Verify digit inputs - auto-advance
  setupVerifyDigitInputs();

  // Upload form
  const uploadTitleForm = document.getElementById('uploadTitleForm');
  if (uploadTitleForm) {
    uploadTitleForm.addEventListener('submit', handleUploadSubmit);
  }

  // File dropzone
  setupFileDropzone();

  // Profile form handlers
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  const profileCancelBtn = document.getElementById('profileCancelBtn');
  const profilePictureInput = document.getElementById('profilePictureInput');
  const profileAboutMeInput = document.getElementById('profileAboutMeInput');

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', handleProfileSave);
  }

  if (profileCancelBtn) {
    profileCancelBtn.addEventListener('click', loadUserProfile);
  }

  if (profilePictureInput) {
    profilePictureInput.addEventListener('change', handleProfilePictureChange);
  }

  // Upload file button
  const profileUploadFileBtn = document.getElementById('profileUploadFileBtn');
  if (profileUploadFileBtn) {
    profileUploadFileBtn.addEventListener('click', () => {
      profilePictureInput.click();
    });
  }

  if (profileAboutMeInput) {
    profileAboutMeInput.addEventListener('input', (e) => {
      const charCount = document.getElementById('charCount');
      if (charCount) {
        charCount.textContent = `${e.target.value.length}/300`;
      }
    });
  }

  // Profile dropdown handlers
  const navProfileMiniBtn = document.getElementById('navProfileMiniBtn');
  const profileDropdownCard = document.getElementById('profileDropdownCard');
  const dropdownEditProfileBtn = document.getElementById('dropdownEditProfileBtn');
  const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');

  if (navProfileMiniBtn) {
    navProfileMiniBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = profileDropdownCard.style.display === 'block';
      if (!isVisible) {
        // Load profile data when opening dropdown
        loadProfileDropdown();
      }
      profileDropdownCard.style.display = isVisible ? 'none' : 'block';
    });
  }

  if (dropdownEditProfileBtn) {
    dropdownEditProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      profileDropdownCard.style.display = 'none';
      showPage('viewProfile');
      loadUserProfile();
    });
  }

  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      profileDropdownCard.style.display = 'none';
      logoutUser();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const profileDropdownWrapper = document.getElementById('profileDropdownWrapper');
    if (profileDropdownWrapper && !profileDropdownWrapper.contains(e.target)) {
      profileDropdownCard.style.display = 'none';
    }
  });

  // Search
  const navSearchInput = document.getElementById('navSearchInput');
  if (navSearchInput) {
    navSearchInput.addEventListener('input', (event) => {
      currentSearchQuery = (event.target.value || '').trim().toLowerCase();
      clearTimeout(searchHideTimeout);

      if (!currentSearchQuery) {
        hideSearchSuggestions();
        loadTitles();
        return;
      }

      renderSearchResults();
      searchHideTimeout = setTimeout(() => {
        hideSearchSuggestions();
      }, 1400);
    });

    navSearchInput.addEventListener('blur', () => {
      searchHideTimeout = setTimeout(() => {
        hideSearchSuggestions();
      }, 180);
    });

    navSearchInput.addEventListener('focus', () => {
      clearTimeout(searchHideTimeout);
      if (currentSearchQuery) {
        renderSearchResults();
      }
    });
  }

  // Page navigation
  const navHome = document.getElementById('navHome');
  const navBrowse = document.getElementById('navBrowse');
  const navProfile = document.getElementById('navProfile');
  const navPending = document.getElementById('navPending');
  const navPublish = document.getElementById('navPublish');
  const navBookmarksBtn = document.getElementById('navBookmarksBtn');
  
  if (navHome) navHome.addEventListener('click', (e) => {
    e.preventDefault();
    bookmarkViewActive = false;
    updateBookmarkButtonState();
    showPage('viewHome');
    navHome.classList.add('active-tab');
    if (navBrowse) navBrowse.classList.remove('active-tab');
    if (navProfile) navProfile.classList.remove('active-tab');
    if (navPending) navPending.classList.remove('active-tab');
    if (navPublish) navPublish.classList.remove('active-tab');
    loadTitles();
  });
  
  if (navBrowse) navBrowse.addEventListener('click', (e) => {
    e.preventDefault();
    bookmarkViewActive = false;
    updateBookmarkButtonState();
    showPage('viewBrowse');
    navBrowse.classList.add('active-tab');
    if (navHome) navHome.classList.remove('active-tab');
    if (navProfile) navProfile.classList.remove('active-tab');
    if (navPending) navPending.classList.remove('active-tab');
    if (navPublish) navPublish.classList.remove('active-tab');
    loadTitles();
  });

  if (navPending) navPending.addEventListener('click', (e) => {
    e.preventDefault();
    bookmarkViewActive = false;
    updateBookmarkButtonState();
    showPage('viewPending');
    navPending.classList.add('active-tab');
    if (navHome) navHome.classList.remove('active-tab');
    if (navBrowse) navBrowse.classList.remove('active-tab');
    if (navProfile) navProfile.classList.remove('active-tab');
    if (navPublish) navPublish.classList.remove('active-tab');
    loadPendingUploads();
  });

  if (navPublish) navPublish.addEventListener('click', (e) => {
    e.preventDefault();
    bookmarkViewActive = false;
    updateBookmarkButtonState();
    showPage('viewPublish');
    navPublish.classList.add('active-tab');
    if (navHome) navHome.classList.remove('active-tab');
    if (navBrowse) navBrowse.classList.remove('active-tab');
    if (navProfile) navProfile.classList.remove('active-tab');
    if (navPending) navPending.classList.remove('active-tab');
    loadPublishQueue();
  });

  if (navBookmarksBtn) {
    navBookmarksBtn.addEventListener('click', (e) => {
      e.preventDefault();
      bookmarkViewActive = !bookmarkViewActive;
      updateBookmarkButtonState();
      showPage('viewBrowse');
      navBrowse?.classList.add('active-tab');
      navHome?.classList.remove('active-tab');
      navProfile?.classList.remove('active-tab');
      navPending?.classList.remove('active-tab');
      navPublish?.classList.remove('active-tab');
      loadTitles();
    });
  }
}

// ============================================
// AUTH MODAL FUNCTIONS
// ============================================

function openAuthModal(isSignUp = false) {
  authState.isSignUp = isSignUp;
  const authModal = document.getElementById('authModal');
  const modalTitle = document.getElementById('modalTitle');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const toggleAuthText = document.getElementById('toggleAuthText');

  if (authModal) {
    authModal.classList.add('active');
    
    if (isSignUp) {
      modalTitle.textContent = 'Create Your Account';
      if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
      submitAuthBtn.textContent = 'Sign Up';
      toggleAuthText.textContent = 'Already have an account?';
    } else {
      modalTitle.textContent = 'Sign In to Your Account';
      if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
      submitAuthBtn.textContent = 'Sign In';
      toggleAuthText.textContent = "Don't have an account?";
    }
    
    // Clear form
    document.getElementById('authForm').reset();
    clearAuthErrors();
  }
}

function closeAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.remove('active');
  }
  clearAuthErrors();
}

function toggleAuthMode() {
  authState.isSignUp = !authState.isSignUp;
  openAuthModal(authState.isSignUp);
}

function closeVerifyModal() {
  const verifyModal = document.getElementById('verifyModal');
  if (verifyModal) {
    verifyModal.classList.remove('active');
  }
  document.getElementById('verifyForm').reset();
  document.getElementById('verifyError').style.display = 'none';
}

function openAdminSignUpModal() {
  const adminSignUpModal = document.getElementById('adminSignUpModal');
  if (adminSignUpModal) {
    adminSignUpModal.classList.add('active');
  }
  document.getElementById('adminSignUpForm').reset();
  clearAdminSignUpErrors();
}

function closeAdminSignUpModal() {
  const adminSignUpModal = document.getElementById('adminSignUpModal');
  if (adminSignUpModal) {
    adminSignUpModal.classList.remove('active');
  }
  document.getElementById('adminSignUpForm').reset();
  clearAdminSignUpErrors();
}

function showAdminSignUpError(fieldId, message) {
  const errorElement = document.getElementById(fieldId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function clearAdminSignUpErrors() {
  const errorElements = document.querySelectorAll('#adminSignUpModal .error-msg');
  errorElements.forEach(el => {
    el.style.display = 'none';
  });
}

async function handleAdminSignUpSubmit(e) {
  e.preventDefault();
  clearAdminSignUpErrors();

  const username = document.getElementById('adminRegUsername').value.trim();
  const password = document.getElementById('adminRegPassword').value;

  let hasErrors = false;

  if (!username) {
    showAdminSignUpError('adminRegUsernameError', 'Username is required.');
    hasErrors = true;
  }

  if (!password) {
    showAdminSignUpError('adminRegPasswordError', 'Password is required.');
    hasErrors = true;
  }

  if (hasErrors) return;

  try {
    const response = await fetch(API_URL + '/auth/admin-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showAdminSignUpError('adminRegUsernameError', data.error || 'Failed to create admin account');
      return;
    }

    // Successful admin signup
    saveUserSession(data.token, data.user);
    closeAdminSignUpModal();
    updateUIForLoggedInUser(data.user.username);
    alert(`Admin account created successfully! Welcome, ${data.user.username}.`);
    
    // Show upload section
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'block';
      uploadSection.scrollIntoView({ behavior: 'smooth' });
    }

    loadTitles();
  } catch (error) {
    console.error('Error:', error);
    showAdminSignUpError('adminRegUsernameError', '❌ Server not running! Start the backend with: npm start');
  }
}

// ============================================
// FORM VALIDATION & SUBMISSION
// ============================================

function validateUsername(username) {
  return username.length >= 3;
}

function validatePassword(password) {
  return password.length >= 6;
}

function clearAuthErrors() {
  const errorElements = document.querySelectorAll('.error-msg');
  errorElements.forEach(el => {
    el.style.display = 'none';
  });
}

function showAuthError(fieldId, message) {
  const errorElement = document.getElementById(fieldId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const confirmPassword = document.getElementById('authConfirmPassword')?.value;

  let hasErrors = false;

  // Username validation
  if (!username) {
    showAuthError('usernameError', 'Username is required.');
    hasErrors = true;
  } else if (!validateUsername(username)) {
    showAuthError('usernameError', 'Username must be at least 3 characters long.');
    hasErrors = true;
  }

  // Password validation
  if (!password) {
    showAuthError('passwordError', 'Password is required.');
    hasErrors = true;
  } else if (!validatePassword(password)) {
    showAuthError('passwordError', 'Password must be at least 6 characters long.');
    hasErrors = true;
  }

  if (authState.isSignUp) {
    // Sign up validation
    if (!confirmPassword) {
      showAuthError('confirmPasswordError', 'Please confirm your password.');
      hasErrors = true;
    } else if (password !== confirmPassword) {
      showAuthError('confirmPasswordError', 'Passwords do not match.');
      hasErrors = true;
    }
  }

  if (hasErrors) return;

  // Call backend API
  const endpoint = authState.isSignUp ? '/auth/signup' : '/auth/signin';
  const payload = authState.isSignUp 
    ? { username, password }
    : { username, password };

  try {
    const response = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showAuthError('usernameError', data.error || 'Authentication failed');
      return;
    }

    // Successful sign in/up - save session and update UI
    saveUserSession(data.token, data.user);
    closeAuthModal();
    updateUIForLoggedInUser(data.user.username);
    alert(`Welcome, ${data.user.username}! You are now logged in.`);
    
    // Show upload section for signed-in users
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'block';
      uploadSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Reload titles
    loadTitles();
  } catch (error) {
    console.error('Error:', error);
    showAuthError('usernameError', '❌ Server not running! Start the backend with: npm start');
  }
}

// ============================================
// EMAIL VERIFICATION
// ============================================

function openVerifyModal() {
  const verifyModal = document.getElementById('verifyModal');
  if (verifyModal) {
    verifyModal.classList.add('active');
  }
  document.getElementById('verifyForm').reset();
  document.getElementById('verifyError').style.display = 'none';
  // Focus on first digit
  setTimeout(() => {
    document.getElementById('digit1').focus();
  }, 100);
}

function setupVerifyDigitInputs() {
  const digitInputs = document.querySelectorAll('.verify-digit');
  
  digitInputs.forEach((input, index) => {
    input.addEventListener('keydown', (e) => {
      // Allow backspace and arrow keys
      if (e.key === 'Backspace') {
        e.preventDefault();
        input.value = '';
        if (index > 0) {
          digitInputs[index - 1].focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (index > 0) digitInputs[index - 1].focus();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (index < digitInputs.length - 1) digitInputs[index + 1].focus();
      }
    });

    input.addEventListener('input', (e) => {
      // Only allow digits
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      
      // Auto-advance to next field
      if (e.target.value.length === 1 && index < digitInputs.length - 1) {
        digitInputs[index + 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pastedData.replace(/[^0-9]/g, '').split('');
      
      digits.forEach((digit, i) => {
        if (index + i < digitInputs.length) {
          digitInputs[index + i].value = digit;
        }
      });
      
      if (digits.length > 0) {
        digitInputs[Math.min(index + digits.length - 1, digitInputs.length - 1)].focus();
      }
    });
  });
}

async function handleVerifySubmit(e) {
  e.preventDefault();
  
  const digits = [1, 2, 3, 4, 5, 6]
    .map(n => document.getElementById(`digit${n}`).value)
    .join('');

  if (digits.length !== 6) {
    showVerifyError('Please enter all 6 digits.');
    return;
  }

  try {
    const response = await fetch(API_URL + '/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authState.pendingEmail,
        code: digits
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showVerifyError(data.error || 'Verification failed');
      return;
    }

    // Verification successful
    saveUserSession(data.token, data.user);
    closeVerifyModal();
    updateUIForLoggedInUser(data.user.email);
    alert(`Welcome, ${data.user.name}! You are now logged in.`);
    
    // Show upload section
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'block';
      uploadSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Reload titles
    loadTitles();
  } catch (error) {
    console.error('Error:', error);
    showVerifyError('Connection error. Make sure server is running on localhost:3000');
  }
}

function showVerifyError(message) {
  const verifyError = document.getElementById('verifyError');
  if (verifyError) {
    verifyError.textContent = message;
    verifyError.style.display = 'block';
  }
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(pageId) {
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(page => {
    page.style.display = 'none';
  });
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
  }
}

function getBookmarkedUploadIds() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
  } catch {
    return [];
  }
}

function isUploadBookmarked(uploadId) {
  return getBookmarkedUploadIds().includes(uploadId);
}

function saveBookmarkedUploadIds(ids) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(ids));
}

function toggleBookmark(uploadId, event) {
  if (event) event.stopPropagation();
  const ids = getBookmarkedUploadIds();
  const index = ids.indexOf(uploadId);

  if (index >= 0) {
    ids.splice(index, 1);
  } else {
    ids.push(uploadId);
  }

  saveBookmarkedUploadIds(ids);
  syncBookmarkButtons();
  updateBookmarkButtonState();

  if (activeDetailUploadId === uploadId) {
    syncDetailBookmarkButton();
  }

  if (bookmarkViewActive) {
    loadTitles();
  }
}

function syncBookmarkButtons() {
  const bookmarkButtons = document.querySelectorAll('.title-card-bookmark-btn, .detail-bookmark-btn');

  bookmarkButtons.forEach((button) => {
    const buttonUploadId = button.getAttribute('data-upload-id');
    if (!buttonUploadId) return;

    const isBookmarked = isUploadBookmarked(buttonUploadId);
    button.textContent = isBookmarked ? '★' : '☆';
    button.title = isBookmarked ? 'Remove bookmark' : 'Add bookmark';
    button.classList.toggle('is-bookmarked', isBookmarked);
  });
}

function updateBookmarkButtonState() {
  const navBookmarksBtn = document.getElementById('navBookmarksBtn');
  if (!navBookmarksBtn) return;

  navBookmarksBtn.classList.toggle('is-active', bookmarkViewActive);
  navBookmarksBtn.innerHTML = bookmarkViewActive
    ? '<span>📑</span> Bookmarks'
    : '<span>🔖</span> Bookmarks';
}

function syncDetailBookmarkButton() {
  const detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
  if (!detailBookmarkBtn || !activeDetailUploadId) return;

  const isBookmarked = isUploadBookmarked(activeDetailUploadId);
  detailBookmarkBtn.textContent = isBookmarked ? '★' : '☆';
  detailBookmarkBtn.title = isBookmarked ? 'Remove bookmark' : 'Add bookmark';
  detailBookmarkBtn.classList.toggle('is-bookmarked', isBookmarked);
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

function setupFileDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('comicFileInput');
  const filePreview = document.getElementById('filePreview');

  if (!dropzone || !fileInput) return;

  // Click to browse
  dropzone.addEventListener('click', () => fileInput.click());

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.backgroundColor = 'rgba(100, 150, 255, 0.1)';
    dropzone.style.borderColor = '#6496ff';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.backgroundColor = '';
    dropzone.style.borderColor = '';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.backgroundColor = '';
    dropzone.style.borderColor = '';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleFileSelect(files[0]);
    }
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Upload file button
  const uploadFileBtn = document.getElementById('uploadCoverFileBtn');
  if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      filePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">`;
      filePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

async function handleUploadSubmit(e) {
  e.preventDefault();

  if (!authState.isLoggedIn) {
    alert('Please log in to upload a title.');
    openAuthModal(true);
    return;
  }

  const titleInput = document.getElementById('comicTitleInput');
  const authorInput = document.getElementById('authorNameInput');
  const synopsisInput = document.getElementById('synopsisInput');
  const genreInput = document.getElementById('genreInput');
  const fileInput = document.getElementById('comicFileInput');
  const form = document.getElementById('uploadTitleForm');
  const editId = form.getAttribute('data-edit-id');

  if (!titleInput.value.trim()) {
    alert('Please enter a title name.');
    return;
  }

  if (!editId && !fileInput.files.length) {
    alert('Please select an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const endpoint = editId ? `/uploads/${editId}` : '/uploads';
      const method = editId ? 'PUT' : 'POST';

      const payload = {
        title: titleInput.value.trim(),
        author: authorInput.value.trim(),
        synopsis: synopsisInput.value.trim(),
        genre: genreInput.value.trim()
      };

      // Add image only if provided
      if (e.target.result) {
        payload.image = e.target.result;
      }

      const response = await fetch(API_URL + endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authState.token
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Error: ' + data.error);
        return;
      }

      // Reset form
      document.getElementById('uploadTitleForm').reset();
      form.removeAttribute('data-edit-id');
      document.getElementById('filePreview').style.display = 'none';

      const message = editId ? 'Submission updated successfully!' : 'Title submitted for review!';
      alert(message);
      
      // Reload pending submissions
      loadPendingUploads();
    } catch (error) {
      console.error('Error:', error);
      alert('Upload error. Make sure server is running.');
    }
  };

  // Read file if provided, otherwise proceed without file
  if (fileInput.files.length) {
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    reader.onload({ target: { result: null } });
  }
}

function getFilteredUploads() {
  const baseUploads = bookmarkViewActive
    ? loadedUploads.filter(upload => isUploadBookmarked(upload.id))
    : loadedUploads;

  if (!currentSearchQuery) {
    return baseUploads;
  }

  return baseUploads.filter(upload => {
    const title = (upload.title || '').toLowerCase();
    const author = (upload.author || '').toLowerCase();
    return title.includes(currentSearchQuery) || author.includes(currentSearchQuery);
  });
}

function hideSearchSuggestions() {
  const searchSuggestions = document.getElementById('searchSuggestions');
  if (!searchSuggestions) return;

  searchSuggestions.innerHTML = '';
  searchSuggestions.classList.remove('active');
}

function renderSearchResults() {
  const searchSuggestions = document.getElementById('searchSuggestions');
  if (!searchSuggestions) return;

  const matches = getFilteredUploads();

  if (!currentSearchQuery) {
    hideSearchSuggestions();
    return;
  }

  const resultsHTML = matches.length
    ? matches.map(upload => `
        <button class="search-result-item" type="button" data-upload-id="${upload.id}">
          ${upload.title}
        </button>
      `).join('')
    : '<p class="search-empty-state">No matching titles found.</p>';

  searchSuggestions.innerHTML = resultsHTML;
  searchSuggestions.classList.toggle('active', matches.length > 0);

  searchSuggestions.querySelectorAll('.search-result-item').forEach((button) => {
    button.addEventListener('click', () => {
      const uploadId = button.getAttribute('data-upload-id');
      if (uploadId) {
        openTitleDetails(uploadId);
        hideSearchSuggestions();
      }
    });
  });
}

async function loadTitles() {
  try {
    const response = await fetch(API_URL + '/uploads?status=published');
    const uploads = await response.json();
    loadedUploads = uploads;

    const homeTitlesContainer = document.getElementById('homeTitlesContainer');
    const browseTitlesContainer = document.getElementById('browseTitlesContainer');

    if (currentSearchQuery) {
      renderSearchResults();
      return;
    }

    const visibleUploads = getFilteredUploads();

    const titleHTML = visibleUploads
      .map(upload => {
        const avgRating = upload.avgRating || 0;
        const totalRatings = upload.totalRatings || 0;
        const isBookmarked = isUploadBookmarked(upload.id);
        const bookmarkMarkup = `
          <button class="title-card-bookmark-btn ${isBookmarked ? 'is-bookmarked' : ''}" data-upload-id="${upload.id}" onclick="toggleBookmark('${upload.id}', event)" aria-label="Bookmark title">
            ${isBookmarked ? '★' : '☆'}
          </button>
        `;
        return `
          <div class="title-card" data-upload-id="${upload.id}" onclick="openTitleDetailsFromCard(this, event)">
            <div class="title-card-image-container">
              <img src="${API_URL}/uploads/${upload.id}/image" alt="${upload.title}" class="title-card-image" onerror="this.style.display='none'">
              <button class="title-card-comment-btn" data-upload-id="${upload.id}" onclick="openCommentSection(this, event)" aria-label="Open comments">💬</button>
              <div class="title-card-top-stack">
                <div class="title-card-rating-compact" data-upload-id="${upload.id}" onclick="expandRating(this, event)">
                  <span class="rating-display">⭐${avgRating}</span>
                </div>
                ${bookmarkMarkup}
              </div>
            </div>
            <div class="title-card-info">
              <h4 class="title-card-title">${upload.title}</h4>
              <p class="title-card-author">by ${upload.author || upload.uploadedBy}</p>
              <p class="title-card-synopsis">${upload.synopsis || 'No synopsis available.'}</p>
              <p class="title-card-genre">Genre: ${upload.genre || 'Unspecified'}</p>
            </div>
            <div class="title-card-rating-expanded" data-upload-id="${upload.id}" style="display: none;">
              <div class="stars" data-upload-id="${upload.id}">
                ${[1, 2, 3, 4, 5].map(star => `
                  <span class="star" data-rating="${star}" style="cursor: pointer; color: #aaa;">★</span>
                `).join('')}
              </div>
              <button class="rating-close-btn" onclick="collapseRating(this, event)">✕</button>
            </div>
          </div>
        `;
      })
      .join('');

    if (homeTitlesContainer) {
      homeTitlesContainer.innerHTML = titleHTML || '<p>No published titles yet.</p>';
      attachRatingListeners(homeTitlesContainer);
    }

    if (browseTitlesContainer) {
      browseTitlesContainer.innerHTML = titleHTML || '<p>No bookmarked titles yet.</p>';
      attachRatingListeners(browseTitlesContainer);
    }
  } catch (error) {
    console.error('Error loading titles:', error);
    const homeTitlesContainer = document.getElementById('homeTitlesContainer');
    if (homeTitlesContainer) {
      homeTitlesContainer.innerHTML = '<p style="color: red;">⚠️ Cannot connect to server. Is it running on localhost:3000?</p>';
    }
  }
}

// ============================================
// PENDING SUBMISSIONS (Users)
// ============================================

async function loadPendingUploads() {
  if (!authState.isLoggedIn || !authState.currentUser) {
    alert('Please log in to view your pending submissions.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/uploads?status=pending&userId=${authState.currentUser.id}`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });
    const uploads = await response.json();

    const pendingContainer = document.getElementById('pendingTitlesContainer');
    if (!pendingContainer) return;

    if (uploads.length === 0) {
      pendingContainer.innerHTML = '<p>No pending submissions. Upload a new title to get started!</p>';
      return;
    }

    const titleHTML = uploads
      .map(upload => `
        <div class="title-card" data-upload-id="${upload.id}">
          <div class="title-card-image-container">
            <img src="${API_URL}/uploads/${upload.id}/image" alt="${upload.title}" class="title-card-image" onerror="this.style.display='none'">
            <div class="title-card-top-stack">
              <span class="status-badge pending-badge">⏳ Pending</span>
              <div style="display: flex; gap: 8px;">
                <button class="title-card-edit-btn" data-upload-id="${upload.id}" onclick="handleEditPending(this, event)" aria-label="Edit submission" title="Edit">✏️</button>
                <button class="title-card-delete-btn" data-upload-id="${upload.id}" onclick="handleDeletePending(this, event)" aria-label="Delete submission" title="Delete">🗑️</button>
              </div>
            </div>
          </div>
          <div class="title-card-info">
            <h4 class="title-card-title">${upload.title}</h4>
            <p class="title-card-author">by ${upload.author || upload.uploadedBy}</p>
            <p class="title-card-synopsis">${upload.synopsis || 'No synopsis available.'}</p>
            <p class="title-card-genre">Genre: ${upload.genre || 'Unspecified'}</p>
          </div>
        </div>
      `)
      .join('');

    pendingContainer.innerHTML = titleHTML;
  } catch (error) {
    console.error('Error loading pending uploads:', error);
    const pendingContainer = document.getElementById('pendingTitlesContainer');
    if (pendingContainer) {
      pendingContainer.innerHTML = '<p style="color: red;">⚠️ Error loading pending submissions.</p>';
    }
  }
}

// ============================================
// PUBLISH QUEUE (Admin)
// ============================================

async function loadPublishQueue() {
  if (!authState.isLoggedIn || !authState.currentUser || !authState.currentUser.isAdmin) {
    alert('Admin access required.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/uploads?status=pending`);
    const uploads = await response.json();

    const publishContainer = document.getElementById('publishQueueContainer');
    if (!publishContainer) return;

    if (uploads.length === 0) {
      publishContainer.innerHTML = '<p>No pending submissions in the queue.</p>';
      return;
    }

    const titleHTML = uploads
      .map(upload => `
        <div class="title-card" data-upload-id="${upload.id}" onclick="openTitleDetailsFromPublishQueue(this, event)">
          <div class="title-card-image-container">
            <img src="${API_URL}/uploads/${upload.id}/image" alt="${upload.title}" class="title-card-image" onerror="this.style.display='none'">
            <div class="title-card-top-stack">
              <span class="status-badge pending-badge">⏳ Pending</span>
              <div style="display: flex; gap: 8px;">
                <button class="title-card-publish-btn" data-upload-id="${upload.id}" onclick="handlePublishListing(this, event)" aria-label="Publish submission" title="Publish">✅</button>
                <button class="title-card-reject-btn" data-upload-id="${upload.id}" onclick="handleRejectListing(this, event)" aria-label="Reject submission" title="Reject">❌</button>
              </div>
            </div>
          </div>
          <div class="title-card-info">
            <h4 class="title-card-title">${upload.title}</h4>
            <p class="title-card-author">by ${upload.author || upload.uploadedBy}</p>
            <p class="title-card-uploader" style="font-size: 12px; color: #888; margin-top: 4px;">Submitted by: ${upload.uploadedBy}</p>
            <p class="title-card-synopsis">${upload.synopsis || 'No synopsis available.'}</p>
            <p class="title-card-genre">Genre: ${upload.genre || 'Unspecified'}</p>
          </div>
        </div>
      `)
      .join('');

    publishContainer.innerHTML = titleHTML;
  } catch (error) {
    console.error('Error loading publish queue:', error);
    const publishContainer = document.getElementById('publishQueueContainer');
    if (publishContainer) {
      publishContainer.innerHTML = '<p style="color: red;">⚠️ Error loading pending submissions.</p>';
    }
  }
}

// ============================================
// PENDING SUBMISSION ACTIONS
// ============================================

async function handlePublishListing(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');

  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Error: ' + (data.error || 'Could not publish'));
      return;
    }

    alert(`"${data.upload.title}" has been published!`);
    loadPublishQueue();
  } catch (error) {
    console.error('Publish error:', error);
    alert('Failed to publish this submission.');
  }
}

async function handleRejectListing(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');
  const card = button.closest('.title-card');
  const title = card.querySelector('.title-card-title').textContent;

  const confirm = window.confirm(`Reject "${title}"? This action cannot be undone.`);
  if (!confirm) return;

  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Error: ' + (data.error || 'Could not reject'));
      return;
    }

    alert(`"${title}" has been rejected and removed.`);
    loadPublishQueue();
  } catch (error) {
    console.error('Reject error:', error);
    alert('Failed to reject this submission.');
  }
}

async function handleEditPending(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');
  const card = button.closest('.title-card');
  
  const title = card.querySelector('.title-card-title').textContent;
  const author = card.querySelector('.title-card-author').textContent.replace('by ', '');
  const synopsis = card.querySelector('.title-card-synopsis').textContent;
  const genre = card.querySelector('.title-card-genre').textContent.replace('Genre: ', '');

  // Pre-fill the form
  document.getElementById('comicTitleInput').value = title;
  document.getElementById('authorNameInput').value = author;
  document.getElementById('synopsisInput').value = synopsis;
  document.getElementById('genreInput').value = genre;

  // Store the upload ID for later reference
  document.getElementById('uploadTitleForm').setAttribute('data-edit-id', uploadId);

  // Scroll to form
  const uploadSection = document.querySelector('.upload-section');
  if (uploadSection) {
    uploadSection.scrollIntoView({ behavior: 'smooth' });
  }

  alert('Form pre-filled with your submission. Update any fields and submit to save changes.');
}

async function handleDeletePending(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');
  const card = button.closest('.title-card');
  const title = card.querySelector('.title-card-title').textContent;

  const confirm = window.confirm(`Delete "${title}"? This action cannot be undone.`);
  if (!confirm) return;

  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Error: ' + (data.error || 'Could not delete'));
      return;
    }

    alert(`"${title}" has been deleted.`);
    loadPendingUploads();
  } catch (error) {
    console.error('Delete error:', error);
    alert('Failed to delete this submission.');
  }
}

async function handlePublishFromDetail(uploadId, title) {
  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Error: ' + (data.error || 'Could not publish'));
      return;
    }

    closeTitleDetailModal();
    alert(`"${title}" has been published!`);
    loadPublishQueue();
  } catch (error) {
    console.error('Publish error:', error);
    alert('Failed to publish this submission.');
  }
}

async function handleRejectFromDetail(uploadId, title) {
  const confirm = window.confirm(`Reject "${title}"? This action cannot be undone.`);
  if (!confirm) return;

  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      alert('Error: ' + (data.error || 'Could not reject'));
      return;
    }

    closeTitleDetailModal();
    alert(`"${title}" has been rejected and removed.`);
    loadPublishQueue();
  } catch (error) {
    console.error('Reject error:', error);
    alert('Failed to reject this submission.');
  }
}

function openDeleteConfirmModal(upload) {
  uploadPendingDelete = upload;
  const modal = document.getElementById('deleteConfirmModal');
  const message = document.getElementById('deleteConfirmMessage');

  if (modal && message) {
    message.textContent = `Delete "${upload.title}" permanently? This action cannot be undone.`;
    modal.classList.add('active');
  }
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) {
    modal.classList.remove('active');
  }
  uploadPendingDelete = null;
}

async function confirmPermanentDelete() {
  if (!uploadPendingDelete) return;

  const uploadId = uploadPendingDelete.id;

  try {
    const response = await fetch(`${API_URL}/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Delete failed');
    }

    closeDeleteConfirmModal();

    if (activeDetailUploadId === uploadId) {
      closeTitleDetailModal();
    }

    alert('Published card deleted permanently.');
    loadTitles();
  } catch (error) {
    console.error('Delete error:', error);
    alert('Unable to delete this card right now.');
  }
}

function confirmDeleteUpload(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');
  const upload = loadedUploads.find(item => item.id === uploadId);

  if (!upload) return;

  openDeleteConfirmModal(upload);
}

function openTitleDetailsFromCard(element, event) {
  const ratingCompact = event && event.target.closest('.title-card-rating-compact');
  const ratingExpanded = event && event.target.closest('.title-card-rating-expanded');
  const commentBtn = event && event.target.closest('.title-card-comment-btn');
  const deleteBtn = event && event.target.closest('.title-card-delete-btn');
  const bookmarkBtn = event && event.target.closest('.title-card-bookmark-btn');
  if (ratingCompact || ratingExpanded || commentBtn || deleteBtn || bookmarkBtn) return;

  const uploadId = element.getAttribute('data-upload-id');
  openTitleDetails(uploadId);
}

function openTitleDetailsFromPublishQueue(element, event) {
  const publishBtn = event && event.target.closest('.title-card-publish-btn');
  const rejectBtn = event && event.target.closest('.title-card-reject-btn');
  if (publishBtn || rejectBtn) return;

  const uploadId = element.getAttribute('data-upload-id');
  openTitleDetailsForPending(uploadId);
}

function openCommentSection(button, event) {
  event.stopPropagation();
  const uploadId = button.getAttribute('data-upload-id');
  openTitleDetails(uploadId, true);
}

function openTitleDetails(uploadId, focusComments = false) {
  const upload = loadedUploads.find(item => item.id === uploadId);
  if (!upload) return;

  activeDetailUploadId = uploadId;
  const modal = document.getElementById('titleDetailModal');
  if (!modal) return;

  const detailImage = document.getElementById('detailTitleImage');
  const detailTitle = document.getElementById('detailTitleName');
  const detailAuthor = document.getElementById('detailTitleAuthor');
  const detailGenre = document.getElementById('detailTitleGenre');
  const detailSynopsis = document.getElementById('detailTitleSynopsis');
  const detailRating = document.getElementById('detailTitleRating');
  const detailDeleteBtn = document.getElementById('detailDeleteBtn');
  const detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
  const commentsSection = document.getElementById('detailCommentsSection');

  if (detailImage) detailImage.src = `${API_URL}/uploads/${upload.id}/image`;
  if (detailTitle) detailTitle.textContent = upload.title || 'Untitled';
  if (detailAuthor) detailAuthor.textContent = `by ${upload.author || upload.uploadedBy || 'Unknown author'}`;
  if (detailGenre) detailGenre.textContent = `Genre: ${upload.genre || 'Unspecified'}`;
  if (detailSynopsis) detailSynopsis.textContent = upload.synopsis || 'No synopsis available for this title yet.';
  if (detailRating) detailRating.textContent = `⭐${upload.avgRating || 0}`;
  if (detailDeleteBtn) {
    const isAdmin = authState.isLoggedIn && authState.currentUser && authState.currentUser.isAdmin;
    detailDeleteBtn.style.display = isAdmin ? 'flex' : 'none';
    detailDeleteBtn.setAttribute('data-upload-id', upload.id);
    detailDeleteBtn.onclick = (event) => {
      event.stopPropagation();
      confirmDeleteUpload(detailDeleteBtn, event);
    };
  }
  if (detailBookmarkBtn) {
    detailBookmarkBtn.setAttribute('data-upload-id', upload.id);
    detailBookmarkBtn.onclick = (event) => {
      event.stopPropagation();
      toggleBookmark(upload.id, event);
    };
    syncDetailBookmarkButton();
  }

  renderComments(uploadId);
  modal.classList.add('active');

  if (focusComments && commentsSection) {
    setTimeout(() => {
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
}

function openTitleDetailsForPending(uploadId) {
  // Fetch from pending uploads to get current data
  fetch(`${API_URL}/uploads?status=pending`)
    .then(res => res.json())
    .then(uploads => {
      const upload = uploads.find(item => item.id === uploadId);
      if (!upload) {
        alert('Submission not found.');
        return;
      }

      activeDetailUploadId = uploadId;
      activeDetailUploadStatus = 'pending';
      const modal = document.getElementById('titleDetailModal');
      if (!modal) return;

      const detailImage = document.getElementById('detailTitleImage');
      const detailTitle = document.getElementById('detailTitleName');
      const detailAuthor = document.getElementById('detailTitleAuthor');
      const detailGenre = document.getElementById('detailTitleGenre');
      const detailSynopsis = document.getElementById('detailTitleSynopsis');
      const detailRating = document.getElementById('detailTitleRating');
      const detailDeleteBtn = document.getElementById('detailDeleteBtn');
      const detailBookmarkBtn = document.getElementById('detailBookmarkBtn');
      const commentsSection = document.getElementById('detailCommentsSection');
      const detailAdminActions = document.getElementById('detailAdminActions');
      const detailPublishBtn = document.getElementById('detailPublishBtn');
      const detailRejectBtn = document.getElementById('detailRejectBtn');

      if (detailImage) detailImage.src = `${API_URL}/uploads/${upload.id}/image`;
      if (detailTitle) detailTitle.textContent = upload.title || 'Untitled';
      if (detailAuthor) detailAuthor.textContent = `by ${upload.author || upload.uploadedBy || 'Unknown author'}`;
      if (detailGenre) detailGenre.textContent = `Genre: ${upload.genre || 'Unspecified'}`;
      if (detailSynopsis) detailSynopsis.textContent = upload.synopsis || 'No synopsis available for this title yet.';
      if (detailRating) detailRating.textContent = `⏳ Pending Review`;
      
      // Hide delete button and bookmark button for pending
      if (detailDeleteBtn) detailDeleteBtn.style.display = 'none';
      if (detailBookmarkBtn) detailBookmarkBtn.style.display = 'none';
      
      // Hide comments section for pending
      if (commentsSection) commentsSection.style.display = 'none';

      // Show admin actions
      if (detailAdminActions) {
        detailAdminActions.style.display = 'flex';
      }

      if (detailPublishBtn) {
        detailPublishBtn.setAttribute('data-upload-id', uploadId);
        detailPublishBtn.onclick = (event) => {
          event.stopPropagation();
          handlePublishFromDetail(uploadId, upload.title);
        };
      }
      
      if (detailRejectBtn) {
        detailRejectBtn.setAttribute('data-upload-id', uploadId);
        detailRejectBtn.onclick = (event) => {
          event.stopPropagation();
          handleRejectFromDetail(uploadId, upload.title);
        };
      }

      modal.classList.add('active');
    })
    .catch(error => {
      console.error('Error loading pending upload:', error);
      alert('Error loading submission details.');
    });
}

function closeTitleDetailModal() {
  const modal = document.getElementById('titleDetailModal');
  if (modal) modal.classList.remove('active');
  
  // Reset state
  activeDetailUploadStatus = null;
  
  // Hide admin actions and show hidden elements again
  const commentsSection = document.getElementById('detailCommentsSection');
  const detailAdminActions = document.getElementById('detailAdminActions');
  
  if (commentsSection) commentsSection.style.display = 'block';
  if (detailAdminActions) detailAdminActions.style.display = 'none';
}

function getCommentsForUpload(uploadId) {
  const raw = localStorage.getItem(`comments_${uploadId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCommentsForUpload(uploadId, comments) {
  localStorage.setItem(`comments_${uploadId}`, JSON.stringify(comments));
}

function renderComments(uploadId) {
  const list = document.getElementById('detailCommentsList');
  if (!list) return;

  const comments = getCommentsForUpload(uploadId);
  if (!comments.length) {
    list.innerHTML = '<p class="empty-comments">No comments yet. Be the first to leave one.</p>';
    return;
  }

  list.innerHTML = comments.map(comment => {
    const profilePic = comment.profilePicture ? `<img src="${comment.profilePicture}" alt="${comment.user}" class="comment-user-pic">` : '<div class="comment-user-pic-empty">👤</div>';
    return `
      <div class="comment-item">
        <div class="comment-user-header">
          ${profilePic}
          <div class="comment-user">${comment.user || 'Guest'}</div>
        </div>
        <div class="comment-text">${comment.text}</div>
      </div>
    `;
  }).join('');
}

async function handleCommentSubmit(event) {
  event.preventDefault();
  if (!activeDetailUploadId) return;

  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if (!text) return;

  const comments = getCommentsForUpload(activeDetailUploadId);
  const userName = authState.currentUser ? (authState.currentUser.name || authState.currentUser.username) : 'Guest';
  let profilePicture = null;

  // Fetch user's profile picture if logged in
  if (authState.isLoggedIn && authState.token) {
    try {
      const response = await fetch(`${API_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });
      if (response.ok) {
        const profile = await response.json();
        profilePicture = profile.profilePicture || null;
      }
    } catch (error) {
      console.error('Error fetching profile for comment:', error);
    }
  }

  comments.unshift({
    user: userName,
    text,
    profilePicture
  });

  saveCommentsForUpload(activeDetailUploadId, comments);
  renderComments(activeDetailUploadId);
  input.value = '';
}

async function expandRating(element, event) {
  event.stopPropagation();
  const uploadId = element.getAttribute('data-upload-id');
  const card = element.closest('.title-card');
  
  card.querySelector('.title-card-rating-compact').style.display = 'none';
  card.querySelector('.title-card-rating-expanded').style.display = 'block';

  // Load user's current rating if logged in
  if (authState.isLoggedIn && authState.token) {
    try {
      const response = await fetch(`${API_URL}/ratings/${uploadId}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      const data = await response.json();
      const userRating = data.rating || 0;

      // Update stars display
      const starsContainer = card.querySelector('.stars');
      starsContainer.querySelectorAll('.star').forEach(star => {
        const starRating = parseInt(star.getAttribute('data-rating'));
        star.style.color = starRating <= userRating ? '#ffd700' : '#aaa';
      });
    } catch (error) {
      console.error('Error loading user rating:', error);
    }
  }
}

function collapseRating(element, event) {
  event.stopPropagation();
  const card = element.closest('.title-card');
  
  card.querySelector('.title-card-rating-compact').style.display = 'block';
  card.querySelector('.title-card-rating-expanded').style.display = 'none';
}

function attachRatingListeners(container) {
  const stars = container.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('click', async (e) => {
      const rating = parseInt(e.target.getAttribute('data-rating'));
      const uploadId = e.target.closest('.stars').getAttribute('data-upload-id');
      
      // Only allow authenticated users to rate
      if (!authState.isLoggedIn || !authState.token) {
        alert('Please sign in to rate titles');
        return;
      }

      try {
        // Save rating to backend
        const response = await fetch(API_URL + '/ratings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.token}`
          },
          body: JSON.stringify({ uploadId, rating })
        });

        if (!response.ok) {
          throw new Error('Failed to save rating');
        }

        const result = await response.json();

        // Update the compact display with new average
        const compactRating = container.querySelector(`[data-upload-id="${uploadId}"] .rating-display`);
        if (compactRating) {
          compactRating.textContent = `⭐${result.avgRating}`;
        }

        // Update star display
        const starsContainer = e.target.closest('.stars');
        starsContainer.querySelectorAll('.star').forEach(s => {
          const starRating = parseInt(s.getAttribute('data-rating'));
          s.style.color = starRating <= rating ? '#ffd700' : '#aaa';
        });
      } catch (error) {
        console.error('Error saving rating:', error);
        alert('Error saving rating');
      }
    });

    // Hover effect
    star.addEventListener('mouseenter', (e) => {
      const rating = parseInt(e.target.getAttribute('data-rating'));
      const starsContainer = e.target.closest('.stars');
      starsContainer.querySelectorAll('.star').forEach(s => {
        const starRating = parseInt(s.getAttribute('data-rating'));
        s.style.color = starRating <= rating ? '#ffd700' : '#aaa';
      });
    });

    star.addEventListener('mouseleave', async (e) => {
      const starsContainer = e.target.closest('.stars');
      const uploadId = starsContainer.getAttribute('data-upload-id');

      // Get user's current rating from backend if logged in
      if (authState.isLoggedIn && authState.token) {
        try {
          const response = await fetch(`${API_URL}/ratings/${uploadId}`, {
            headers: {
              'Authorization': `Bearer ${authState.token}`
            }
          });
          const data = await response.json();
          const savedRating = data.rating || 0;

          starsContainer.querySelectorAll('.star').forEach(s => {
            const starRating = parseInt(s.getAttribute('data-rating'));
            s.style.color = starRating <= savedRating ? '#ffd700' : '#aaa';
          });
        } catch (error) {
          console.error('Error fetching rating:', error);
        }
      } else {
        starsContainer.querySelectorAll('.star').forEach(s => {
          s.style.color = '#aaa';
        });
      }
    });
  });
}

// ============================================
// INITIALIZE APP
// ============================================


// ============================================
// PROFILE MANAGEMENT FUNCTIONS
// ============================================

async function loadProfileDropdown() {
  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${authState.token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load profile');
    }

    const profile = await response.json();

    // Update dropdown display elements
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownProfilePic = document.getElementById('dropdownProfilePic');
    const dropdownProfileEmpty = document.getElementById('dropdownProfileEmpty');
    const navProfileMiniPic = document.getElementById('navProfileMiniPic');
    const navProfileMiniPlaceholder = document.getElementById('navProfileMiniPlaceholder');

    if (dropdownUserName) dropdownUserName.textContent = profile.username || profile.name;
    if (dropdownUserEmail) dropdownUserEmail.textContent = profile.username;

    // Display profile picture if exists
    if (profile.profilePicture) {
      if (dropdownProfilePic) {
        dropdownProfilePic.src = profile.profilePicture;
        dropdownProfilePic.style.display = 'block';
      }
      if (dropdownProfileEmpty) dropdownProfileEmpty.style.display = 'none';
      
      if (navProfileMiniPic) {
        navProfileMiniPic.src = profile.profilePicture;
        navProfileMiniPic.style.display = 'block';
      }
      if (navProfileMiniPlaceholder) navProfileMiniPlaceholder.style.display = 'none';
    } else {
      if (dropdownProfilePic) dropdownProfilePic.style.display = 'none';
      if (dropdownProfileEmpty) dropdownProfileEmpty.style.display = 'block';
      
      if (navProfileMiniPic) navProfileMiniPic.style.display = 'none';
      if (navProfileMiniPlaceholder) navProfileMiniPlaceholder.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading profile dropdown:', error);
  }
}

async function loadUserProfile() {
  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${authState.token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load profile');
    }

    const profile = await response.json();

    // Populate form fields
    const nameInput = document.getElementById('profileNameInput');
    const emailDisplay = document.getElementById('profileEmailDisplay');
    const aboutMeInput = document.getElementById('profileAboutMeInput');
    const profilePictureImg = document.getElementById('profilePictureImg');
    const profilePictureEmpty = document.getElementById('profilePictureEmpty');
    const charCount = document.getElementById('charCount');

    if (nameInput) nameInput.value = profile.name || '';
    if (emailDisplay) emailDisplay.value = profile.username || '';
    if (aboutMeInput) {
      aboutMeInput.value = profile.aboutMe || '';
      if (charCount) charCount.textContent = `${profile.aboutMe?.length || 0}/300`;
    }

    // Display profile picture if exists
    if (profile.profilePicture) {
      if (profilePictureImg) {
        profilePictureImg.src = profile.profilePicture;
        profilePictureImg.style.display = 'block';
      }
      if (profilePictureEmpty) profilePictureEmpty.style.display = 'none';
    } else {
      if (profilePictureImg) profilePictureImg.style.display = 'none';
      if (profilePictureEmpty) profilePictureEmpty.style.display = 'block';
    }

    // Hide message
    const profileMessage = document.getElementById('profileMessage');
    if (profileMessage) profileMessage.style.display = 'none';
  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Error loading profile');
  }
}

async function handleProfilePictureChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be smaller than 5MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;

    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profilePicture: base64Data
        })
      });

      if (!response.ok) {
        throw new Error('Failed to upload picture');
      }

      // Update the display
      const profilePictureImg = document.getElementById('profilePictureImg');
      const profilePictureEmpty = document.getElementById('profilePictureEmpty');
      
      if (profilePictureImg) {
        profilePictureImg.src = base64Data;
        profilePictureImg.style.display = 'block';
      }
      if (profilePictureEmpty) profilePictureEmpty.style.display = 'none';

      showProfileMessage('✅ Profile picture updated!', 'success');
      
      // Reset file input
      document.getElementById('profilePictureInput').value = '';
    } catch (error) {
      console.error('Error uploading picture:', error);
      showProfileMessage('❌ Error uploading picture', 'error');
    }
  };

  reader.readAsDataURL(file);
}

async function handleProfileSave() {
  try {
    const nameInput = document.getElementById('profileNameInput');
    const aboutMeInput = document.getElementById('profileAboutMeInput');

    const name = nameInput.value.trim();
    const aboutMe = aboutMeInput.value.trim();

    // Validation
    if (!name) {
      showProfileMessage('❌ Please enter your name', 'error');
      return;
    }

    if (aboutMe.length > 300) {
      showProfileMessage('❌ About Me must be 300 characters or less', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authState.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        aboutMe
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    const updated = await response.json();
    showProfileMessage('✅ Profile saved successfully!', 'success');

    // Update current user in auth state
    if (authState.currentUser) {
      authState.currentUser.name = updated.name;
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    showProfileMessage('❌ Error saving profile', 'error');
  }
}

function showProfileMessage(message, type) {
  const profileMessage = document.getElementById('profileMessage');
  if (!profileMessage) return;

  profileMessage.textContent = message;
  profileMessage.style.display = 'block';
  
  // Set color based on type
  if (type === 'success') {
    profileMessage.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
    profileMessage.style.borderLeft = '4px solid rgba(34, 197, 94, 0.8)';
    profileMessage.style.color = '#86efac';
  } else if (type === 'error') {
    profileMessage.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    profileMessage.style.borderLeft = '4px solid rgba(239, 68, 68, 0.8)';
    profileMessage.style.color = '#fca5a5';
  }

  // Auto-hide after 4 seconds
  setTimeout(() => {
    profileMessage.style.display = 'none';
  }, 4000);
}

function showNotification(message, type = 'info') {
  const notificationToast = document.getElementById('notificationToast');
  const notificationMessage = document.getElementById('notificationMessage');
  const notificationClose = document.getElementById('notificationClose');
  
  if (!notificationToast) return;
  
  notificationMessage.textContent = message;
  notificationToast.className = `notification-toast notification-${type}`;
  notificationToast.style.display = 'block';
  
  if (notificationClose) {
    notificationClose.addEventListener('click', () => {
      notificationToast.style.display = 'none';
    });
  }
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    notificationToast.style.display = 'none';
  }, 4000);
}

function initializeApp() {
  // Load any existing titles
  loadTitles();

  // Ensure modals are hidden initially
  const authModal = document.getElementById('authModal');
  const verifyModal = document.getElementById('verifyModal');
  
  if (authModal) authModal.classList.remove('active');
  if (verifyModal) verifyModal.classList.remove('active');

  // Hide upload section if not logged in
  if (!authState.isLoggedIn) {
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'none';
    }
  }

  console.log('🚀 Comicary app initialized');
  console.log('📡 API URL: ' + API_URL);
}

