/**
 * Voter Slip Token & Admin Management System
 * Pay-Per-Slip / Credit System: 1 Voter = 1 Token
 * Strict Privacy, Separate /admin and /login Routes, and Clean Layout
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    CURRENT_USER: 'voter_token_current_user_phone',
    CURRENT_ADMIN: 'voter_token_current_admin_phone',
    USERS: 'voter_token_users_db',
    REQUESTS: 'voter_token_requests_db',
    RESET_REQUESTS: 'voter_token_reset_requests_db',
    SAVED_USER_ACCOUNTS: 'voter_token_saved_user_accounts',
    SAVED_ADMIN_ACCOUNTS: 'voter_token_saved_admin_accounts',
    SETTINGS: 'voter_token_settings_db',
    HISTORY: 'voter_token_history_db'
  };

  const DEFAULT_SLAB_CONFIG = {
    price10k: 3000,    // প্রথম ১০,০০০ = ৩,০০০ টাকা (০.৩০/টোকেন)
    price20k: 3500,    // ২০,০০০ = ৩,৫০০ টাকা (১০,০০১-২০,০০০ অতিরিক্ত ০.০৫/টোকেন)
    price30k: 4000,    // ৩০,০০০ = ৪,০০০ টাকা (২০,০০১-৩০,০০০ অতিরিক্ত ০.০৫/টোকেন)
    rate40kPlus: 0.10  // ৪০,০০০+ হলেই ১ থেকে সকল টোকেন ০.১০ পয়সা
  };

  const DEFAULT_SETTINGS = {
    pricingMode: 'slab', // 'slab' | 'flat'
    flatRate: 0.20,      // Flat per-token rate when pricingMode === 'flat'
    tokenRate: 0.10,     // Display/starting rate
    slabConfig: DEFAULT_SLAB_CONFIG,
    bkashNumber: '01700000000',
    nagadNumber: '01700000000',
    welcomeBonus: 0,
    supportPhone: '+8801556452488',
    adminPhone: '01700000000',
    adminPin: '1234'
  };

  const DEFAULT_USERS = {
    '01700000000': {
      phone: '01700000000',
      name: 'সুপার এডমিন (Admin)',
      pin: '1234',
      role: 'admin',
      tokens: Infinity,
      usedTokens: 0,
      createdAt: new Date().toISOString()
    }
  };

  class TokenSystemManager {
    constructor() {
      this.initStorage();
      this.injectStyles();
      this.renderTopBar();
      this.renderModals();
      this.setupEventListeners();
      this.handleRouteCheck();
      this.updateUI();
    }

    // ================= ROUTE DETECTION & DEFAULT REDIRECT =================
    isHttpWeb() {
      return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    ensureDefaultRoute() {
      if (!this.isHttpWeb()) return;
      const rawPath = window.location.pathname || '/';
      const lowerPath = rawPath.toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();

      // Trailing slash cleanup for /admin/ or /login/
      if (lowerPath === '/admin/') {
        window.history.replaceState(null, '', '/admin' + window.location.search + window.location.hash);
        return;
      }
      if (lowerPath === '/login/') {
        window.history.replaceState(null, '', '/login' + window.location.search + window.location.hash);
        return;
      }

      // If hash explicitly points to admin, keep /admin
      if (hash === '#admin' || hash === '#/admin') {
        if (lowerPath !== '/admin') {
          window.history.replaceState(null, '', '/admin');
        }
        return;
      }

      // Clean /index.html to clean root / (Home Page)
      if (lowerPath === '/index.html') {
        window.history.replaceState(null, '', '/' + window.location.search);
      }
    }

    isAdminRoute() {
      const path = (window.location.pathname || '').replace(/\/+$/, '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      return path.endsWith('/admin') || hash === '#admin' || hash === '#/admin';
    }

    isLoginRoute() {
      const path = (window.location.pathname || '').replace(/\/+$/, '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      return path.endsWith('/login') || hash === '#login' || hash === '#/login';
    }

    setAuthLock(isLocked) {
      const userCloseBtn = document.getElementById('userAuthCloseBtn');
      const adminCloseBtn = document.getElementById('adminAuthCloseBtn');
      const userModal = document.getElementById('tokenUserAuthModal');
      const adminModal = document.getElementById('tokenAdminAuthModal');
      const onAdmin = this.isAdminRoute();

      if (isLocked) {
        document.documentElement.classList.add('auth-locked');
        if (document.body) document.body.classList.add('auth-locked');
        // Allow closing user login modal to browse Home Page (main app .container stays hidden!)
        if (userCloseBtn) userCloseBtn.style.display = '';
        if (userModal) userModal.classList.remove('auth-gate-locked');
        // Keep Admin portal strictly locked on /admin
        if (adminCloseBtn) adminCloseBtn.style.display = onAdmin ? 'none' : '';
        if (adminModal) adminModal.classList.toggle('auth-gate-locked', onAdmin);
      } else {
        document.documentElement.classList.remove('auth-locked');
        if (document.body) document.body.classList.remove('auth-locked');
        if (userCloseBtn) userCloseBtn.style.display = '';
        if (adminCloseBtn) adminCloseBtn.style.display = '';
        if (userModal) userModal.classList.remove('auth-gate-locked');
        if (adminModal) adminModal.classList.remove('auth-gate-locked');
      }
    }

    handleRouteCheck() {
      this.ensureDefaultRoute();
      const user = this.getCurrentUser();
      const isAdmin = this.isAdmin();

      // Strict Auth Gate: Nobody can view the main generator app (.container) without logging in
      if (!user) {
        this.setAuthLock(true);
        if (this.isAdminRoute()) {
          this.openAdminLoginModal();
        } else if (this.isLoginRoute()) {
          this.closeModal('tokenAdminAuthModal', true);
          this.renderSavedAccounts();
          this.openModal('tokenUserAuthModal');
        } else {
          // Root / shows the Premium Web Home Page cleanly
          this.closeModal('tokenAdminAuthModal', true);
          this.closeModal('tokenUserAuthModal', true);
        }
        return;
      }

      // Logged in: unlock main generator page and hide Home Page
      this.setAuthLock(false);
      this.closeModal('tokenUserAuthModal', true);
      if (this.isAdminRoute() && !isAdmin) {
        this.openAdminLoginModal();
      } else {
        this.closeModal('tokenAdminAuthModal', true);
      }
    }

    // ================= STORAGE INITIALIZATION =================
    initStorage() {
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.RESET_REQUESTS)) {
        localStorage.setItem(STORAGE_KEYS.RESET_REQUESTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.HISTORY)) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
      }
      // Migrate any legacy admin session out of CURRENT_USER into CURRENT_ADMIN (strict route isolation)
      const legacyPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (legacyPhone) {
        const users = this.getUsers();
        const settings = this.getSettings();
        const legacyUser = users[legacyPhone];
        if (legacyUser && (legacyUser.role === 'admin' || legacyUser.phone === settings.adminPhone)) {
          if (!localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN)) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_ADMIN, legacyPhone);
          }
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
      }
    }

    getResetRequests() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.RESET_REQUESTS) || '[]');
      } catch (e) {
        return [];
      }
    }

    saveResetRequests(list) {
      localStorage.setItem(STORAGE_KEYS.RESET_REQUESTS, JSON.stringify(list));
      this.updateUI();
    }

    // ================= SAVED DEVICE ACCOUNTS =================
    getSavedAccounts(type) {
      const key = type === 'admin' ? STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS : STORAGE_KEYS.SAVED_USER_ACCOUNTS;
      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    saveAccountToDevice(type, phone, pin, name) {
      if (!phone || !pin) return;
      const key = type === 'admin' ? STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS : STORAGE_KEYS.SAVED_USER_ACCOUNTS;
      let list = this.getSavedAccounts(type).filter(a => a.phone !== phone);
      list.unshift({
        phone: phone,
        pin: pin,
        name: name || phone,
        updatedAt: Date.now()
      });
      if (list.length > 5) list = list.slice(0, 5);
      localStorage.setItem(key, JSON.stringify(list));
      this.renderSavedAccounts();
    }

    updateSavedAccountPin(phone, newPin) {
      ['user', 'admin'].forEach(type => {
        const key = type === 'admin' ? STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS : STORAGE_KEYS.SAVED_USER_ACCOUNTS;
        const list = this.getSavedAccounts(type);
        let changed = false;
        list.forEach(a => {
          if (a.phone === phone) {
            a.pin = newPin;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(key, JSON.stringify(list));
        }
      });
      this.renderSavedAccounts();
    }

    removeSavedAccount(type, phone) {
      const key = type === 'admin' ? STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS : STORAGE_KEYS.SAVED_USER_ACCOUNTS;
      const list = this.getSavedAccounts(type).filter(a => a.phone !== phone);
      localStorage.setItem(key, JSON.stringify(list));
      this.renderSavedAccounts();
      this.showToast(`নম্বরটি সেভ তালিকা থেকে মুছে ফেলা হয়েছে (${phone})`, 'ℹ️');
    }

    fillSavedAccount(type, phone) {
      const acc = this.getSavedAccounts(type).find(a => a.phone === phone);
      if (!acc) return;

      const phoneInput = document.getElementById(type === 'admin' ? 'adminLoginPhoneInput' : 'userLoginPhoneInput');
      const pinInput = document.getElementById(type === 'admin' ? 'adminLoginPinInput' : 'userLoginPinInput');

      if (phoneInput && pinInput) {
        phoneInput.value = acc.phone;
        pinInput.value = acc.pin;

        // Visual feedback glow
        [phoneInput, pinInput].forEach(el => {
          el.classList.remove('token-input-filled');
          void el.offsetWidth;
          el.classList.add('token-input-filled');
        });
        this.showToast(`📱 ${acc.phone} এর নম্বর ও পাসওয়ার্ড বসানো হয়েছে!`, '✅');
      }
    }

    renderSavedAccounts() {
      // Render for User Login Panel
      const userBox = document.getElementById('userSavedAccountsBox');
      const userListEl = document.getElementById('userSavedAccountsList');
      if (userBox && userListEl) {
        const userAccounts = this.getSavedAccounts('user');
        if (userAccounts.length === 0) {
          userBox.style.display = 'none';
          userListEl.innerHTML = '';
        } else {
          userBox.style.display = 'block';
          userListEl.innerHTML = userAccounts.map(acc => `
            <div class="token-saved-chip" onclick="TokenSystem.fillSavedAccount('user', '${acc.phone}')" title="ক্লিক করলে মোবাইল ও পাসওয়ার্ড বসে যাবে">
              <span class="saved-icon">📱</span>
              <span class="saved-phone">${acc.phone}</span>
              <span class="saved-remove" title="মুছে ফেলুন" onclick="event.stopPropagation(); TokenSystem.removeSavedAccount('user', '${acc.phone}')">&times;</span>
            </div>
          `).join('');
        }
      }

      // Render for Admin Login Panel (strictly isolated to /admin)
      const adminBox = document.getElementById('adminSavedAccountsBox');
      const adminListEl = document.getElementById('adminSavedAccountsList');
      if (adminBox && adminListEl) {
        const adminAccounts = this.getSavedAccounts('admin');
        if (adminAccounts.length === 0) {
          adminBox.style.display = 'none';
          adminListEl.innerHTML = '';
        } else {
          adminBox.style.display = 'block';
          adminListEl.innerHTML = adminAccounts.map(acc => `
            <div class="token-saved-chip admin" onclick="TokenSystem.fillSavedAccount('admin', '${acc.phone}')" title="ক্লিক করলে এডমিন মোবাইল ও পিন বসে যাবে">
              <span class="saved-icon">👑</span>
              <span class="saved-phone">${acc.phone}</span>
              <span class="saved-remove" title="মুছে ফেলুন" onclick="event.stopPropagation(); TokenSystem.removeSavedAccount('admin', '${acc.phone}')">&times;</span>
            </div>
          `).join('');
        }
      }
    }

    getSettings() {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}') };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }

    saveSettings(settings) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      this.updateUI();
      if (window.VoterHomePage && typeof window.VoterHomePage.syncWithSettings === 'function') {
        window.VoterHomePage.syncWithSettings();
      }
    }

    getUsers() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '{}');
      } catch (e) {
        return { ...DEFAULT_USERS };
      }
    }

    saveUsers(users) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.updateUI();
    }

    getRequests() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
      } catch (e) {
        return [];
      }
    }

    saveRequests(requests) {
      localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
      this.updateUI();
    }

    getHistory() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
      } catch (e) {
        return [];
      }
    }

    addHistoryRecord(record) {
      const history = this.getHistory();
      history.unshift({
        id: 'TX_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        date: new Date().toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' }),
        ...record
      });
      if (history.length > 200) history.pop();
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    }

    getCurrentUser() {
      const users = this.getUsers();
      const settings = this.getSettings();

      if (this.isAdminRoute()) {
        const adminPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
        if (!adminPhone) return null;
        const adminUser = users[adminPhone];
        if (!adminUser) return null;
        if (adminUser.role === 'admin' || adminUser.phone === settings.adminPhone) {
          return adminUser;
        }
        return null;
      }

      const userPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!userPhone) return null;
      const regularUser = users[userPhone];
      if (!regularUser) return null;
      // Never allow an admin session to bleed into /, /login, or other public user tabs
      if (regularUser.role === 'admin' || regularUser.phone === settings.adminPhone) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        return null;
      }
      return regularUser;
    }

    isAdmin() {
      const user = this.getCurrentUser();
      const settings = this.getSettings();
      if (!user) return false;
      return user.role === 'admin' || user.phone === settings.adminPhone;
    }

    getUserTokens() {
      const user = this.getCurrentUser();
      if (!user) return 0;
      if (this.isAdmin()) return Infinity;
      return typeof user.tokens === 'number' ? user.tokens : 0;
    }

    // ================= STYLES =================
    injectStyles() {
      if (document.getElementById('token-system-styles')) return;
      const style = document.createElement('style');
      style.id = 'token-system-styles';
      style.textContent = `
        /* Top Navigation Bar */
        .token-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          margin-bottom: 14px;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(10px);
          font-family: inherit;
          color: #f1f5f9;
          z-index: 100;
          flex-wrap: wrap;
          gap: 10px;
        }
        .token-brand-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .token-brand-logo {
          font-size: 22px;
          background: rgba(56, 189, 248, 0.15);
          padding: 4px 8px;
          border-radius: 8px;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .token-brand-title {
          font-size: 15px;
          font-weight: 700;
          color: #38bdf8;
          letter-spacing: 0.3px;
        }
        .token-brand-badge {
          font-size: 11px;
          background: #0284c7;
          color: #fff;
          padding: 2px 7px;
          border-radius: 999px;
          font-weight: 600;
        }
        .token-user-area {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* Prominent User & Admin Role Badges */
        .token-role-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .token-role-badge.admin {
          background: linear-gradient(135deg, rgba(88, 28, 135, 0.65), rgba(124, 58, 237, 0.45));
          border: 1.5px solid rgba(192, 132, 252, 0.7);
          box-shadow: 0 0 16px rgba(168, 85, 247, 0.35);
        }
        .token-role-badge.admin .role-icon {
          font-size: 22px;
          filter: drop-shadow(0 0 4px rgba(250, 204, 21, 0.6));
        }
        .token-role-badge.admin .role-text .role-title {
          font-size: 13.5px;
          font-weight: 800;
          color: #f3e8ff;
        }
        .token-role-badge.admin .role-text .role-title b {
          color: #fef08a;
          background: rgba(234, 179, 8, 0.25);
          padding: 1px 8px;
          border-radius: 6px;
          border: 1px solid rgba(250, 204, 21, 0.4);
        }
        .token-role-badge.admin .role-text .role-sub {
          font-size: 11px;
          color: #d8b4fe;
          font-weight: 600;
          margin-top: 1px;
        }

        .token-role-badge.user {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9));
          border: 1.5px solid rgba(56, 189, 248, 0.5);
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
        }
        .token-role-badge.user .role-icon {
          font-size: 20px;
        }
        .token-role-badge.user .role-text .role-title {
          font-size: 13px;
          font-weight: 700;
          color: #f0f9ff;
        }
        .token-role-badge.user .role-text .role-title b {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.18);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .token-role-badge.user .role-text .role-sub {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 1px;
        }

        /* Token Balance Pill */
        .token-balance-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.85);
          border: 1.5px solid rgba(245, 158, 11, 0.5);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: #fef08a;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
        }
        .token-balance-pill b {
          font-size: 15px;
          color: #38bdf8;
        }

        /* Buttons */
        .token-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          outline: none;
        }
        .token-btn-primary {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          box-shadow: 0 3px 10px rgba(16, 185, 129, 0.35);
        }
        .token-btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .token-btn-admin {
          background: linear-gradient(135deg, #7c3aed, #9333ea);
          color: white;
          box-shadow: 0 3px 10px rgba(147, 51, 234, 0.35);
        }
        .token-btn-admin:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .token-btn-outline {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid #475569;
          color: #cbd5e1;
        }
        .token-btn-outline:hover {
          background: #334155;
          color: #fff;
        }
        .token-btn-logout {
          background: rgba(239, 68, 68, 0.12) !important;
          border: 1.5px solid rgba(239, 68, 68, 0.5) !important;
          color: #fca5a5 !important;
        }
        .token-btn-logout:hover {
          background: rgba(239, 68, 68, 0.3) !important;
          color: #ffffff !important;
          border-color: #ef4444 !important;
          transform: translateY(-1px);
        }

        .token-badge-count {
          background: #ef4444;
          color: white;
          border-radius: 999px;
          padding: 1px 7px;
          font-size: 11px;
          font-weight: 700;
          animation: tokenPulse 2s infinite;
        }
        @keyframes tokenPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }

        /* Modal Overlay & Card */
        .token-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 15px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .token-modal-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        /* Full-Screen Opaque Auth Gate when Not Logged In */
        html.auth-locked .container,
        body.auth-locked .container {
          display: none !important;
        }
        .token-modal-overlay.auth-gate-locked {
          background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0b1120 75%) !important;
          backdrop-filter: none !important;
        }
        /* Saved Accounts Chips below Login Panel */
        .token-saved-accounts {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px dashed #334155;
          text-align: left;
        }
        .token-saved-title {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .token-saved-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .token-saved-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(56, 189, 248, 0.45);
          color: #e0f2fe;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }
        .token-saved-chip:hover {
          background: rgba(14, 165, 233, 0.22);
          border-color: #38bdf8;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(56, 189, 248, 0.2);
        }
        .token-saved-chip.admin {
          border-color: rgba(192, 132, 252, 0.55);
          color: #f3e8ff;
        }
        .token-saved-chip.admin:hover {
          background: rgba(147, 51, 234, 0.28);
          border-color: #c084fc;
        }
        .token-saved-chip .saved-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 14px;
          line-height: 1;
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.6);
          transition: all 0.15s ease;
        }
        .token-saved-chip .saved-remove:hover {
          color: #ffffff;
          background: #ef4444;
        }
        .token-forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -10px;
          margin-bottom: 14px;
        }
        .token-forgot-link {
          color: #38bdf8;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .token-forgot-link:hover {
          color: #7dd3fc;
          text-decoration: underline;
        }
        @keyframes tokenInputFlash {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65); border-color: #10b981 !important; }
          60% { box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.25); border-color: #34d399 !important; }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .token-input-filled {
          animation: tokenInputFlash 0.9s ease;
        }
        .token-modal-card {
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15);
          width: 100%;
          max-width: 540px !important;
          max-height: 90vh;
          overflow-y: auto;
          color: #f1f5f9;
          padding: 26px !important;
          position: relative;
          transform: translateY(20px);
          transition: transform 0.25s ease;
          box-sizing: border-box !important;
        }
        .token-modal-card.large {
          max-width: 1120px !important;
        }
        .token-modal-overlay.active .token-modal-card {
          transform: translateY(0);
        }
        .token-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .token-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .token-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 24px;
          cursor: pointer;
          padding: 0 6px;
          line-height: 1;
          border-radius: 6px;
        }
        .token-close-btn:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.15);
        }

        /* Nav Tabs in Modals */
        .token-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #334155;
          margin-bottom: 20px;
        }
        .token-tab-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 18px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .token-tab-btn.active {
          color: #38bdf8;
          border-bottom-color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
          border-radius: 6px 6px 0 0;
        }

        /* Form elements - Override style.css 38px width */
        .token-form-group {
          margin-bottom: 18px !important;
          width: 100% !important;
          text-align: left !important;
        }
        .token-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 22px;
          width: 100%;
          box-sizing: border-box;
        }
        .token-settings-grid .token-form-group {
          margin-bottom: 0 !important;
        }
        .token-settings-save-cell {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        @media (max-width: 640px) {
          .token-settings-grid {
            grid-template-columns: 1fr;
          }
        }
        .token-form-label {
          display: block !important;
          font-size: 13.5px !important;
          color: #cbd5e1 !important;
          margin-bottom: 7px !important;
          font-weight: 600 !important;
        }

        .token-modal-card input[type="text"],
        .token-modal-card input[type="password"],
        .token-modal-card input[type="number"],
        .token-form-input {
          width: 100% !important;
          min-width: 100% !important;
          max-width: 100% !important;
          height: 46px !important;
          min-height: 46px !important;
          padding: 10px 16px !important;
          font-size: 15px !important;
          line-height: 1.5 !important;
          background: #1e293b !important;
          border: 1.5px solid #475569 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
          display: block !important;
          margin-top: 2px !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
        }
        .token-modal-card input[type="text"]:focus,
        .token-modal-card input[type="password"]:focus,
        .token-modal-card input[type="number"]:focus,
        .token-form-input:focus {
          border-color: #38bdf8 !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25) !important;
        }

        /* Send Money Card */
        .token-payment-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85));
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .token-number-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #0f172a;
          border: 1px dashed #475569;
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 8px;
        }
        .token-copy-btn {
          background: #0284c7;
          border: none;
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .token-copy-btn:hover {
          background: #0369a1;
        }

        /* Calculator Preset Chips */
        .token-preset-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .token-chip {
          background: #1e293b;
          border: 1px solid #475569;
          color: #e2e8f0;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .token-chip:hover, .token-chip.active {
          background: #0284c7;
          border-color: #38bdf8;
          color: #fff;
          transform: translateY(-1px);
        }

        /* Data Tables */
        .token-table-wrap {
          overflow-x: auto;
          margin-top: 10px;
          border: 1px solid #334155;
          border-radius: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        .token-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }
        .token-table th {
          background: linear-gradient(180deg, #1e293b, #172033);
          color: #94a3b8;
          padding: 12px 12px;
          border-bottom: 1px solid #334155;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.2px;
          white-space: nowrap;
          vertical-align: middle;
        }
        .token-table td {
          padding: 11px 12px;
          border-bottom: 1px solid rgba(51, 65, 85, 0.45);
          color: #e2e8f0;
          vertical-align: middle;
        }
        .token-table tr:hover td {
          background: rgba(30, 41, 59, 0.55);
        }
        .token-col-nowrap {
          white-space: nowrap;
        }
        .token-date-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.28);
          color: #cbd5e1;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .token-action-bar {
          display: inline-flex;
          align-items: center;
          flex-wrap: nowrap;
          gap: 6px;
          white-space: nowrap;
        }
        .token-act-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          height: 30px;
          padding: 0 11px;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.18s ease;
          border: 1px solid transparent;
          outline: none;
        }
        .token-act-btn:hover {
          transform: translateY(-1px);
        }
        .token-act-gift {
          background: linear-gradient(135deg, #059669, #10b981);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        .token-act-gift:hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.45);
        }
        .token-act-pin {
          background: rgba(234, 179, 8, 0.14);
          border-color: rgba(250, 204, 21, 0.4);
          color: #fde047;
        }
        .token-act-pin:hover {
          background: rgba(234, 179, 8, 0.26);
          border-color: #facc15;
        }
        .token-act-role {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(129, 140, 248, 0.4);
          color: #c7d2fe;
        }
        .token-act-role:hover {
          background: rgba(99, 102, 241, 0.28);
          border-color: #818cf8;
          color: #ffffff;
        }
        .token-act-del {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(248, 113, 113, 0.42);
          color: #fca5a5;
        }
        .token-act-del:hover {
          background: rgba(239, 68, 68, 0.3);
          border-color: #ef4444;
          color: #ffffff;
        }
        .token-primary-admin-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(88, 28, 135, 0.45), rgba(124, 58, 237, 0.28));
          border: 1px solid rgba(192, 132, 252, 0.45);
          color: #e9d5ff;
          font-size: 11.5px;
          font-weight: 700;
          white-space: nowrap;
        }
        .token-status-pill {
          padding: 3px 9px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .token-status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
        .token-status-approved { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
        .token-status-rejected { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

        /* Notification Toast */
        .token-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #0f172a;
          border: 1.5px solid #38bdf8;
          color: #f8fafc;
          padding: 14px 22px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          font-size: 14px;
          z-index: 100000;
          display: flex;
          align-items: center;
          gap: 12px;
          transform: translateY(120px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .token-toast.show {
          transform: translateY(0);
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    // ================= RENDER TOP BAR =================
    renderTopBar() {
      if (document.getElementById('tokenTopBar')) return;
      const topBar = document.createElement('div');
      topBar.id = 'tokenTopBar';
      topBar.className = 'token-header-bar';

      topBar.innerHTML = `
        <div class="token-brand-area">
          <span class="token-brand-logo">🗳️</span>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="token-brand-title">ভোটার স্লিপ জেনারেটর</span>
              <span class="token-brand-badge">ওয়েব ভার্সন</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">স্মার্ট পে-পার-ইউজ টোকেন ও সিকিউর সিস্টেম</div>
          </div>
        </div>
        <div id="tokenUserArea" class="token-user-area">
          <!-- Populated by updateUI() -->
        </div>
      `;

      const container = document.querySelector('.container') || document.body;
      if (container.firstChild) {
        container.insertBefore(topBar, container.firstChild);
      } else {
        container.appendChild(topBar);
      }
    }

    // ================= RENDER MODALS =================
    renderModals() {
      if (document.getElementById('tokenModalsContainer')) return;
      const container = document.createElement('div');
      container.id = 'tokenModalsContainer';

      container.innerHTML = `
        <!-- 1. GENERAL USER AUTH MODAL (/login) -->
        <div id="tokenUserAuthModal" class="token-modal-overlay">
          <div class="token-modal-card" style="max-width: 520px !important;">
            <div style="text-align: center; margin-bottom: 14px;">
              <div style="font-size: 30px; margin-bottom: 4px;">🗳️</div>
              <div style="font-size: 16px; font-weight: 800; color: #38bdf8;">ভোটার স্লিপ জেনারেটর</div>
              <div style="font-size: 12px; color: #94a3b8;">ব্যবহার করতে আপনার অ্যাকাউন্টে লগইন করুন</div>
            </div>

            <div class="token-modal-header">
              <div class="token-modal-title"><span>👤</span> একাউন্ট লগইন / রেজিস্ট্রেশন</div>
              <button id="userAuthCloseBtn" class="token-close-btn" onclick="TokenSystem.closeModal('tokenUserAuthModal')">&times;</button>
            </div>
            
            <div class="token-tabs" id="userAuthTabsBar">
              <button class="token-tab-btn active" id="userAuthTabLoginBtn" onclick="TokenSystem.switchUserAuthTab('login')">লগইন</button>
              <button class="token-tab-btn" id="userAuthTabRegisterBtn" onclick="TokenSystem.switchUserAuthTab('register')">নতুন একাউন্ট</button>
            </div>

            <!-- User Login Form -->
            <div id="userLoginForm">
              <div class="token-form-group">
                <label class="token-form-label">মোবাইল নম্বর (Mobile Number):</label>
                <input type="text" id="userLoginPhoneInput" class="token-form-input" placeholder="যেমন: 017XXXXXXXX" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>
              <div class="token-form-group">
                <label class="token-form-label">পিন / পাসওয়ার্ড (৪ ডিজিট):</label>
                <input type="password" id="userLoginPinInput" class="token-form-input" placeholder="আপনার পিন লিখুন" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <div class="token-forgot-row">
                <a href="javascript:void(0)" class="token-forgot-link" onclick="TokenSystem.openForgotPasswordView()">🔑 পাসওয়ার্ড / পিন ভুলে গেছেন?</a>
              </div>

              <button class="token-btn token-btn-primary" style="width: 100%; justify-content: center; padding: 12px; margin-top: 4px; font-size: 15px;" onclick="TokenSystem.handleUserLogin()">
                লগইন করুন
              </button>

              <!-- Saved Mobile Numbers on This Device (Populated only after user logs in) -->
              <div id="userSavedAccountsBox" class="token-saved-accounts" style="display: none;">
                <div class="token-saved-title">📌 সেভ করা মোবাইল নম্বর (ক্লিক করলে নম্বর ও পাসওয়ার্ড বসে যাবে):</div>
                <div id="userSavedAccountsList" class="token-saved-list"></div>
              </div>
            </div>

            <!-- User Register Form -->
            <div id="userRegisterForm" style="display: none;">
              <div class="token-form-group">
                <label class="token-form-label">আপনার পূর্ণ নাম (Full Name):</label>
                <input type="text" id="userRegNameInput" class="token-form-input" placeholder="যেমন: রহিম আহমেদ" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>
              <div class="token-form-group">
                <label class="token-form-label">মোবাইল নম্বর (Mobile Number):</label>
                <input type="text" id="userRegPhoneInput" class="token-form-input" placeholder="যেমন: 017XXXXXXXX" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>
              <div class="token-form-group">
                <label class="token-form-label">পিন / পাসওয়ার্ড (৪ ডিজিট):</label>
                <input type="password" id="userRegPinInput" class="token-form-input" placeholder="যেমন: 1234" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>
              <button class="token-btn token-btn-primary" style="width: 100%; justify-content: center; padding: 12px; margin-top: 10px; font-size: 15px;" onclick="TokenSystem.handleUserRegister()">
                একাউন্ট তৈরি করুন
              </button>
            </div>

            <!-- User Simple 1-Step Automated Password / PIN Reset Form -->
            <div id="userForgotForm" style="display: none;">
              <div style="background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12.5px; color: #bae6fd; line-height: 1.5;">
                🔑 <b>সহজ পাসওয়ার্ড রিসেট:</b> আপনার নিবন্ধিত মোবাইল নম্বর এবং নতুন পিন দিয়ে ক্লিক করলেই সাথে সাথে পিন পরিবর্তন হয়ে যাবে।
              </div>

              <div class="token-form-group">
                <label class="token-form-label">নিবন্ধিত মোবাইল নম্বর:</label>
                <input type="text" id="forgotPhoneInput" class="token-form-input" placeholder="যেমন: 017XXXXXXXX" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <div class="token-form-group">
                <label class="token-form-label">নতুন পিন / পাসওয়ার্ড (কমপক্ষে ৪ ডিজিট):</label>
                <input type="password" id="forgotNewPinInput" class="token-form-input" placeholder="নতুন পিন দিন" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <div class="token-form-group">
                <label class="token-form-label">নতুন পিন পুনরায় লিখুন:</label>
                <input type="password" id="forgotConfirmPinInput" class="token-form-input" placeholder="একই পিন আবার দিন" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <button class="token-btn token-btn-primary" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px;" onclick="TokenSystem.completeAutoPasswordReset()">
                ✅ পিন রিসেট করুন
              </button>

              <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #1e293b; text-align: center;">
                <a href="javascript:void(0)" class="token-forgot-link" onclick="TokenSystem.switchUserAuthTab('login')">← লগইন প্যানেলে ফিরে যান</a>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. SECURE ADMIN LOGIN MODAL (/admin) -->
        <div id="tokenAdminAuthModal" class="token-modal-overlay">
          <div class="token-modal-card" style="max-width: 480px !important; border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 25px rgba(168, 85, 247, 0.25);">
            <div class="token-modal-header" style="border-bottom-color: rgba(168, 85, 247, 0.3);">
              <div class="token-modal-title" style="color: #e9d5ff;"><span>👑</span> এডমিন সিকিউর পোর্টাল</div>
              <button id="adminAuthCloseBtn" class="token-close-btn" onclick="TokenSystem.closeModal('tokenAdminAuthModal')">&times;</button>
            </div>
            
            <div style="background: rgba(88, 28, 135, 0.25); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12.5px; color: #d8b4fe;">
              🔒 এটি শুধুমাত্র সিস্টেম এডমিনের ব্যবহারের জন্য সংরক্ষিত। এডমিন মোবাইল নম্বর এবং সিকিউর পিন দিয়ে প্রবেশ করুন।
            </div>

            <div class="token-form-group">
              <label class="token-form-label">এডমিন মোবাইল নম্বর:</label>
              <input type="text" id="adminLoginPhoneInput" class="token-form-input" placeholder="যেমন: 01700000000" style="width:100%!important; height:46px!important; font-size:15px!important;" />
            </div>

            <div class="token-form-group">
              <label class="token-form-label">এডমিন পিন / পাসওয়ার্ড:</label>
              <input type="password" id="adminLoginPinInput" class="token-form-input" placeholder="এডমিন পিন দিন" style="width:100%!important; height:46px!important; font-size:15px!important;" />
            </div>

            <button class="token-btn token-btn-admin" style="width: 100%; justify-content: center; padding: 12px; margin-top: 8px; font-size: 15px;" onclick="TokenSystem.handleAdminLogin()">
              🔐 এডমিন প্যানেলে প্রবেশ করুন
            </button>

            <!-- Saved Admin Mobile Numbers (Strictly isolated to /admin) -->
            <div id="adminSavedAccountsBox" class="token-saved-accounts" style="display: none;">
              <div class="token-saved-title">📌 সেভ করা এডমিন নম্বর (ক্লিক করে পূরণ করুন):</div>
              <div id="adminSavedAccountsList" class="token-saved-list"></div>
            </div>
          </div>
        </div>

        <!-- 3. RECHARGE / BUY TOKENS MODAL (For User) -->
        <div id="tokenRechargeModal" class="token-modal-overlay">
          <div class="token-modal-card">
            <div class="token-modal-header">
              <div class="token-modal-title"><span>🪙</span> টোকেন কিনুন / রিচার্জ করুন</div>
              <button class="token-close-btn" onclick="TokenSystem.closeModal('tokenRechargeModal')">&times;</button>
            </div>

            <!-- Rate & Calculator Card (Progressive Slab Pricing) -->
            <div style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(30, 41, 59, 0.4)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 13px; font-weight: 700; color: #bae6fd;">১ ভোটার স্লিপ = ১ টোকেন</span>
                <span style="font-size: 11.5px; background: #0369a1; color: #fff; padding: 3px 10px; border-radius: 12px; font-weight: 700;" id="tokenRateDisplay">ধাপভিত্তিক রেট: ৳ 0.10 পয়সা থেকে</span>
              </div>

              <!-- 4-Slab Progressive Rate Strip -->
              <div id="rechargeSlabStrip" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; font-size: 11.5px;"></div>
              
              <div class="token-form-group" style="margin-bottom: 6px;">
                <label class="token-form-label" style="color: #cbd5e1;">কত টোকেন নিতে চান লিখুন:</label>
                <input type="number" id="calcTokenInput" class="token-form-input" value="10000" min="100" step="100" oninput="TokenSystem.updateCalculator()" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <!-- Preset chips -->
              <div class="token-preset-chips">
                <span class="token-chip active" onclick="TokenSystem.selectPreset(10000)">১০,০০০ টোকেন</span>
                <span class="token-chip" onclick="TokenSystem.selectPreset(20000)">২০,০০০ টোকেন</span>
                <span class="token-chip" onclick="TokenSystem.selectPreset(30000)">৩০,০০০ টোকেন</span>
                <span class="token-chip" onclick="TokenSystem.selectPreset(40000)">৪০,০০০ টোকেন</span>
                <span class="token-chip" onclick="TokenSystem.selectPreset(50000)">৫০,০০০ টোকেন</span>
              </div>

              <!-- Step-by-step Progressive Breakdown -->
              <div id="calcBreakdownDisplay" style="margin-top: 10px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: #cbd5e1; line-height: 1.55;"></div>

              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(56, 189, 248, 0.25); display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div>
                  <span style="font-size: 14px; color: #e2e8f0; font-weight: 600;">মোট প্রদেয় টাকা:</span>
                  <div id="calcAvgRateDisplay" style="font-size: 11px; color: #34d399; font-weight: 600;">গড় রেট: ৳ 0.30 পয়সা / টোকেন</div>
                </div>
                <span style="font-size: 19px; font-weight: 800; color: #38bdf8;" id="calcTotalTakaDisplay">৳ 3000.00 টাকা</span>
              </div>
            </div>

            <!-- Send Money Payment Instructions -->
            <div class="token-payment-card">
              <div style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 6px;">📲 পেমেন্ট নির্দেশিকা (Send Money):</div>
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 10px;">
                অনুগ্রহ করে নিচের যেকোনো বিকাশ বা নগদ পারসোনাল নম্বরে মোট টাকা <b>Send Money</b> করুন:
              </div>

              <div class="token-number-box">
                <div>
                  <span style="font-size: 11px; color: #ec4899; font-weight: 700;">🟣 বিকাশ পারসোনাল:</span>
                  <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.5px;" id="dispBkashNum">01700000000</div>
                </div>
                <button class="token-copy-btn" onclick="TokenSystem.copyText('dispBkashNum')">📋 কপি নম্বর</button>
              </div>

              <div class="token-number-box" style="margin-top: 8px;">
                <div>
                  <span style="font-size: 11px; color: #f97316; font-weight: 700;">🟠 নগদ পারসোনাল:</span>
                  <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.5px;" id="dispNagadNum">01700000000</div>
                </div>
                <button class="token-copy-btn" onclick="TokenSystem.copyText('dispNagadNum')">📋 কপি নম্বর</button>
              </div>
            </div>

            <!-- Payment Submission Form -->
            <div style="background: #1e293b; border-radius: 12px; padding: 14px;">
              <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 10px;">পেমেন্ট তথ্য সাবমিট করুন:</div>

              <div class="token-form-group">
                <label class="token-form-label">পেমেন্ট মেথড:</label>
                <div style="display: flex; gap: 14px;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="radio" name="payMethod" value="bkash" checked /> 🟣 বিকাশ (bKash)
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="radio" name="payMethod" value="nagad" /> 🟠 নগদ (Nagad)
                  </label>
                </div>
              </div>

              <div class="token-form-group">
                <label class="token-form-label">যে নম্বর থেকে টাকা পাঠিয়েছেন (Sender Mobile):</label>
                <input type="text" id="reqSenderPhone" class="token-form-input" placeholder="যেমন: 017XXXXXXXX" style="width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <div class="token-form-group">
                <label class="token-form-label">ট্রানজেকশন আইডি (TrxID):</label>
                <input type="text" id="reqTrxId" class="token-form-input" placeholder="যেমন: 9J2K8L3M" style="text-transform: uppercase; width:100%!important; height:46px!important; font-size:15px!important;" />
              </div>

              <button class="token-btn token-btn-primary" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px;" onclick="TokenSystem.submitRechargeRequest()">
                🚀 রিকোয়েস্ট সাবমিট করুন
              </button>
            </div>

            <!-- User's Private Recent Requests (ONLY this user's data) -->
            <div id="userRecentRequestsWrap" style="margin-top: 16px;">
              <div style="font-size: 12.5px; font-weight: 600; color: #94a3b8; margin-bottom: 6px;">আপনার পূর্বের রিকোয়েস্ট হিস্ট্রি:</div>
              <div id="userRecentRequestsList"></div>
            </div>
          </div>
        </div>

        <!-- 4. INSUFFICIENT TOKENS MODAL -->
        <div id="insufficientTokensModal" class="token-modal-overlay">
          <div class="token-modal-card" style="max-width: 480px; text-align: center;">
            <div style="font-size: 44px; margin-bottom: 8px;">⚠️</div>
            <div style="font-size: 18px; font-weight: 700; color: #f87171; margin-bottom: 8px;">অপর্যাপ্ত টোকেন ব্যালেন্স!</div>
            <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-bottom: 16px;" id="insufficientTokensMsg">
              এই এলাকার পিডিএফ তৈরি করতে প্রয়োজন ৩০০ টোকেন, কিন্তু আপনার ব্যালেন্সে রয়েছে ০ টোকেন।
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="token-btn token-btn-primary" style="padding: 10px 20px; font-size: 13.5px;" onclick="TokenSystem.openRechargeFromInsufficient()">
                ➕ এখনই টোকেন কিনুন
              </button>
              <button class="token-btn token-btn-outline" style="padding: 10px 18px;" onclick="TokenSystem.closeModal('insufficientTokensModal')">
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>

        <!-- 5. ADMIN CONTROL DASHBOARD MODAL (Admin Only) -->
        <div id="adminDashboardModal" class="token-modal-overlay">
          <div class="token-modal-card large">
            <div class="token-modal-header">
              <div class="token-modal-title"><span>👑</span> এডমিন কন্ট্রোল ড্যাশবোর্ড (Super Admin)</div>
              <button class="token-close-btn" onclick="TokenSystem.closeModal('adminDashboardModal')">&times;</button>
            </div>

            <div class="token-tabs">
              <button class="token-tab-btn active" id="adminTabReqBtn" onclick="TokenSystem.switchAdminTab('requests')">
                📩 পেন্ডিং পেমেন্ট <span id="adminPendingBadge"></span>
              </button>
              <button class="token-tab-btn" id="adminTabResetsBtn" onclick="TokenSystem.switchAdminTab('resets')">
                🔐 পিন রিসেট <span id="adminResetPendingBadge"></span>
              </button>
              <button class="token-tab-btn" id="adminTabUsersBtn" onclick="TokenSystem.switchAdminTab('users')">
                👥 সকল ইউজার ও উপহার
              </button>
              <button class="token-tab-btn" id="adminTabSettingsBtn" onclick="TokenSystem.switchAdminTab('settings')">
                ⚙️ সিস্টেম ও পেমেন্ট সেটিংস
              </button>
            </div>

            <!-- Tab 1: Requests -->
            <div id="adminTabRequests">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 13px; color: #94a3b8;">ইউজারদের পাঠানো TrxID এবং পেমেন্ট অনুমোদন করুন:</span>
                <button class="token-btn token-btn-outline" style="font-size: 11px; padding: 4px 8px;" onclick="TokenSystem.renderAdminRequestsTable()">🔄 রিফ্রেশ</button>
              </div>
              <div class="token-table-wrap">
                <table class="token-table">
                  <thead>
                    <tr>
                      <th>তারিখ/সময়</th>
                      <th>ইউজার মোবাইল</th>
                      <th>প্রেরক নম্বর</th>
                      <th>মাধ্যম</th>
                      <th>টাকা</th>
                      <th>টোকেন</th>
                      <th>TrxID</th>
                      <th>অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody id="adminRequestsTbody">
                    <!-- Populated by JS -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 2: Password / PIN Reset Requests -->
            <div id="adminTabResets" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 13px; color: #94a3b8;">পাসওয়ার্ড ভুলে যাওয়া ইউজারদের পিন রিসেট রিকোয়েস্ট অনুমোদন করুন:</span>
                <button class="token-btn token-btn-outline" style="font-size: 11px; padding: 4px 8px;" onclick="TokenSystem.renderAdminResetsTable()">🔄 রিফ্রেশ</button>
              </div>
              <div class="token-table-wrap">
                <table class="token-table">
                  <thead>
                    <tr>
                      <th>তারিখ/সময়</th>
                      <th>ইউজার মোবাইল ও নাম</th>
                      <th>নতুন পিন (অনুরোধকৃত)</th>
                      <th>স্ট্যাটাস / অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody id="adminResetsTbody">
                    <!-- Populated by JS -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 3: Users & Manual Gift (Spacious, No Horizontal Scrollbar) -->
            <div id="adminTabUsers" style="display: none;">
              <!-- Full-width spacious notice box -->
              <div style="background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 13.5px; color: #bae6fd; width: 100%; box-sizing: border-box; line-height: 1.5;">
                💡 যেকোনো ইউজারকে সরাসরি টোকেন উপহার বা ফ্রি রিচার্জ দিতে নিচের তালিকায় নামের পাশের <b>🎁 রিচার্জ</b> বাটনে ক্লিক করুন।
              </div>

              <!-- Full-width search bar -->
              <div style="margin-bottom: 14px; width: 100%;">
                <input type="text" id="adminUserSearchInput" class="token-form-input" placeholder="🔍 মোবাইল নম্বর বা নাম দিয়ে ইউজার খুঁজুন..." oninput="TokenSystem.filterUsersTable()" style="max-width: 380px; height: 44px !important;" />
              </div>

              <div class="token-table-wrap">
                <table class="token-table">
                  <thead>
                    <tr>
                      <th>মোবাইল নম্বর</th>
                      <th>নাম</th>
                      <th>রোল</th>
                      <th>বর্তমান টোকেন</th>
                      <th>মোট ব্যবহৃত</th>
                      <th>যোগদান</th>
                      <th>অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody id="adminUsersTbody">
                    <!-- Populated by JS -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 3: Settings (2x2 Grid Layout + 2x2 Progressive Slab Rates) -->
            <div id="adminTabSettings" style="display: none;">
              <div class="token-settings-grid">
                <div class="token-form-group">
                  <label class="token-form-label">🟣 এডমিন পারসোনাল বিকাশ নম্বর (Send Money):</label>
                  <input type="text" id="setBkashInput" class="token-form-input" style="height:44px!important;" />
                </div>

                <div class="token-form-group">
                  <label class="token-form-label">🟠 এডমিন পারসোনাল নগদ নম্বর (Send Money):</label>
                  <input type="text" id="setNagadInput" class="token-form-input" style="height:44px!important;" />
                </div>

                <div class="token-form-group">
                  <label class="token-form-label">📱 এডমিন মোবাইল নম্বর (লগইনের জন্য):</label>
                  <input type="text" id="setAdminPhoneInput" class="token-form-input" style="height:44px!important;" />
                </div>

                <div class="token-form-group">
                  <label class="token-form-label">🔑 এডমিন পিন কোড:</label>
                  <input type="text" id="setAdminPinInput" class="token-form-input" style="height:44px!important;" />
                </div>
              </div>

              <!-- Pricing Mode Selector & Settings -->
              <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed #334155;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
                  <div style="font-size: 13.5px; font-weight: 700; color: #38bdf8;">
                    🪙 প্রাইসিং মোড নির্বাচন করুন:
                  </div>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="display: inline-flex; align-items: center; gap: 6px; background: rgba(14, 165, 233, 0.14); border: 1px solid rgba(56, 189, 248, 0.4); padding: 7px 14px; border-radius: 9px; cursor: pointer; font-size: 13px; font-weight: 700; color: #e0f2fe;">
                      <input type="radio" name="adminPricingMode" id="modePricingSlab" value="slab" checked onchange="TokenSystem.toggleAdminPricingModeUI('slab')" />
                      📊 ধাপভিত্তিক প্রাইসিং (স্ল্যাব)
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(52, 211, 153, 0.4); padding: 7px 14px; border-radius: 9px; cursor: pointer; font-size: 13px; font-weight: 700; color: #d1fae5;">
                      <input type="radio" name="adminPricingMode" id="modePricingFlat" value="flat" onchange="TokenSystem.toggleAdminPricingModeUI('flat')" />
                      🏷️ ফ্ল্যাট প্রাইজ (এক রেট)
                    </label>
                  </div>
                </div>

                <!-- Mode A: Progressive Slab Inputs (2x2 Grid) -->
                <div id="adminSlabSettingsBox">
                  <div class="token-settings-grid">
                    <div class="token-form-group">
                      <label class="token-form-label">প্রথম ১০,০০০ টোকেনের মূল্য (টাকা):</label>
                      <input type="number" id="setSlabPrice10k" class="token-form-input" min="1" step="100" placeholder="3000" style="height:44px!important;" />
                      <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">ডিফল্ট: ৩,০০০ টাকা (প্রতি টোকেন ০.৩০ পয়সা)</span>
                    </div>

                    <div class="token-form-group">
                      <label class="token-form-label">২০,০০০ টোকেনের মোট মূল্য (টাকা):</label>
                      <input type="number" id="setSlabPrice20k" class="token-form-input" min="1" step="100" placeholder="3500" style="height:44px!important;" />
                      <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">ডিফল্ট: ৩,৫০০ টাকা (১০হাজারের পর ০.০৫ পয়সা)</span>
                    </div>

                    <div class="token-form-group">
                      <label class="token-form-label">৩০,০০০ টোকেনের মোট মূল্য (টাকা):</label>
                      <input type="number" id="setSlabPrice30k" class="token-form-input" min="1" step="100" placeholder="4000" style="height:44px!important;" />
                      <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">ডিফল্ট: ৪,০০০ টাকা (২০হাজারের পর ০.০৫ পয়সা)</span>
                    </div>

                    <div class="token-form-group">
                      <label class="token-form-label">৪০,০০০+ হলে ১ থেকে সব টোকেনের রেট (টাকা):</label>
                      <input type="number" id="setSlabRate40k" class="token-form-input" min="0.01" step="0.01" placeholder="0.10" oninput="TokenSystem.formatRateInput(this, false)" onblur="TokenSystem.formatRateInput(this, true)" onchange="TokenSystem.formatRateInput(this, true)" style="height:44px!important;" />
                      <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">ডিফল্ট: 0.10 পয়সা (৪০ হাজারে ৳৪,০০০, ৫০ হাজারে ৳৫,০০০)</span>
                    </div>
                  </div>
                </div>

                <!-- Mode B: Flat Price Box -->
                <div id="adminFlatSettingsBox" style="display: none;">
                  <div class="token-settings-grid">
                    <div class="token-form-group">
                      <label class="token-form-label">🏷️ ফ্ল্যাট রেট — প্রতি টোকেনের মূল্য (টাকায়):</label>
                      <input type="number" id="setFlatRateInput" class="token-form-input" min="0.01" step="0.01" placeholder="0.20" oninput="TokenSystem.formatRateInput(this, false)" onblur="TokenSystem.formatRateInput(this, true)" onchange="TokenSystem.formatRateInput(this, true)" style="height:44px!important;" />
                      <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">যেমন: 0.20 পয়সা (যত ভোটারই হোক একই রেটে হিসাব হবে)</span>
                    </div>
                    <div style="display: flex; align-items: center; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: #a7f3d0; line-height: 1.55;">
                      💡 ফ্ল্যাট প্রাইজ চালু থাকলে কোনো ধাপ (স্ল্যাব) থাকবে না — ১ টোকেন থেকে যেকোনো সংখ্যক টোকেনের জন্য এই একটি নির্দিষ্ট রেটই প্রযোজ্য হবে।
                    </div>
                  </div>
                </div>

                <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
                  <button class="token-btn token-btn-primary" style="padding: 11px 28px; font-size: 14.5px;" onclick="TokenSystem.saveAdminSettings()">
                    💾 সেটিংস সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. MANUAL GIFT / RECHARGE SUB-MODAL -->
        <div id="manualGiftModal" class="token-modal-overlay">
          <div class="token-modal-card" style="max-width: 440px;">
            <div class="token-modal-header">
              <div class="token-modal-title"><span>🎁</span> টোকেন উপহার বা ফ্রি রিচার্জ</div>
              <button class="token-close-btn" onclick="TokenSystem.closeModal('manualGiftModal')">&times;</button>
            </div>
            
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 14px; font-size: 13.5px; line-height: 1.6;">
              <div>ইউজার: <b id="giftTargetName" style="color: #38bdf8;">রহিম আহমেদ</b></div>
              <div>মোবাইল: <b id="giftTargetPhone" style="color: #f1f5f9;">01800000000</b></div>
              <div>বর্তমান টোকেন: <b id="giftTargetTokens" style="color: #fbbf24;">০</b> টি</div>
            </div>

            <div class="token-form-group">
              <label class="token-form-label">কতগুলো টোকেন দিতে চান?</label>
              <input type="number" id="giftTokenAmountInput" class="token-form-input" value="1000" min="1" step="100" style="height:44px!important; font-size:15px!important;" />
            </div>

            <div class="token-form-group">
              <label class="token-form-label">কারণ / নোট (ঐচ্ছিক):</label>
              <input type="text" id="giftNoteInput" class="token-form-input" value="উপহার / বোনাস" style="height:44px!important; font-size:15px!important;" />
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
              <button class="token-btn token-btn-outline" onclick="TokenSystem.closeModal('manualGiftModal')">বাতিল</button>
              <button class="token-btn token-btn-primary" onclick="TokenSystem.confirmManualGift()">✅ রিচার্জ সম্পন্ন করুন</button>
            </div>
          </div>
        </div>

        <!-- 7. ADMIN MANUAL PIN RESET SUB-MODAL -->
        <div id="adminManualResetPinModal" class="token-modal-overlay">
          <div class="token-modal-card" style="max-width: 440px;">
            <div class="token-modal-header">
              <div class="token-modal-title"><span>🔑</span> ইউজারের পিন পরিবর্তন / রিসেট</div>
              <button class="token-close-btn" onclick="TokenSystem.closeModal('adminManualResetPinModal')">&times;</button>
            </div>

            <div style="background: #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 14px; font-size: 13.5px; line-height: 1.6;">
              <div>ইউজার: <b id="resetPinTargetName" style="color: #38bdf8;">-</b></div>
              <div>মোবাইল: <b id="resetPinTargetPhone" style="color: #f1f5f9;">-</b></div>
            </div>

            <div class="token-form-group">
              <label class="token-form-label">নতুন পিন কোড দিন (কমপক্ষে ৪ ডিজিট):</label>
              <input type="text" id="adminNewPinInput" class="token-form-input" placeholder="যেমন: 1234" style="height:44px!important; font-size:15px!important;" />
            </div>

            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
              <button class="token-btn token-btn-outline" onclick="TokenSystem.closeModal('adminManualResetPinModal')">বাতিল</button>
              <button class="token-btn token-btn-primary" onclick="TokenSystem.confirmManualPinReset()">✅ নতুন পিন সেট করুন</button>
            </div>
          </div>
        </div>

        <!-- Notification Toast -->
        <div id="tokenToast" class="token-toast">
          <span id="tokenToastIcon" style="font-size: 18px;">✅</span>
          <span id="tokenToastMsg" style="font-weight: 600;">কার্যক্রম সফল হয়েছে!</span>
        </div>
      `;

      document.body.appendChild(container);
    }

    // ================= EVENT LISTENERS =================
    setupEventListeners() {
      document.querySelectorAll('.token-modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            // On /admin when logged out, keep Admin Portal locked; on Home / /login, user modal can close back to Home Page
            if (modal.id === 'tokenAdminAuthModal' && this.isAdminRoute() && !this.getCurrentUser()) {
              return;
            }
            modal.classList.remove('active');
          }
        });
      });

      // Listen to popstate/hashchange for /admin and /login
      window.addEventListener('popstate', () => this.handleRouteCheck());
      window.addEventListener('hashchange', () => this.handleRouteCheck());
    }

    // ================= UI UPDATER =================
    updateUI() {
      const user = this.getCurrentUser();
      const userArea = document.getElementById('tokenUserArea');
      const settings = this.getSettings();

      this.renderSavedAccounts();
      if (window.VoterHomePage && typeof window.VoterHomePage.syncWithSettings === 'function') {
        window.VoterHomePage.syncWithSettings();
      }

      if (!user) {
        // Strict Lock: Hide main page and keep auth screen open
        this.setAuthLock(true);
        if (userArea) {
          userArea.innerHTML = `
            <div style="font-size: 12.5px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
              <span style="opacity: 0.7;">লগইন করা নেই</span>
            </div>
            <button class="token-btn token-btn-primary" style="padding: 8px 18px; font-size: 13.5px;" onclick="TokenSystem.handleMainLoginClick()">
              👤 লগইন
            </button>
          `;
        }
        return;
      }

      // Logged in: Unlock main page
      this.setAuthLock(false);

      if (!userArea) return;

      const isAdmin = this.isAdmin();
      const pendingPayCount = this.getRequests().filter(r => r.status === 'pending').length;
      const pendingResetCount = this.getResetRequests().filter(r => r.status === 'pending').length;
      const totalPending = pendingPayCount + pendingResetCount;

      if (isAdmin) {
        // Logged In as ADMIN
        userArea.innerHTML = `
          <!-- Prominent Admin Role Badge -->
          <div class="token-role-badge admin" title="আপনি সুপার এডমিন মোডে আছেন">
            <span class="role-icon">👑</span>
            <div class="role-text">
              <div class="role-title">অ্যাকাউন্ট: <b>সুপার এডমিন</b></div>
              <div class="role-sub">আনলিমিটেড ফ্রি মোড (০ খরচ)</div>
            </div>
          </div>

          <!-- Admin Control Dashboard Button -->
          <button class="token-btn token-btn-admin" onclick="TokenSystem.openAdminDashboard()">
            ⚙️ এডমিন ড্যাশবোর্ড ${totalPending > 0 ? `<span class="token-badge-count">${totalPending}</span>` : ''}
          </button>

          <!-- Toggled Logout Button -->
          <button class="token-btn token-btn-logout" onclick="TokenSystem.handleLogout()">
            🚪 লগআউট
          </button>
        `;
      } else {
        // Logged In as GENERAL USER
        userArea.innerHTML = `
          <!-- Prominent User Role Badge -->
          <div class="token-role-badge user" title="সাধারণ ইউজার অ্যাকাউন্ট">
            <span class="role-icon">👤</span>
            <div class="role-text">
              <div class="role-title">অ্যাকাউন্ট: <b>সাধারণ ইউজার</b></div>
              <div class="role-sub">📱 ${user.phone}</div>
            </div>
          </div>

          <!-- Token Balance Badge -->
          <div class="token-balance-pill" title="আপনার বর্তমান টোকেন ব্যালেন্স">
            <span>🪙</span> টোকেন: <b>${user.tokens}</b> টি
          </div>

          <!-- Buy Tokens Button -->
          <button class="token-btn token-btn-primary" onclick="TokenSystem.openRechargeModal()">
            ➕ টোকেন কিনুন
          </button>

          <!-- Toggled Logout Button -->
          <button class="token-btn token-btn-logout" onclick="TokenSystem.handleLogout()">
            🚪 লগআউট
          </button>
        `;
      }

      // Update recharge numbers in modal
      const dispBkash = document.getElementById('dispBkashNum');
      const dispNagad = document.getElementById('dispNagadNum');
      if (dispBkash) dispBkash.textContent = settings.bkashNumber;
      if (dispNagad) dispNagad.textContent = settings.nagadNumber;

      const rateDisp = document.getElementById('tokenRateDisplay');
      if (rateDisp) {
        const mode = this.getPricingMode();
        if (mode === 'flat') {
          rateDisp.textContent = `ফ্ল্যাট প্রাইজ: ${this.formatMoneyWithUnit(this.getFlatRate())} / টোকেন`;
        } else {
          const cfg = this.getSlabConfig();
          rateDisp.textContent = `ধাপভিত্তিক রেট (৪০,০০০+: ${this.formatMoneyWithUnit(cfg.rate40kPlus)} / টোকেন)`;
        }
      }

      this.updateCalculator();
    }

    handleMainLoginClick() {
      this.renderSavedAccounts();
      if (this.isAdminRoute()) {
        this.openAdminLoginModal();
      } else {
        this.openModal('tokenUserAuthModal');
      }
    }

    openAdminLoginModal() {
      this.renderSavedAccounts();
      this.closeModal('tokenUserAuthModal', true);
      this.openModal('tokenAdminAuthModal');
    }

    // ================= TOAST NOTIFICATION =================
    showToast(msg, icon = '✅') {
      const toast = document.getElementById('tokenToast');
      const toastMsg = document.getElementById('tokenToastMsg');
      const toastIcon = document.getElementById('tokenToastIcon');
      if (!toast) return;

      toastMsg.textContent = msg;
      toastIcon.textContent = icon;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }

    // ================= MODAL CONTROL =================
    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('active');
    }

    closeModal(modalId, force = false) {
      if (!force && modalId === 'tokenAdminAuthModal' && this.isAdminRoute() && !this.getCurrentUser()) {
        return; // Keep Admin portal strictly locked on /admin while logged out
      }
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');

      // When closing the user login modal back to the Home Page, keep the URL clean at /
      if (!force && modalId === 'tokenUserAuthModal' && !this.getCurrentUser() && this.isHttpWeb()) {
        if (window.location.pathname !== '/' || window.location.hash) {
          window.history.replaceState(null, '', '/');
        }
      }
    }

    // ================= AUTH METHODS (USER) =================
    switchUserAuthTab(tab) {
      const loginForm = document.getElementById('userLoginForm');
      const regForm = document.getElementById('userRegisterForm');
      const forgotForm = document.getElementById('userForgotForm');
      const tabsBar = document.getElementById('userAuthTabsBar');
      const tabLoginBtn = document.getElementById('userAuthTabLoginBtn');
      const tabRegBtn = document.getElementById('userAuthTabRegisterBtn');

      if (tabsBar) tabsBar.style.display = 'flex';
      if (forgotForm) forgotForm.style.display = 'none';

      if (tab === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLoginBtn.classList.add('active');
        tabRegBtn.classList.remove('active');
        this.renderSavedAccounts();
      } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabLoginBtn.classList.remove('active');
        tabRegBtn.classList.add('active');
      }
    }

    openForgotPasswordView() {
      const loginForm = document.getElementById('userLoginForm');
      const regForm = document.getElementById('userRegisterForm');
      const forgotForm = document.getElementById('userForgotForm');
      const tabsBar = document.getElementById('userAuthTabsBar');

      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'none';
      if (tabsBar) tabsBar.style.display = 'none';
      if (forgotForm) forgotForm.style.display = 'block';

      ['forgotNewPinInput', 'forgotConfirmPinInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      const typedPhone = (document.getElementById('userLoginPhoneInput')?.value || '').trim();
      const forgotPhoneEl = document.getElementById('forgotPhoneInput');
      if (forgotPhoneEl && typedPhone) {
        forgotPhoneEl.value = typedPhone;
      }
    }

    completeAutoPasswordReset() {
      const phone = (document.getElementById('forgotPhoneInput').value || '').trim().replace(/\s+/g, '');
      const newPin = (document.getElementById('forgotNewPinInput').value || '').trim();
      const confirmPin = (document.getElementById('forgotConfirmPinInput').value || '').trim();

      if (!phone || !newPin || !confirmPin) {
        alert('সবগুলো ঘর সঠিকভাবে পূরণ করুন!');
        return;
      }
      if (newPin.length < 4) {
        alert('নতুন পিন কমপক্ষে ৪ ডিজিটের হতে হবে!');
        return;
      }
      if (newPin !== confirmPin) {
        alert('নতুন পিন এবং পুনরায় দেওয়া পিন মেলেনি!');
        return;
      }

      const users = this.getUsers();
      const settings = this.getSettings();

      if (phone === settings.adminPhone || (users[phone] && users[phone].role === 'admin')) {
        alert('এডমিন পিন এখান থেকে পরিবর্তন করা যাবে না। এডমিন সেটিংস ব্যবহার করুন।');
        return;
      }

      const user = users[phone];
      if (!user) {
        alert('এই মোবাইল নম্বরে কোনো নিবন্ধিত একাউন্ট পাওয়া যায়নি!');
        return;
      }

      // Simple 1-step instant automated PIN reset
      users[phone].pin = newPin;
      this.saveUsers(users);
      this.updateSavedAccountPin(phone, newPin);

      // Record automated reset in Admin Audit Log
      const resets = this.getResetRequests();
      resets.unshift({
        id: 'AUTO_RST_' + Date.now(),
        phone: phone,
        userName: user.name || phone,
        newPin: '****',
        status: 'auto_completed',
        createdAt: new Date().toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })
      });
      this.saveResetRequests(resets);

      // Switch directly back to Login form with phone pre-filled
      this.switchUserAuthTab('login');
      const loginPhoneEl = document.getElementById('userLoginPhoneInput');
      const loginPinEl = document.getElementById('userLoginPinInput');
      if (loginPhoneEl) loginPhoneEl.value = phone;
      if (loginPinEl) {
        loginPinEl.value = '';
        loginPinEl.focus();
      }

      this.showToast('✅ পিন সফলভাবে রিসেট হয়েছে! এখন নতুন পিন দিয়ে লগইন করুন।', '🎉');
    }

    handleUserLogin() {
      const phone = (document.getElementById('userLoginPhoneInput').value || '').trim().replace(/\s+/g, '');
      const pin = (document.getElementById('userLoginPinInput').value || '').trim();

      if (!phone || !pin) {
        alert('মোবাইল নম্বর এবং পিন দিন!');
        return;
      }

      const users = this.getUsers();
      const settings = this.getSettings();

      // If admin credentials entered on user modal -> isolate to /admin portal
      if (phone === settings.adminPhone && pin === settings.adminPin) {
        users[phone] = {
          phone: phone,
          name: 'সুপার এডমিন (Admin)',
          pin: pin,
          role: 'admin',
          tokens: Infinity,
          usedTokens: 0,
          createdAt: users[phone] ? users[phone].createdAt : new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_ADMIN, phone);
        this.saveUsers(users);
        this.saveAccountToDevice('admin', phone, pin, 'সুপার এডমিন');
        this.closeModal('tokenUserAuthModal', true);
        if (this.isHttpWeb()) {
          window.location.replace(window.location.origin + '/admin');
        } else {
          window.location.hash = '#/admin';
          this.handleRouteCheck();
          this.updateUI();
        }
        return;
      }

      const user = users[phone];
      if (!user) {
        alert('এই নম্বরে কোনো একাউন্ট পাওয়া যায়নি! অনুগ্রহ করে "নতুন একাউন্ট" ট্যাবে গিয়ে একাউন্ট তৈরি করুন।');
        this.switchUserAuthTab('register');
        return;
      }

      if (user.pin && user.pin !== pin) {
        alert('ভুল পিন দিয়েছেন! সঠিক পিন দিন অথবা "পাসওয়ার্ড / পিন ভুলে গেছেন?" অপশন ব্যবহার করুন।');
        return;
      }

      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, phone);
      this.saveAccountToDevice('user', phone, pin, user.name);
      this.setAuthLock(false);
      this.closeModal('tokenUserAuthModal', true);
      if (this.isHttpWeb() && (window.location.pathname !== '/' || window.location.hash)) {
        window.history.replaceState(null, '', '/');
      }
      this.updateUI();
      this.showToast(`👤 আপনি "সাধারণ ইউজার" হিসেবে সফলভাবে লগইন হয়েছেন! (ব্যালেন্স: ${user.tokens || 0} টোকেন)`, '👤');
    }

    handleUserRegister() {
      const name = (document.getElementById('userRegNameInput').value || '').trim();
      const phone = (document.getElementById('userRegPhoneInput').value || '').trim().replace(/\s+/g, '');
      const pin = (document.getElementById('userRegPinInput').value || '').trim();

      if (!name || !phone || !pin) {
        alert('আপনার পূর্ণ নাম, মোবাইল নম্বর এবং পিন কোড দেওয়া আবশ্যক!');
        return;
      }
      if (pin.length < 4) {
        alert('পিন কোড কমপক্ষে ৪ ডিজিটের হতে হবে!');
        return;
      }

      const users = this.getUsers();
      if (users[phone]) {
        alert('এই নম্বরে ইতিমধ্যে একটি একাউন্ট রয়েছে! অনুগ্রহ করে "লগইন" করুন।');
        this.switchUserAuthTab('login');
        return;
      }

      // Set tokens to 0 (No free offer)
      users[phone] = {
        phone: phone,
        name: name || ('ইউজার ' + phone.substring(phone.length - 4)),
        pin: pin,
        role: 'user',
        tokens: 0,
        usedTokens: 0,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, phone);
      this.saveUsers(users);
      this.saveAccountToDevice('user', phone, pin, users[phone].name);
      this.setAuthLock(false);
      this.closeModal('tokenUserAuthModal', true);
      if (this.isHttpWeb() && (window.location.pathname !== '/' || window.location.hash)) {
        window.history.replaceState(null, '', '/');
      }
      this.updateUI();
      this.showToast('🎉 একাউন্ট তৈরি সফল হয়েছে! কাজ শুরু করতে টোকেন রিচার্জ করুন।', '✅');
    }

    // ================= AUTH METHODS (ADMIN) =================
    handleAdminLogin() {
      const phone = (document.getElementById('adminLoginPhoneInput').value || '').trim().replace(/\s+/g, '');
      const pin = (document.getElementById('adminLoginPinInput').value || '').trim();

      if (!phone || !pin) {
        alert('এডমিন মোবাইল নম্বর এবং পিন প্রদান করুন!');
        return;
      }

      const settings = this.getSettings();
      const users = this.getUsers();

      if (phone === settings.adminPhone && pin === settings.adminPin) {
        users[phone] = {
          phone: phone,
          name: 'সুপার এডমিন (Admin)',
          pin: pin,
          role: 'admin',
          tokens: Infinity,
          usedTokens: 0,
          createdAt: users[phone] ? users[phone].createdAt : new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.CURRENT_ADMIN, phone);
        this.saveUsers(users);
        this.saveAccountToDevice('admin', phone, pin, 'সুপার এডমিন');
        this.setAuthLock(false);
        this.closeModal('tokenAdminAuthModal', true);
        this.updateUI();
        this.showToast('👑 আপনি "সুপার এডমিন" হিসেবে সফলভাবে লগইন হয়েছেন!', '👑');
      } else {
        alert('ভুল এডমিন তথ্য! সঠিক এডমিন মোবাইল নম্বর ও পিন দিন।');
      }
    }

    handleLogout() {
      if (confirm('আপনি কি সত্যিই লগআউট করতে চান?')) {
        const wasAdmin = this.isAdminRoute() || this.isAdmin();
        if (wasAdmin) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
        } else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
        this.closeModal('adminDashboardModal');
        this.closeModal('tokenRechargeModal');
        this.closeModal('manualGiftModal');
        this.closeModal('adminManualResetPinModal');
        this.closeModal('insufficientTokensModal');
        this.setAuthLock(true);
        this.updateUI();
        this.showToast('সফলভাবে লগআউট হয়েছেন।', 'ℹ️');

        // Role-based redirect: Admin -> /admin, Regular User -> /login
        const targetPath = wasAdmin ? '/admin' : '/login';
        if (this.isHttpWeb()) {
          window.location.replace(window.location.origin + targetPath);
        } else {
          window.location.hash = '#' + targetPath;
          this.handleRouteCheck();
        }
      }
    }

    // ================= CALCULATOR & RECHARGE =================
    openRechargeModal() {
      this.updateCalculator();
      this.renderUserRecentRequests();
      this.openModal('tokenRechargeModal');
    }

    openRechargeFromInsufficient() {
      this.closeModal('insufficientTokensModal');
      this.openRechargeModal();
    }

    selectPreset(tokens) {
      document.getElementById('calcTokenInput').value = tokens;
      document.querySelectorAll('.token-preset-chips .token-chip').forEach(c => {
        if (c.textContent.includes(tokens.toLocaleString('bn-BD')) || c.textContent.includes(tokens.toString())) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
      this.updateCalculator();
    }

    // Always keep 2 decimal places (.00 to .99 paisa), e.g., .2 -> 0.20
    formatMoney(val) {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return '0.00';
      return (Math.round(num * 100) / 100).toFixed(2);
    }

    formatMoneyWithUnit(val) {
      const num = Math.round((parseFloat(val) || 0) * 100) / 100;
      const safeNum = num < 0 ? 0 : num;
      const unit = safeNum < 1 ? 'পয়সা' : 'টাকা';
      return `৳ ${safeNum.toFixed(2)} ${unit}`;
    }

    formatRateInput(el, finalize) {
      if (!el) return;
      let raw = String(el.value || '').trim();
      if (!raw) {
        if (finalize) el.value = '0.20';
        return;
      }
      // Restrict to max 2 digits after decimal (.01 to .99) while typing
      if (!finalize) {
        if (raw.includes('.')) {
          const parts = raw.split('.');
          if (parts[1] && parts[1].length > 2) {
            el.value = parts[0] + '.' + parts[1].slice(0, 2);
          }
        }
        return;
      }
      // Finalize on blur/change: always display 2 decimal digits (e.g. .2 -> 0.20, 0.5 -> 0.50)
      let num = parseFloat(raw);
      if (isNaN(num) || num <= 0) num = 0.20;
      num = Math.round(num * 100) / 100;
      if (num < 0.01) num = 0.01;
      el.value = num.toFixed(2);
    }

    getPricingMode() {
      const s = this.getSettings();
      return s.pricingMode === 'flat' ? 'flat' : 'slab';
    }

    getFlatRate() {
      const s = this.getSettings();
      const r = parseFloat(s.flatRate);
      return (!isNaN(r) && r > 0) ? Math.max(0.01, Math.round(r * 100) / 100) : DEFAULT_SETTINGS.flatRate;
    }

    getSlabConfig() {
      const s = this.getSettings();
      const raw = (s && typeof s.slabConfig === 'object' && s.slabConfig) ? s.slabConfig : {};
      const p10 = Math.max(1, Math.round((parseFloat(raw.price10k) || DEFAULT_SLAB_CONFIG.price10k) * 100) / 100);
      const p20 = Math.max(p10, Math.round((parseFloat(raw.price20k) || DEFAULT_SLAB_CONFIG.price20k) * 100) / 100);
      const p30 = Math.max(p20, Math.round((parseFloat(raw.price30k) || DEFAULT_SLAB_CONFIG.price30k) * 100) / 100);
      const r40 = Math.max(0.01, Math.round((parseFloat(raw.rate40kPlus) || DEFAULT_SLAB_CONFIG.rate40kPlus) * 100) / 100);
      return { price10k: p10, price20k: p20, price30k: p30, rate40kPlus: r40 };
    }

    // Continuous Progressive Slab OR Flat Price Calculation (Zero cliff loophole!)
    // Default milestones: 10k = 3000, 20k = 3500, 30k = 4000, 40k+ = ALL tokens from #1 @ 0.10
    calculateProgressivePrice(tokens) {
      const qty = Math.max(0, parseInt(tokens, 10) || 0);
      const mode = this.getPricingMode();

      if (mode === 'flat') {
        const flatRate = this.getFlatRate();
        const totalTaka = Math.round(qty * flatRate * 100) / 100;
        const breakdown = qty > 0 ? [{
          label: `ফ্ল্যাট রেট (${qty.toLocaleString('en-US')} × ${this.formatMoneyWithUnit(flatRate)})`,
          count: qty,
          rate: flatRate,
          subTotal: totalTaka
        }] : [];
        return {
          mode: 'flat',
          tokens: qty,
          totalTaka,
          avgRate: flatRate,
          minRate: flatRate,
          flatRate,
          breakdown
        };
      }

      const cfg = this.getSlabConfig();
      const r1 = cfg.price10k / 10000;
      const r2 = (cfg.price20k - cfg.price10k) / 10000;
      const r3 = (cfg.price30k - cfg.price20k) / 10000;
      const p40Target = Math.round(40000 * cfg.rate40kPlus * 100) / 100;
      const r4Bridge = p40Target > cfg.price30k ? (p40Target - cfg.price30k) / 10000 : 0;

      let totalTaka = 0;
      const breakdown = [];

      if (qty >= 40000) {
        totalTaka = Math.round(qty * cfg.rate40kPlus * 100) / 100;
        breakdown.push({
          label: `৪০,০০০+ স্পেশাল রেট (১ থেকে সকল টোকেন × ${this.formatMoneyWithUnit(cfg.rate40kPlus)})`,
          count: qty,
          rate: cfg.rate40kPlus,
          subTotal: totalTaka
        });
      } else {
        const t1 = Math.min(qty, 10000);
        if (t1 > 0) {
          const sub1 = t1 === 10000 ? cfg.price10k : Math.round(t1 * r1 * 100) / 100;
          totalTaka = Math.round((totalTaka + sub1) * 100) / 100;
          breakdown.push({
            label: `১ – ১০,০০০ (${t1.toLocaleString('en-US')} × ${this.formatMoneyWithUnit(r1)})`,
            count: t1,
            rate: r1,
            subTotal: sub1
          });
        }

        const t2 = Math.min(Math.max(0, qty - 10000), 10000);
        if (t2 > 0) {
          const sub2 = t2 === 10000 ? Math.round((cfg.price20k - cfg.price10k) * 100) / 100 : Math.round(t2 * r2 * 100) / 100;
          totalTaka = Math.round((totalTaka + sub2) * 100) / 100;
          breakdown.push({
            label: `১০,০০১ – ২০,০০০ (${t2.toLocaleString('en-US')} × ${this.formatMoneyWithUnit(r2)})`,
            count: t2,
            rate: r2,
            subTotal: sub2
          });
        }

        const t3 = Math.min(Math.max(0, qty - 20000), 10000);
        if (t3 > 0) {
          const sub3 = t3 === 10000 ? Math.round((cfg.price30k - cfg.price20k) * 100) / 100 : Math.round(t3 * r3 * 100) / 100;
          totalTaka = Math.round((totalTaka + sub3) * 100) / 100;
          breakdown.push({
            label: `২০,০০১ – ৩০,০০০ (${t3.toLocaleString('en-US')} × ${this.formatMoneyWithUnit(r3)})`,
            count: t3,
            rate: r3,
            subTotal: sub3
          });
        }

        const t4 = Math.max(0, qty - 30000);
        if (t4 > 0) {
          const sub4 = Math.round(t4 * r4Bridge * 100) / 100;
          totalTaka = Math.round((totalTaka + sub4) * 100) / 100;
          breakdown.push({
            label: r4Bridge > 0
              ? `৩০,০০১ – ৩৯,৯৯৯ (${t4.toLocaleString('en-US')} × ${this.formatMoneyWithUnit(r4Bridge)})`
              : `৩০,০০১ – ৩৯,৯৯৯ (${t4.toLocaleString('en-US')} বোনাস — ৪০,০০০ পর্যন্ত ফিক্সড)`,
            count: t4,
            rate: r4Bridge,
            subTotal: sub4
          });
        }
      }

      const avgRate = qty > 0 ? Math.round((totalTaka / qty) * 100) / 100 : Math.round(r1 * 100) / 100;
      return {
        mode: 'slab',
        tokens: qty,
        totalTaka,
        avgRate,
        minRate: cfg.rate40kPlus,
        slabConfig: cfg,
        breakdown
      };
    }

    renderRechargeSlabStrip() {
      const strip = document.getElementById('rechargeSlabStrip');
      if (!strip) return;
      const mode = this.getPricingMode();
      if (mode === 'flat') {
        const flatRate = this.getFlatRate();
        strip.style.gridTemplateColumns = '1fr';
        strip.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 7px; padding: 7px 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <span style="color: #d1fae5; font-weight: 700;">🏷️ ফ্ল্যাট প্রাইজ চালু আছে (যেকোনো পরিমাণ টোকেন)</span>
            <b style="color: #34d399; white-space: nowrap;">${this.formatMoneyWithUnit(flatRate)} / টোকেন</b>
          </div>
        `;
        return;
      }

      const cfg = this.getSlabConfig();
      strip.style.gridTemplateColumns = 'repeat(2, 1fr)';
      const items = [
        { label: '১০,০০০ টোকেন', val: this.formatMoneyWithUnit(cfg.price10k) },
        { label: '২০,০০০ টোকেন', val: this.formatMoneyWithUnit(cfg.price20k) },
        { label: '৩০,০০০ টোকেন', val: this.formatMoneyWithUnit(cfg.price30k) },
        { label: '৪০,০০০+ (১ থেকে সব)', val: `${this.formatMoneyWithUnit(cfg.rate40kPlus)} / টোকেন` }
      ];
      strip.innerHTML = items.map(it => `
        <div style="background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 7px; padding: 5px 8px; display: flex; justify-content: space-between; align-items: center; gap: 4px;">
          <span style="color: #94a3b8;">${it.label}</span>
          <b style="color: #34d399; white-space: nowrap;">${it.val}</b>
        </div>
      `).join('');
    }

    updateCalculator() {
      const input = document.getElementById('calcTokenInput');
      const totalDisplay = document.getElementById('calcTotalTakaDisplay');
      const avgDisplay = document.getElementById('calcAvgRateDisplay');
      const breakdownDisplay = document.getElementById('calcBreakdownDisplay');
      if (!input || !totalDisplay) return;

      this.renderRechargeSlabStrip();

      const tokens = Math.max(1, parseInt(input.value, 10) || 0);
      const calc = this.calculateProgressivePrice(tokens);

      totalDisplay.textContent = this.formatMoneyWithUnit(calc.totalTaka);
      if (avgDisplay) {
        if (calc.mode === 'flat') {
          avgDisplay.textContent = `ফ্ল্যাট রেট: ${this.formatMoneyWithUnit(calc.flatRate)} / টোকেন`;
        } else if (tokens >= 40000) {
          avgDisplay.textContent = `৪০,০০০+ স্পেশাল রেট: ${this.formatMoneyWithUnit(calc.slabConfig.rate40kPlus)} / টোকেন (১ থেকে সব)`;
        } else {
          avgDisplay.textContent = `গড় রেট: ${this.formatMoneyWithUnit(calc.avgRate)} / টোকেন (ধাপভিত্তিক হিসাব)`;
        }
      }
      if (breakdownDisplay) {
        breakdownDisplay.innerHTML = calc.breakdown.map(b =>
          `<div style="display:flex; justify-content:space-between; gap:8px;">
            <span>• ${b.label}</span>
            <b style="color:#f8fafc; white-space:nowrap;">${this.formatMoneyWithUnit(b.subTotal)}</b>
          </div>`
        ).join('');
      }
    }

    copyText(elementId) {
      const elem = document.getElementById(elementId);
      if (!elem) return;
      const text = elem.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`নম্বরটি কপি করা হয়েছে: ${text}`, '📋');
      }).catch(() => {
        alert('কপি করা যায়নি, নম্বরটি দেখে লিখুন: ' + text);
      });
    }

    submitRechargeRequest() {
      const user = this.getCurrentUser();
      if (!user) {
        alert('অনুগ্রহ করে প্রথমে লগইন করুন!');
        this.openModal('tokenUserAuthModal');
        return;
      }

      const tokens = Math.max(10, parseInt(document.getElementById('calcTokenInput').value) || 0);
      const senderPhone = (document.getElementById('reqSenderPhone').value || '').trim();
      const trxId = (document.getElementById('reqTrxId').value || '').trim().toUpperCase();
      const method = document.querySelector('input[name="payMethod"]:checked')?.value || 'bkash';

      if (!senderPhone || !trxId) {
        alert('প্রেরক মোবাইল নম্বর এবং ট্রানজেকশন আইডি (TrxID) অবশ্যই দিন!');
        return;
      }

      const requests = this.getRequests();

      // Check duplicate TrxID
      const duplicate = requests.find(r => r.trxId === trxId);
      if (duplicate) {
        alert('এই TrxID দিয়ে ইতিমধ্যে একটি রিকোয়েস্ট জমা দেওয়া হয়েছে!');
        return;
      }

      const calc = this.calculateProgressivePrice(tokens);
      const amount = calc.totalTaka;

      const newReq = {
        id: 'REQ_' + Date.now(),
        userId: user.phone,
        userName: user.name,
        userPhone: user.phone,
        senderPhone: senderPhone,
        method: method,
        amount: amount,
        tokens: tokens,
        trxId: trxId,
        status: 'pending',
        createdAt: new Date().toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' }),
        approvedAt: null
      };

      requests.unshift(newReq);
      this.saveRequests(requests);

      document.getElementById('reqSenderPhone').value = '';
      document.getElementById('reqTrxId').value = '';

      this.renderUserRecentRequests();
      this.showToast('পেমেন্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন শীঘ্রই অনুমোদন করবেন।', '🚀');
    }

    // STRICT PRIVACY: User only sees their OWN requests
    renderUserRecentRequests() {
      const user = this.getCurrentUser();
      const wrap = document.getElementById('userRecentRequestsList');
      if (!wrap || !user) return;

      const myRequests = this.getRequests().filter(r => r.userPhone === user.phone).slice(0, 5);
      if (myRequests.length === 0) {
        wrap.innerHTML = `<div style="font-size: 11.5px; color: #64748b; padding: 4px;">এখনও কোনো রিকোয়েস্ট পাঠানো হয়নি।</div>`;
        return;
      }

      wrap.innerHTML = myRequests.map(r => `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <b>${r.tokens} টোকেন</b> (৳${this.formatMoney(r.amount)}) | TrxID: <code>${r.trxId}</code>
            <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">${r.createdAt} | ${r.method.toUpperCase()}</div>
          </div>
          <span class="token-status-pill token-status-${r.status}">
            ${r.status === 'approved' ? '✅ অনুমোদিত' : (r.status === 'rejected' ? '❌ বাতিল' : '⏳ পেন্ডিং')}
          </span>
        </div>
      `).join('');
    }

    // ================= ADMIN DASHBOARD =================
    openAdminDashboard() {
      if (!this.isAdmin()) {
        alert('⛔ অনুমতি নেই! এটি শুধুমাত্র এডমিনদের জন্য সংরক্ষিত।');
        return;
      }
      this.renderAdminRequestsTable();
      this.renderAdminResetsTable();
      this.renderAdminUsersTable();
      this.loadAdminSettingsInputs();
      this.openModal('adminDashboardModal');
    }

    switchAdminTab(tab) {
      document.getElementById('adminTabRequests').style.display = (tab === 'requests' ? 'block' : 'none');
      document.getElementById('adminTabResets').style.display = (tab === 'resets' ? 'block' : 'none');
      document.getElementById('adminTabUsers').style.display = (tab === 'users' ? 'block' : 'none');
      document.getElementById('adminTabSettings').style.display = (tab === 'settings' ? 'block' : 'none');

      document.getElementById('adminTabReqBtn').classList.toggle('active', tab === 'requests');
      document.getElementById('adminTabResetsBtn').classList.toggle('active', tab === 'resets');
      document.getElementById('adminTabUsersBtn').classList.toggle('active', tab === 'users');
      document.getElementById('adminTabSettingsBtn').classList.toggle('active', tab === 'settings');

      if (tab === 'requests') this.renderAdminRequestsTable();
      if (tab === 'resets') this.renderAdminResetsTable();
      if (tab === 'users') this.renderAdminUsersTable();
      if (tab === 'settings') this.loadAdminSettingsInputs();
    }

    renderAdminResetsTable() {
      const tbody = document.getElementById('adminResetsTbody');
      if (!tbody) return;

      const resets = this.getResetRequests();
      const badge = document.getElementById('adminResetPendingBadge');
      const pendingCount = resets.filter(r => r.status === 'pending').length;
      if (badge) {
        badge.innerHTML = pendingCount > 0 ? `<span class="token-badge-count">${pendingCount}</span>` : '';
      }

      if (resets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">কোনো পাসওয়ার্ড রিসেট রিকোয়েস্ট নেই।</td></tr>`;
        return;
      }

      tbody.innerHTML = resets.map(r => `
        <tr>
          <td style="font-size: 11px;">${r.createdAt}</td>
          <td><b>${r.phone}</b><div style="font-size: 10px; color: #94a3b8;">${r.userName || ''}</div></td>
          <td><code style="background: #1e293b; padding: 3px 8px; border-radius: 4px; color: #fef08a; font-weight: 700;">${r.newPin}</code></td>
          <td>
            ${r.status === 'pending' ? `
              <div style="display: flex; gap: 6px;">
                <button class="token-btn token-btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="TokenSystem.approveResetRequest('${r.id}')">✅ অনুমোদন করুন</button>
                <button class="token-btn token-btn-outline" style="padding: 4px 10px; font-size: 11px; color: #f87171;" onclick="TokenSystem.rejectResetRequest('${r.id}')">❌ বাতিল</button>
              </div>
            ` : `
              <span class="token-status-pill ${r.status === 'auto_completed' || r.status === 'approved' ? 'token-status-approved' : 'token-status-rejected'}">
                ${r.status === 'auto_completed' ? '🤖 অটো-রিসেট সম্পন্ন' : (r.status === 'approved' ? '✅ অনুমোদিত' : '❌ বাতিল')}
              </span>
            `}
          </td>
        </tr>
      `).join('');
    }

    approveResetRequest(reqId) {
      const resets = this.getResetRequests();
      const req = resets.find(r => r.id === reqId);
      if (!req || req.status !== 'pending') return;

      const users = this.getUsers();
      if (!users[req.phone]) {
        alert('ইউজার পাওয়া যায়নি!');
        return;
      }

      users[req.phone].pin = req.newPin;
      req.status = 'approved';
      req.approvedAt = new Date().toISOString();

      this.saveUsers(users);
      this.saveResetRequests(resets);
      this.updateSavedAccountPin(req.phone, req.newPin);

      this.renderAdminResetsTable();
      this.showToast(`✅ ${req.phone} এর নতুন পিন (${req.newPin}) সফলভাবে চালু হয়েছে!`, '🔑');
    }

    rejectResetRequest(reqId) {
      if (!confirm('আপনি কি এই পিন রিসেট রিকোয়েস্টটি বাতিল করতে চান?')) return;
      const resets = this.getResetRequests();
      const req = resets.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'rejected';
      this.saveResetRequests(resets);
      this.renderAdminResetsTable();
      this.showToast('পিন রিসেট রিকোয়েস্ট বাতিল করা হয়েছে।', '❌');
    }

    openManualPinReset(phone) {
      const users = this.getUsers();
      const user = users[phone];
      if (!user) return;

      this.currentResetPinTargetPhone = phone;
      document.getElementById('resetPinTargetName').textContent = user.name || user.phone;
      document.getElementById('resetPinTargetPhone').textContent = user.phone;
      document.getElementById('adminNewPinInput').value = '';
      this.openModal('adminManualResetPinModal');
    }

    confirmManualPinReset() {
      const phone = this.currentResetPinTargetPhone;
      if (!phone) return;

      const newPin = (document.getElementById('adminNewPinInput').value || '').trim();
      if (!newPin || newPin.length < 4) {
        alert('কমপক্ষে ৪ ডিজিটের নতুন পিন দিন!');
        return;
      }

      const users = this.getUsers();
      if (!users[phone]) return;

      users[phone].pin = newPin;
      this.saveUsers(users);
      this.updateSavedAccountPin(phone, newPin);

      this.closeModal('adminManualResetPinModal');
      this.showToast(`🔑 ${phone} এর নতুন পিন (${newPin}) সফলভাবে সেট করা হয়েছে!`, '✅');
    }

    renderAdminRequestsTable() {
      const tbody = document.getElementById('adminRequestsTbody');
      if (!tbody) return;

      const requests = this.getRequests();
      const badge = document.getElementById('adminPendingBadge');
      const pendingCount = requests.filter(r => r.status === 'pending').length;
      if (badge) {
        badge.innerHTML = pendingCount > 0 ? `<span class="token-badge-count">${pendingCount}</span>` : '';
      }

      if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">কোনো পেমেন্ট রিকোয়েস্ট পাওয়া যায়নি।</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(r => `
        <tr>
          <td style="font-size: 11px;">${r.createdAt}</td>
          <td><b>${r.userPhone}</b><div style="font-size: 10px; color: #94a3b8;">${r.userName || ''}</div></td>
          <td>${r.senderPhone}</td>
          <td><span style="text-transform: uppercase; font-weight: 700; color: ${r.method === 'bkash' ? '#ec4899' : '#f97316'};">${r.method}</span></td>
          <td><b>৳${this.formatMoney(r.amount)}</b></td>
          <td><b style="color: #38bdf8;">${r.tokens}</b></td>
          <td><code style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #fef08a;">${r.trxId}</code></td>
          <td>
            ${r.status === 'pending' ? `
              <div style="display: flex; gap: 4px;">
                <button class="token-btn token-btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="TokenSystem.approveRequest('${r.id}')">✅ Approve</button>
                <button class="token-btn token-btn-outline" style="padding: 4px 8px; font-size: 11px; color: #f87171;" onclick="TokenSystem.rejectRequest('${r.id}')">❌ Reject</button>
              </div>
            ` : `
              <span class="token-status-pill ${r.status === 'auto_completed' || r.status === 'approved' ? 'token-status-approved' : 'token-status-rejected'}">
                ${r.status === 'auto_completed' ? '🤖 অটো-রিসেট সম্পন্ন' : (r.status === 'approved' ? '✅ অনুমোদিত' : '❌ বাতিল')}
              </span>
            `}
          </td>
        </tr>
      `).join('');
    }

    approveRequest(reqId) {
      const requests = this.getRequests();
      const req = requests.find(r => r.id === reqId);
      if (!req || req.status !== 'pending') return;

      const users = this.getUsers();
      if (!users[req.userPhone]) {
        users[req.userPhone] = {
          phone: req.userPhone,
          name: req.userName || req.userPhone,
          role: 'user',
          tokens: 0,
          usedTokens: 0,
          createdAt: new Date().toISOString()
        };
      }

      const currentTokens = users[req.userPhone].tokens === Infinity ? 0 : (users[req.userPhone].tokens || 0);
      users[req.userPhone].tokens = currentTokens + req.tokens;
      req.status = 'approved';
      req.approvedAt = new Date().toISOString();

      this.saveUsers(users);
      this.saveRequests(requests);

      this.addHistoryRecord({
        phone: req.userPhone,
        type: 'recharge',
        tokens: req.tokens,
        reason: `পেমেন্ট অনুমোদন (TrxID: ${req.trxId})`
      });

      this.renderAdminRequestsTable();
      this.showToast(`✅ ${req.userPhone} নম্বরে ${req.tokens} টোকেন যোগ হয়েছে!`);
    }

    rejectRequest(reqId) {
      if (!confirm('আপনি কি এই রিকোয়েস্টটি বাতিল করতে চান?')) return;
      const requests = this.getRequests();
      const req = requests.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'rejected';
      this.saveRequests(requests);
      this.renderAdminRequestsTable();
      this.showToast('রিকোয়েস্টটি বাতিল করা হয়েছে।', '❌');
    }

    renderAdminUsersTable() {
      const tbody = document.getElementById('adminUsersTbody');
      if (!tbody) return;

      const users = this.getUsers();
      const settings = this.getSettings();
      const currentPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
      const list = Object.values(users);

      tbody.innerHTML = list.map(u => {
        const isPrimaryAdmin = u.phone === settings.adminPhone || u.phone === currentPhone;
        const isUnlimited = u.role === 'admin' || u.tokens === Infinity;
        const joinDate = (u.createdAt || '').substring(0, 10) || '-';
        return `
        <tr>
          <td class="token-col-nowrap"><b>${u.phone}</b></td>
          <td>${u.name || '-'}</td>
          <td class="token-col-nowrap">
            <span class="token-status-pill ${u.role === 'admin' ? 'token-status-pending' : 'token-status-approved'}">
              ${u.role === 'admin' ? '👑 Admin' : '👤 User'}
            </span>
          </td>
          <td class="token-col-nowrap">
            <b style="color: ${isUnlimited ? '#c084fc' : '#38bdf8'};">
              ${isUnlimited ? 'আনলিমিটেড 👑' : (u.tokens || 0) + ' টি'}
            </b>
          </td>
          <td class="token-col-nowrap">${u.usedTokens || 0} টি</td>
          <td class="token-col-nowrap">
            <span class="token-date-badge">📅 ${joinDate}</span>
          </td>
          <td class="token-col-nowrap">
            <div class="token-action-bar">
              ${!isUnlimited ? `
                <button class="token-act-btn token-act-gift" onclick="TokenSystem.openManualGift('${u.phone}')" title="টোকেন উপহার বা ফ্রি রিচার্জ করুন">
                  🎁 রিচার্জ
                </button>
              ` : ''}
              ${!isPrimaryAdmin ? `
                <button class="token-act-btn token-act-pin" onclick="TokenSystem.openManualPinReset('${u.phone}')" title="ইউজারের পিন রিসেট করুন">
                  🔑 পিন
                </button>
                <button class="token-act-btn token-act-role" onclick="TokenSystem.toggleUserRole('${u.phone}')" title="রোল পরিবর্তন করুন">
                  ${u.role === 'admin' ? '👤 ইউজার' : '👑 এডমিন'}
                </button>
                <button class="token-act-btn token-act-del" onclick="TokenSystem.deleteUser('${u.phone}')" title="ইউজার স্থায়ীভাবে ডিলেট করুন">
                  🗑️ ডিলেট
                </button>
              ` : '<span class="token-primary-admin-tag">🛡️ মূল এডমিন</span>'}
            </div>
          </td>
        </tr>
      `;
      }).join('');
    }

    deleteUser(phone) {
      const settings = this.getSettings();
      const currentPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
      if (phone === settings.adminPhone || phone === currentPhone) {
        alert('মূল এডমিন অ্যাকাউন্ট ডিলেট করা যাবে না!');
        return;
      }

      const users = this.getUsers();
      const target = users[phone];
      if (!target) return;

      if (!confirm(`আপনি কি নিশ্চিতভাবে "${target.name || phone}" (${phone}) ইউজারটিকে স্থায়ীভাবে ডিলেট করতে চান?`)) {
        return;
      }

      delete users[phone];
      if (localStorage.getItem(STORAGE_KEYS.CURRENT_USER) === phone) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      this.saveUsers(users);

      // Remove from saved device accounts (both user & admin lists)
      ['user', 'admin'].forEach(type => {
        const key = type === 'admin' ? STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS : STORAGE_KEYS.SAVED_USER_ACCOUNTS;
        const cleaned = this.getSavedAccounts(type).filter(a => a.phone !== phone);
        localStorage.setItem(key, JSON.stringify(cleaned));
      });

      // Clean up any pending reset requests for deleted user
      const remainingResets = this.getResetRequests().filter(r => r.phone !== phone);
      this.saveResetRequests(remainingResets);

      this.renderAdminUsersTable();
      this.renderAdminResetsTable();
      this.renderSavedAccounts();
      this.showToast(`🗑️ ${phone} ইউজারটি সফলভাবে ডিলেট করা হয়েছে!`, '🗑️');
    }

    filterUsersTable() {
      const q = (document.getElementById('adminUserSearchInput')?.value || '').trim().toLowerCase();
      const rows = document.querySelectorAll('#adminUsersTbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    }

    toggleUserRole(phone) {
      const users = this.getUsers();
      if (!users[phone]) return;
      users[phone].role = users[phone].role === 'admin' ? 'user' : 'admin';
      if (users[phone].role === 'admin') {
        users[phone].tokens = Infinity;
      } else {
        users[phone].tokens = 0;
      }
      this.saveUsers(users);
      this.renderAdminUsersTable();
      this.showToast(`${phone} ইউজারের রোল পরিবর্তন করা হয়েছে!`);
    }

    // ================= MANUAL GIFT / RECHARGE =================
    openManualGift(phone) {
      const users = this.getUsers();
      const user = users[phone];
      if (!user) return;

      this.currentGiftTargetPhone = phone;
      document.getElementById('giftTargetName').textContent = user.name || user.phone;
      document.getElementById('giftTargetPhone').textContent = user.phone;
      document.getElementById('giftTargetTokens').textContent = user.tokens === Infinity ? 'আনলিমিটেড' : (user.tokens || 0);
      document.getElementById('giftTokenAmountInput').value = '1000';

      this.openModal('manualGiftModal');
    }

    confirmManualGift() {
      const phone = this.currentGiftTargetPhone;
      if (!phone) return;

      const tokens = Math.max(1, parseInt(document.getElementById('giftTokenAmountInput').value) || 0);
      const note = (document.getElementById('giftNoteInput').value || 'এডমিন উপহার').trim();

      const users = this.getUsers();
      if (!users[phone]) return;

      if (users[phone].tokens !== Infinity) {
        users[phone].tokens = (users[phone].tokens || 0) + tokens;
      }

      this.saveUsers(users);
      this.addHistoryRecord({
        phone: phone,
        type: 'gift',
        tokens: tokens,
        reason: note
      });

      this.closeModal('manualGiftModal');
      this.renderAdminUsersTable();
      this.showToast(`🎉 ${phone} নম্বরে ${tokens} টোকেন উপহার/রিচার্জ দেওয়া হয়েছে!`, '🎁');
    }

    // ================= ADMIN SETTINGS =================
    toggleAdminPricingModeUI(mode) {
      const isFlat = mode === 'flat';
      const slabBox = document.getElementById('adminSlabSettingsBox');
      const flatBox = document.getElementById('adminFlatSettingsBox');
      const radioSlab = document.getElementById('modePricingSlab');
      const radioFlat = document.getElementById('modePricingFlat');
      if (slabBox) slabBox.style.display = isFlat ? 'none' : 'block';
      if (flatBox) flatBox.style.display = isFlat ? 'block' : 'none';
      if (radioSlab) radioSlab.checked = !isFlat;
      if (radioFlat) radioFlat.checked = isFlat;
    }

    loadAdminSettingsInputs() {
      const s = this.getSettings();
      const mode = this.getPricingMode();
      const cfg = this.getSlabConfig();
      const flatRate = this.getFlatRate();

      document.getElementById('setBkashInput').value = s.bkashNumber;
      document.getElementById('setNagadInput').value = s.nagadNumber;
      document.getElementById('setAdminPhoneInput').value = s.adminPhone;
      document.getElementById('setAdminPinInput').value = s.adminPin;

      const el10 = document.getElementById('setSlabPrice10k');
      const el20 = document.getElementById('setSlabPrice20k');
      const el30 = document.getElementById('setSlabPrice30k');
      const el40 = document.getElementById('setSlabRate40k');
      const elFlat = document.getElementById('setFlatRateInput');

      if (el10) el10.value = cfg.price10k;
      if (el20) el20.value = cfg.price20k;
      if (el30) el30.value = cfg.price30k;
      if (el40) el40.value = this.formatMoney(cfg.rate40kPlus);
      if (elFlat) elFlat.value = this.formatMoney(flatRate);

      this.toggleAdminPricingModeUI(mode);
    }

    saveAdminSettings() {
      const oldSettings = this.getSettings();
      const oldAdminPhone = (oldSettings.adminPhone || '').trim();

      const newAdminPhone = (document.getElementById('setAdminPhoneInput').value || '').trim().replace(/\s+/g, '');
      const newAdminPin = (document.getElementById('setAdminPinInput').value || '').trim();

      if (!newAdminPhone || !newAdminPin) {
        alert('এডমিন মোবাইল নম্বর এবং পিন কোড খালি রাখা যাবে না!');
        return;
      }

      const modeEl = document.querySelector('input[name="adminPricingMode"]:checked');
      const pricingMode = (modeEl && modeEl.value === 'flat') ? 'flat' : 'slab';

      const rawP10 = parseFloat(document.getElementById('setSlabPrice10k')?.value);
      const rawP20 = parseFloat(document.getElementById('setSlabPrice20k')?.value);
      const rawP30 = parseFloat(document.getElementById('setSlabPrice30k')?.value);
      const rawR40 = parseFloat(document.getElementById('setSlabRate40k')?.value);
      const rawFlat = parseFloat(document.getElementById('setFlatRateInput')?.value);

      const price10k = (!isNaN(rawP10) && rawP10 > 0) ? Math.round(rawP10 * 100) / 100 : DEFAULT_SLAB_CONFIG.price10k;
      const price20k = (!isNaN(rawP20) && rawP20 >= price10k) ? Math.round(rawP20 * 100) / 100 : Math.max(price10k, DEFAULT_SLAB_CONFIG.price20k);
      const price30k = (!isNaN(rawP30) && rawP30 >= price20k) ? Math.round(rawP30 * 100) / 100 : Math.max(price20k, DEFAULT_SLAB_CONFIG.price30k);
      const rate40kPlus = (!isNaN(rawR40) && rawR40 > 0) ? Math.max(0.01, Math.round(rawR40 * 100) / 100) : DEFAULT_SLAB_CONFIG.rate40kPlus;
      const flatRate = (!isNaN(rawFlat) && rawFlat > 0) ? Math.max(0.01, Math.round(rawFlat * 100) / 100) : DEFAULT_SETTINGS.flatRate;

      const el10 = document.getElementById('setSlabPrice10k');
      const el20 = document.getElementById('setSlabPrice20k');
      const el30 = document.getElementById('setSlabPrice30k');
      const el40 = document.getElementById('setSlabRate40k');
      const elFlat = document.getElementById('setFlatRateInput');
      if (el10) el10.value = price10k;
      if (el20) el20.value = price20k;
      if (el30) el30.value = price30k;
      if (el40) el40.value = rate40kPlus.toFixed(2);
      if (elFlat) elFlat.value = flatRate.toFixed(2);

      const slabConfig = { price10k, price20k, price30k, rate40kPlus };

      const s = {
        pricingMode: pricingMode,
        flatRate: flatRate,
        tokenRate: pricingMode === 'flat' ? flatRate : rate40kPlus,
        slabConfig: slabConfig,
        bkashNumber: (document.getElementById('setBkashInput').value || '').trim(),
        nagadNumber: (document.getElementById('setNagadInput').value || '').trim(),
        welcomeBonus: 0,
        adminPhone: newAdminPhone,
        adminPin: newAdminPin,
        supportPhone: oldSettings.supportPhone || '+8801556452488'
      };

      // Update the existing Super Admin entry in-place (prevent creating a duplicate user!)
      const users = this.getUsers();
      const currentPhone = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
      const existingAdmin = users[oldAdminPhone] || (currentPhone && users[currentPhone]?.role === 'admin' ? users[currentPhone] : null);

      const updatedAdminRecord = {
        phone: newAdminPhone,
        name: existingAdmin?.name || 'সুপার এডমিন (Admin)',
        pin: newAdminPin,
        role: 'admin',
        tokens: Infinity,
        usedTokens: existingAdmin?.usedTokens || 0,
        createdAt: existingAdmin?.createdAt || new Date().toISOString()
      };

      // If admin phone number changed, delete old admin key so no duplicate stays behind
      if (oldAdminPhone && oldAdminPhone !== newAdminPhone && users[oldAdminPhone] && users[oldAdminPhone].role === 'admin') {
        delete users[oldAdminPhone];
      }
      if (currentPhone && currentPhone !== newAdminPhone && users[currentPhone] && users[currentPhone].role === 'admin') {
        delete users[currentPhone];
      }

      users[newAdminPhone] = updatedAdminRecord;

      // Keep active admin session synced to the updated admin phone
      if (currentPhone === oldAdminPhone || (existingAdmin && currentPhone === existingAdmin.phone)) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_ADMIN, newAdminPhone);
      }

      // Update saved admin login chips on this device (replace old number with new number)
      let savedAdmins = this.getSavedAccounts('admin').filter(a => a.phone !== oldAdminPhone && a.phone !== newAdminPhone);
      savedAdmins.unshift({
        phone: newAdminPhone,
        pin: newAdminPin,
        name: updatedAdminRecord.name,
        updatedAt: Date.now()
      });
      localStorage.setItem(STORAGE_KEYS.SAVED_ADMIN_ACCOUNTS, JSON.stringify(savedAdmins.slice(0, 5)));

      this.saveSettings(s);
      this.saveUsers(users);
      this.renderAdminUsersTable();
      this.renderSavedAccounts();
      this.showToast('সিস্টেম ও এডমিন তথ্য সফলভাবে আপডেট হয়েছে! 💾');
    }

    // ================= PDF GENERATION HOOK =================
    handlePdfGenerationPrecheck(voterCount) {
      const user = this.getCurrentUser();

      if (!user) {
        this.openModal('tokenUserAuthModal');
        this.showToast('পিডিএফ তৈরি করতে অনুগ্রহ করে প্রথমে লগইন করুন!', '⚠️');
        return false;
      }

      // ADMIN BYPASS: Free unlimited, zero deduction
      if (this.isAdmin()) {
        this.showToast(`👑 এডমিন মোড: ${voterCount} জন ভোটারের জন্য কোনো টোকেন কাটা হয়নি (আনলিমিটেড ফ্রি)!`, '👑');
        return true;
      }

      const availableTokens = typeof user.tokens === 'number' ? user.tokens : 0;

      if (availableTokens < voterCount) {
        const msgElem = document.getElementById('insufficientTokensMsg');
        if (msgElem) {
          msgElem.innerHTML = `
            এই এলাকার জন্য প্রয়োজন: <b style="color: #38bdf8;">${voterCount}</b> টি টোকেন<br>
            আপনার বর্তমান ব্যালেন্স: <b style="color: #f87171;">${availableTokens}</b> টি টোকেন<br>
            ঘাটতি: <b style="color: #fbbf24;">${voterCount - availableTokens}</b> টি টোকেন।<br><br>
            পিডিএফ তৈরি করতে অনুগ্রহ করে টোকেন রিচার্জ করুন।
          `;
        }
        this.openModal('insufficientTokensModal');
        return false;
      }

      // Deduct tokens for normal user
      const users = this.getUsers();
      users[user.phone].tokens = availableTokens - voterCount;
      users[user.phone].usedTokens = (users[user.phone].usedTokens || 0) + voterCount;

      this.saveUsers(users);
      this.addHistoryRecord({
        phone: user.phone,
        type: 'deduct',
        tokens: voterCount,
        reason: `পিডিএফ জেনারেট (${voterCount} ভোটার)`
      });

      this.showToast(`🪙 ${voterCount} জন ভোটারের জন্য ${voterCount} টোকেন কাটা হয়েছে। অবশিষ্ট: ${users[user.phone].tokens} টি।`);
      return true;
    }
  }

  // Initialize once on global window
  function initTokenSystemOnce() {
    if (!window.TokenSystem) {
      window.TokenSystem = new TokenSystemManager();
    }
  }

  window.addEventListener('DOMContentLoaded', initTokenSystemOnce);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initTokenSystemOnce();
  }

})();
