/**
 * Premium Web Home Page for Voter Slip Generator
 * - Top Sticky Navbar: নমুনা দেখুন, যোগাযোগ, হোয়াটসঅ্যাপ নম্বর (+8801556452488), লগইন, নতুন একাউন্ট তৈরি
 * - Hero + Dynamic Per-Voter Pricing Spotlight & Live Calculator
 * - Sample Cards Section ("ভোটার স্লিপ তৈরি করুন" / "কম খরচে, অল্প সময় দ্রুত গতিতে")
 *   with exact 9 (3x3 Portrait), 6 (2x3 Landscape), and 4 (2x2 Portrait) mini-A4 cards
 *   opening real masked HD sample images from sample_image/ folder
 * - 4 Core Feature Cards directly below the sample cards
 * - 3-Step Guide & Clean Contact Banner
 */

(function () {
  'use strict';

  const DEFAULT_WHATSAPP_NUMBER = '+8801556452488';

  const SAMPLE_IMAGES = {
    9: {
      src: '/sample_image/sample_9.png?v=3',
      title: '🖼️ প্রতি পেজে ৯টি স্লিপের নমুনা (৩×৩ পোর্ট্রেট A4)',
      subtitle: '১টি পোর্ট্রেট A4 পেজে ৯টি ঝকঝকে ভোটার স্লিপ — আসল নমুনা প্রিভিউ'
    },
    6: {
      src: '/sample_image/sample_6.png?v=3',
      title: '🖼️ প্রতি পেজে ৬টি স্লিপের নমুনা (২×৩ ল্যান্ডস্কেপ A4)',
      subtitle: '১টি ল্যান্ডস্কেপ A4 পেজে ৬টি স্ট্যান্ডার্ড ভোটার স্লিপ — আসল নমুনা প্রিভিউ'
    },
    4: {
      src: '/sample_image/sample_4.png?v=3',
      title: '🖼️ প্রতি পেজে ৪টি স্লিপের নমুনা (২×২ পোর্ট্রেট A4)',
      subtitle: '১টি পোর্ট্রেট A4 পেজে ৪টি বড় ফন্টের স্পষ্ট ভোটার স্লিপ — আসল নমুনা প্রিভিউ'
    }
  };

  class VoterHomePageManager {
    constructor() {
      this.injectStyles();
      this.renderHomePage();
      this.syncWithSettings();
    }

    getSettings() {
      if (window.TokenSystem && typeof window.TokenSystem.getSettings === 'function') {
        return window.TokenSystem.getSettings();
      }
      try {
        const s = JSON.parse(localStorage.getItem('voter_token_settings_db') || '{}');
        return {
          tokenRate: 0.20,
          whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
          ...s
        };
      } catch (e) {
        return { tokenRate: 0.20, whatsappNumber: DEFAULT_WHATSAPP_NUMBER };
      }
    }

    formatMoney(val) {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return '0.00';
      return (Math.round(num * 100) / 100).toFixed(2);
    }

    getMoneyUnit(val) {
      const num = Math.round((parseFloat(val) || 0) * 100) / 100;
      return num < 1 ? 'পয়সা' : 'টাকা';
    }

    injectStyles() {
      if (document.getElementById('voter-home-styles')) return;
      const style = document.createElement('style');
      style.id = 'voter-home-styles';
      style.textContent = `
        /* CRITICAL FIX: Override style.css body { height: 100vh; display: flex; align-items: center; }
           so the Navbar and Top of Home Page are ALWAYS anchored at top: 0 and sticky works natively */
        html.auth-locked {
          scroll-behavior: smooth;
        }
        html.auth-locked,
        body.auth-locked {
          display: block !important;
          height: auto !important;
          min-height: 100vh !important;
          align-items: unset !important;
          justify-content: unset !important;
          overflow: visible !important;
          overflow-x: clip !important;
          background: #060b16 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Show Home Page ONLY when auth-locked (not logged in) */
        #webHomePage {
          display: none;
          min-height: 100vh;
          width: 100%;
          background: #060b16;
          color: #f1f5f9;
          font-family: 'Noto Sans Bengali', 'Hind Siliguri', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow-x: clip;
          box-sizing: border-box;
        }
        html.auth-locked #webHomePage,
        body.auth-locked #webHomePage {
          display: block !important;
        }

        /* Ambient Background Glow Orbs */
        .vh-bg-glow {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .vh-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(110px);
          opacity: 0.26;
        }
        .vh-orb-1 {
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, #0ea5e9, transparent 70%);
          top: -160px;
          left: -120px;
        }
        .vh-orb-2 {
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, #10b981, transparent 70%);
          top: 120px;
          right: -140px;
        }
        .vh-orb-3 {
          width: 460px;
          height: 460px;
          background: radial-gradient(circle, #6366f1, transparent 70%);
          bottom: -140px;
          left: 35%;
        }

        .vh-shell {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 22px;
          box-sizing: border-box;
        }

        /* Sticky Glass Navbar */
        .vh-nav-wrap {
          position: -webkit-sticky;
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 900;
          background: rgba(6, 11, 22, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(56, 189, 248, 0.24);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
        }
        .vh-nav {
          max-width: 1180px;
          margin: 0 auto;
          padding: 13px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .vh-logo {
          display: flex;
          align-items: center;
          gap: 11px;
          text-decoration: none;
          color: #fff;
        }
        .vh-logo-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(16, 185, 129, 0.25));
          border: 1px solid rgba(56, 189, 248, 0.45);
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.25);
        }
        .vh-logo-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.2px;
          background: linear-gradient(90deg, #f8fafc, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .vh-logo-sub {
          font-size: 10.5px;
          color: #94a3b8;
          font-weight: 600;
        }
        .vh-nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .vh-nav-link {
          color: #e2e8f0;
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 700;
          padding: 8px 12px;
          border-radius: 9px;
          transition: all 0.2s ease;
        }
        .vh-nav-link:hover {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.12);
        }
        .vh-wa-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.16);
          border: 1px solid rgba(52, 211, 153, 0.48);
          color: #6ee7b7;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          transition: all 0.2s ease;
        }
        .vh-wa-pill:hover {
          background: rgba(16, 185, 129, 0.3);
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.32);
        }

        /* Buttons */
        .vh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          text-decoration: none;
          transition: all 0.22s ease;
          font-family: inherit;
          white-space: nowrap;
        }
        .vh-btn-ghost {
          background: rgba(30, 41, 59, 0.8);
          color: #f1f5f9;
          border: 1px solid rgba(148, 163, 184, 0.34);
        }
        .vh-btn-ghost:hover {
          background: rgba(51, 65, 85, 0.94);
          border-color: #38bdf8;
          transform: translateY(-1px);
        }
        .vh-btn-primary {
          background: linear-gradient(135deg, #059669 0%, #10b981 55%, #0ea5e9 100%);
          color: #ffffff;
          box-shadow: 0 8px 22px rgba(16, 185, 129, 0.34);
        }
        .vh-btn-primary:hover {
          filter: brightness(1.08);
          transform: translateY(-2px);
          box-shadow: 0 12px 26px rgba(16, 185, 129, 0.48);
        }
        .vh-btn-lg {
          padding: 11px 22px;
          font-size: 14.5px;
          border-radius: 11px;
        }

        /* Hero Section (Compact & Above-the-Fold) */
        .vh-hero {
          padding: 20px 0 26px;
          display: grid;
          grid-template-columns: 1.22fr 0.98fr;
          gap: 30px;
          align-items: center;
        }
        .vh-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(14, 165, 233, 0.14);
          border: 1px solid rgba(56, 189, 248, 0.38);
          color: #7dd3fc;
          font-size: 12.5px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .vh-hero-title {
          font-size: 38px;
          line-height: 1.2;
          font-weight: 900;
          margin: 0 0 12px;
          color: #ffffff;
          letter-spacing: -0.3px;
        }
        .vh-hero-title .vh-gradient-text {
          background: linear-gradient(95deg, #38bdf8 0%, #34d399 55%, #facc15 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .vh-hero-desc {
          font-size: 15px;
          line-height: 1.62;
          color: #cbd5e1;
          margin: 0 0 18px;
          max-width: 580px;
        }
        .vh-hero-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }
        .vh-stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          max-width: 560px;
        }
        .vh-stat-pill {
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 11px;
          padding: 10px 12px;
        }
        .vh-stat-val {
          font-size: 15px;
          font-weight: 800;
          color: #38bdf8;
        }
        .vh-stat-lbl {
          font-size: 11.5px;
          color: #94a3b8;
          margin-top: 2px;
        }

        /* Hero Right: Compact Per-Voter Price Spotlight Card */
        .vh-price-spotlight {
          background: linear-gradient(155deg, rgba(15, 23, 42, 0.94), rgba(17, 24, 39, 0.92));
          border: 1.5px solid rgba(56, 189, 248, 0.45);
          border-radius: 18px;
          padding: 18px 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 36px rgba(14, 165, 233, 0.18);
          position: relative;
          overflow: hidden;
        }
        .vh-price-spotlight::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #0ea5e9, #10b981, #facc15);
        }
        .vh-spot-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(250, 204, 21, 0.15);
          border: 1px solid rgba(250, 204, 21, 0.4);
          color: #fde047;
          font-size: 11.5px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 10px;
        }
        .vh-spot-rate-box {
          background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.18), rgba(15, 23, 42, 0.95));
          border: 1px solid rgba(52, 211, 153, 0.35);
          border-radius: 14px;
          padding: 13px 16px;
          text-align: center;
          margin-bottom: 12px;
        }
        .vh-spot-label {
          font-size: 13px;
          color: #a7f3d0;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .vh-spot-price {
          font-size: 40px;
          font-weight: 900;
          line-height: 1.08;
          background: linear-gradient(180deg, #ffffff 10%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-variant-numeric: tabular-nums;
          margin: 2px 0;
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 7px;
          white-space: nowrap;
        }
        .vh-spot-currency-unit {
          font-size: 20px;
          font-weight: 800;
        }
        .vh-spot-unit {
          font-size: 13px;
          color: #cbd5e1;
          font-weight: 600;
        }
        .vh-mini-calc {
          background: rgba(30, 41, 59, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 12px;
        }
        .vh-mini-calc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          font-size: 12.5px;
          color: #cbd5e1;
          font-weight: 600;
        }
        .vh-slider {
          width: 100% !important;
          accent-color: #10b981;
          cursor: pointer;
          height: 6px;
          margin: 4px 0 10px;
        }
        .vh-calc-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px dashed rgba(148, 163, 184, 0.25);
        }
        .vh-calc-total {
          font-size: 19px;
          font-weight: 800;
          color: #38bdf8;
          font-variant-numeric: tabular-nums;
        }
        .vh-spot-checks {
          list-style: none;
          padding: 0;
          margin: 0 0 12px;
          display: grid;
          gap: 5px;
          font-size: 12.5px;
          color: #cbd5e1;
        }
        .vh-spot-checks li {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Section Common */
        .vh-section {
          padding: 46px 0;
          scroll-margin-top: 82px;
        }
        .vh-section-head {
          text-align: center;
          margin-bottom: 32px;
        }
        .vh-section-title {
          font-size: 32px;
          font-weight: 900;
          color: #f8fafc;
          margin: 0 0 8px;
        }
        .vh-section-sub {
          font-size: 16px;
          color: #7dd3fc;
          font-weight: 600;
          margin: 0;
        }

        /* Sample Pack Cards (9, 6, 4 per page) */
        .vh-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }
        .vh-sample-card {
          background: linear-gradient(165deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.72));
          border: 1.5px solid rgba(148, 163, 184, 0.22);
          border-radius: 20px;
          padding: 26px 22px 24px;
          text-align: center;
          position: relative;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .vh-sample-card:hover {
          border-color: #38bdf8;
          transform: translateY(-6px);
          box-shadow: 0 20px 44px rgba(14, 165, 233, 0.22);
        }
        .vh-sample-card.featured {
          background: linear-gradient(160deg, rgba(14, 165, 233, 0.18), rgba(15, 23, 42, 0.96));
          border: 1.5px solid rgba(56, 189, 248, 0.7);
          box-shadow: 0 18px 46px rgba(14, 165, 233, 0.22);
        }
        .vh-pack-ribbon {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(90deg, #0ea5e9, #10b981);
          color: #fff;
          font-size: 11.5px;
          font-weight: 800;
          padding: 4px 14px;
          border-radius: 999px;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
        }

        /* Exact Proportional Mini A4 Sheet Stage */
        .vh-mini-a4-stage {
          height: 184px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .vh-mini-a4 {
          background: #ffffff;
          border-radius: 6px;
          padding: 7px;
          box-sizing: border-box;
          display: grid;
          gap: 5px;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(56, 189, 248, 0.28);
          transition: transform 0.25s ease;
        }
        .vh-sample-card:hover .vh-mini-a4 {
          transform: scale(1.06);
        }
        /* Portrait A4: 3 cols x 3 rows = EXACTLY 9 slips */
        .vh-mini-a4.grid-9 {
          width: 128px;
          height: 176px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-template-rows: repeat(3, minmax(0, 1fr));
        }
        /* Landscape A4: 3 cols x 2 rows = EXACTLY 6 slips */
        .vh-mini-a4.grid-6 {
          width: 180px;
          height: 128px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(0, 1fr));
        }
        /* Portrait A4: 2 cols x 2 rows = EXACTLY 4 slips */
        .vh-mini-a4.grid-4 {
          width: 128px;
          height: 176px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(0, 1fr));
        }
        .vh-mini-slip {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          background: #f8fafc;
          border: 1px solid #94a3b8;
          border-radius: 3px;
          padding: 3px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: stretch;
        }
        .vh-mini-slip-hdr {
          height: 5px;
          background: linear-gradient(90deg, #0284c7, #0ea5e9);
          border-radius: 1.5px;
          flex-shrink: 0;
        }
        .vh-mini-slip-num {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          text-align: center;
          line-height: 1;
        }
        .grid-4 .vh-mini-slip-num { font-size: 14px; }
        .grid-6 .vh-mini-slip-num { font-size: 13px; }
        .vh-mini-slip-ftr {
          height: 4px;
          background: #10b981;
          border-radius: 1.5px;
          flex-shrink: 0;
        }

        .vh-sample-title {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .vh-sample-badge {
          display: inline-block;
          font-size: 12.5px;
          color: #38bdf8;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .vh-sample-desc {
          font-size: 13.5px;
          color: #94a3b8;
          line-height: 1.55;
          margin: 0 0 18px;
        }

        /* 4 Core Feature Cards */
        .vh-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .vh-feature-card {
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 16px;
          padding: 22px 20px;
          transition: all 0.22s ease;
        }
        .vh-feature-card:hover {
          border-color: rgba(56, 189, 248, 0.5);
          transform: translateY(-4px);
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.4);
        }
        .vh-feature-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          background: rgba(56, 189, 248, 0.14);
          border: 1px solid rgba(56, 189, 248, 0.28);
          margin-bottom: 14px;
        }
        .vh-feature-title {
          font-size: 16.5px;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 8px;
        }
        .vh-feature-desc {
          font-size: 13.5px;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0;
        }

        /* 3 Steps */
        .vh-step-card {
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 16px;
          padding: 24px 20px;
          text-align: center;
        }
        .vh-step-num {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(135deg, #0ea5e9, #10b981);
          box-shadow: 0 0 18px rgba(14, 165, 233, 0.35);
        }

        /* Clean Centered Contact Banner */
        .vh-contact-banner {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.78));
          border: 1px solid rgba(56, 189, 248, 0.38);
          border-radius: 22px;
          padding: 38px 30px;
          text-align: center;
          box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
        }
        .vh-footer {
          border-top: 1px solid rgba(148, 163, 184, 0.14);
          padding: 24px 0 34px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          margin-top: 22px;
        }

        /* Real Sample Image Preview Modal */
        .vh-sample-modal {
          position: fixed;
          inset: 0;
          z-index: 12000;
          background: rgba(6, 11, 22, 0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .vh-sample-modal.active {
          opacity: 1;
          pointer-events: auto;
        }
        .vh-sample-dialog {
          background: #0f172a;
          border: 1px solid rgba(56, 189, 248, 0.45);
          border-radius: 18px;
          width: 96vw;
          max-width: 1080px;
          max-height: 95vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.78);
          color: #f1f5f9;
          box-sizing: border-box;
        }
        .vh-sample-modal-head {
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(15, 23, 42, 0.98);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          border-bottom: 1px solid #334155;
          padding: 16px 22px;
          margin-bottom: 0;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        }
        .vh-sample-head-right {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .vh-sample-switcher {
          display: inline-flex;
          gap: 6px;
          background: #1e293b;
          padding: 4px;
          border-radius: 10px;
        }
        .vh-sw-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .vh-sw-btn.active {
          background: linear-gradient(135deg, #0ea5e9, #10b981);
          color: #ffffff;
        }
        .vh-sample-img-frame {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          background: #0b1120;
          padding: 20px 22px 26px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          box-sizing: border-box;
        }
        .vh-real-a4-sheet {
          background: #ffffff;
          padding: 14px;
          border-radius: 8px;
          box-shadow: 0 18px 46px rgba(0, 0, 0, 0.7);
          display: grid;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        .vh-real-a4-sheet.sheet-9 {
          max-width: 820px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .vh-real-a4-sheet.sheet-6 {
          max-width: 980px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .vh-real-a4-sheet.sheet-4 {
          max-width: 800px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .vh-real-slip-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 2px;
        }

        /* Pricing Cards Section */
        .vh-pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          align-items: stretch;
        }
        .vh-pricing-grid.flat-mode {
          grid-template-columns: minmax(0, 560px);
          justify-content: center;
        }
        .vh-price-card {
          background: linear-gradient(165deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.76));
          border: 1.5px solid rgba(148, 163, 184, 0.22);
          border-radius: 20px;
          padding: 24px 18px 20px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          transition: all 0.25s ease;
        }
        .vh-price-card:hover {
          border-color: #38bdf8;
          transform: translateY(-5px);
          box-shadow: 0 18px 40px rgba(14, 165, 233, 0.2);
        }
        .vh-price-card.featured {
          background: linear-gradient(160deg, rgba(14, 165, 233, 0.18), rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.96));
          border: 1.5px solid rgba(52, 211, 153, 0.75);
          box-shadow: 0 20px 48px rgba(16, 185, 129, 0.24);
        }
        .vh-price-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          color: #7dd3fc;
          background: rgba(14, 165, 233, 0.14);
          border: 1px solid rgba(56, 189, 248, 0.35);
          margin: 0 auto 12px;
        }
        .vh-price-card.featured .vh-price-badge {
          color: #fde047;
          background: rgba(250, 204, 21, 0.16);
          border-color: rgba(250, 204, 21, 0.45);
        }
        .vh-price-card-title {
          font-size: 19px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 10px;
        }
        .vh-price-amount {
          font-size: 28px;
          font-weight: 900;
          line-height: 1.15;
          background: linear-gradient(180deg, #ffffff 15%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-variant-numeric: tabular-nums;
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 5px;
          white-space: nowrap;
        }
        .vh-price-amount-unit {
          font-size: 15px;
          font-weight: 800;
          color: #6ee7b7;
          -webkit-text-fill-color: #6ee7b7;
        }
        .vh-price-rate-pill {
          margin: 10px auto 14px;
          padding: 5px 10px;
          border-radius: 9px;
          background: rgba(15, 23, 42, 0.82);
          border: 1px solid rgba(52, 211, 153, 0.3);
          font-size: 12px;
          font-weight: 700;
          color: #6ee7b7;
        }
        .vh-price-list {
          list-style: none;
          padding: 0;
          margin: 0 0 18px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-size: 12.5px;
          color: #cbd5e1;
          line-height: 1.45;
        }
        .vh-price-list li {
          display: flex;
          align-items: flex-start;
          gap: 7px;
        }
        .vh-flat-examples {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0 18px;
        }
        .vh-flat-ex-box {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(56, 189, 248, 0.28);
          border-radius: 11px;
          padding: 10px 8px;
        }

        /* Responsive */
        @media (max-width: 960px) {
          .vh-hero { grid-template-columns: 1fr; padding-top: 30px; }
          .vh-hero-title { font-size: 34px; }
          .vh-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .vh-pricing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .vh-grid-3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .vh-grid-4 { grid-template-columns: 1fr; }
          .vh-pricing-grid { grid-template-columns: 1fr; }
          .vh-flat-examples { grid-template-columns: 1fr; }
          .vh-stats-row { grid-template-columns: 1fr; }
          .vh-hero-title { font-size: 28px; }
          .vh-spot-price { font-size: 42px; }
        }
      `;
      document.head.appendChild(style);
    }

    buildMiniSlips(count) {
      const bnDigits = ['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      let html = '';
      for (let i = 0; i < count; i++) {
        html += `
          <div class="vh-mini-slip">
            <div class="vh-mini-slip-hdr"></div>
            <div class="vh-mini-slip-num">${bnDigits[i] || (i + 1)}</div>
            <div class="vh-mini-slip-ftr"></div>
          </div>
        `;
      }
      return html;
    }

    renderHomePage() {
      if (document.getElementById('webHomePage')) return;
      const root = document.createElement('div');
      root.id = 'webHomePage';

      root.innerHTML = `
        <div class="vh-bg-glow">
          <div class="vh-orb vh-orb-1"></div>
          <div class="vh-orb vh-orb-2"></div>
          <div class="vh-orb vh-orb-3"></div>
        </div>

        <!-- TOP STICKY NAVBAR -->
        <div class="vh-nav-wrap">
          <nav class="vh-nav">
            <a href="#vh-top" class="vh-logo" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-top')">
              <div class="vh-logo-icon">🗳️</div>
              <div>
                <div class="vh-logo-name">ভোটার স্লিপ জেনারেটর</div>
                <div class="vh-logo-sub">স্মার্ট ওয়েব এডিশন • HD প্রিন্ট</div>
              </div>
            </a>

            <div class="vh-nav-right">
              <a href="#vh-samples" class="vh-nav-link" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-samples')">🖼️ নমুনা দেখুন</a>
              <a href="#vh-pricing" class="vh-nav-link" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-pricing')">💰 মূল্য দেখুন</a>
              <a href="#vh-contact" class="vh-nav-link" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-contact')">📞 যোগাযোগ</a>
              <a id="vhNavWaLink" href="https://wa.me/8801556452488" target="_blank" class="vh-wa-pill" title="হোয়াটসঅ্যাপে যোগাযোগ করুন">
                <span>💬</span>
                <span id="vhNavWaNumber">${DEFAULT_WHATSAPP_NUMBER}</span>
              </a>
              <button class="vh-btn vh-btn-ghost" onclick="VoterHomePage.openLogin()">
                👤 লগইন
              </button>
              <button class="vh-btn vh-btn-primary" onclick="VoterHomePage.openRegister()">
                ✨ নতুন একাউন্ট তৈরি
              </button>
            </div>
          </nav>
        </div>

        <!-- MAIN HOME SHELL -->
        <div id="vh-top" class="vh-shell">

          <!-- HERO SECTION -->
          <section class="vh-hero">
            <div>
              <h1 class="vh-hero-title">
                অল্প খরচে, সবচেয়ে দ্রুত সময়ে <br>
                <span class="vh-gradient-text">নিখুঁত ভোটার স্লিপ</span> তৈরি করুন!
              </h1>
              <p class="vh-hero-desc">
                নির্বাচনী প্রচারণার জন্য হাজার হাজার ভোটারের তালিকা থেকে মাত্র কয়েক সেকেন্ডেই প্রিন্ট-রেডি হাই-কোয়ালিটি (HD) পিডিএফ ভোটার স্লিপ তৈরি করুন। কোনো মাসিক চার্জ নেই — যত ভোটার, ঠিক তত টোকেনের হিসাব!
              </p>

              <div class="vh-hero-cta">
                <a href="#vh-pricing" class="vh-btn vh-btn-primary vh-btn-lg" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-pricing')">
                  💰 মূল্য তালিকা দেখুন
                </a>
                <a href="#vh-samples" class="vh-btn vh-btn-ghost vh-btn-lg" onclick="event.preventDefault(); VoterHomePage.scrollToSection('vh-samples')">
                  🖼️ নমুনা দেখুন
                </a>
              </div>

              <div class="vh-stats-row">
                <div class="vh-stat-pill">
                  <div class="vh-stat-val">⚡ সুপার ফাস্ট</div>
                  <div class="vh-stat-lbl">কয়েক সেকেন্ডেই শত শত স্লিপ</div>
                </div>
                <div class="vh-stat-pill">
                  <div class="vh-stat-val">🖨️ HD কোয়ালিটি</div>
                  <div class="vh-stat-lbl">ঝকঝকে বাংলা প্রিন্ট লেআউট</div>
                </div>
                <div class="vh-stat-pill">
                  <div class="vh-stat-val">🪙 পে-পার-ইউজ</div>
                  <div class="vh-stat-lbl">১ ভোটার = মাত্র ১ টোকেন</div>
                </div>
              </div>
            </div>

            <!-- Per-Voter Attractive Pricing Spotlight Card (Progressive Slab / Flat Pricing) -->
            <div class="vh-price-spotlight">
              <div class="vh-spot-tag" id="vhHeroSpotTag">🔥 ধাপভিত্তিক সাশ্রয়ী রেট</div>

              <div class="vh-spot-rate-box">
                <div class="vh-spot-label" id="vhHeroSpotLabel">প্রতি ভোটার স্লিপ খরচ সর্বনিম্ন</div>
                <div class="vh-spot-price" id="vhHeroRatePrice"><span>৳ 0.10</span><span class="vh-spot-currency-unit">পয়সা</span></div>
                <div class="vh-spot-unit" style="margin-top: 5px; font-size: 13.5px; color: #f1f5f9;">
                  <span style="color: #fef08a; font-weight: 800; font-size: 14.5px; font-family: 'Noto Sans Bengali', sans-serif;">১ ভোটার = ১ টোকেন</span>
                  <span id="vhHeroSpotSub" style="color: #94a3b8; font-size: 12px; display: block; margin-top: 2px;">(যত বেশি ভোটার, গড় খরচ তত কম • কোনো হিডেন চার্জ নেই)</span>
                </div>
              </div>

              <!-- Live Interactive Progressive Cost Estimator -->
              <div class="vh-mini-calc">
                <div class="vh-mini-calc-head">
                  <span>🧮 আপনার এলাকার খরচ হিসাব করুন:</span>
                  <span style="color: #38bdf8; font-weight: 800;" id="vhCalcVoterCount">10,000 ভোটার</span>
                </div>
                <input type="range" id="vhVoterSlider" class="vh-slider" min="1000" max="60000" step="500" value="10000" oninput="VoterHomePage.updateHomeCalc()" />
                <div class="vh-calc-result">
                  <div>
                    <span style="font-size: 12.5px; color: #94a3b8;">মোট সম্ভাব্য খরচ:</span>
                    <div id="vhCalcAvgRate" style="font-size: 11px; color: #34d399; font-weight: 700;">গড় রেট: ৳ 0.30 পয়সা / ভোটার</div>
                  </div>
                  <span class="vh-calc-total" id="vhCalcTotalCost">৳ 3000.00 টাকা</span>
                </div>
              </div>

              <ul class="vh-spot-checks">
                <li><span>✅</span> একবার টোকেন কিনে যেকোনো সংখ্যক এলাকার PDF তৈরি</li>
                <li><span>✅</span> ছবি ও টেক্সট — উভয় পদ্ধতিতেই সুপার ফাস্ট প্রসেসিং</li>
                <li><span>✅</span> বিকাশ ও নগদ থেকে সহজ ও দ্রুত টোকেন রিচার্জ</li>
              </ul>

              <button class="vh-btn vh-btn-primary" style="width: 100%; padding: 11px; font-size: 14.5px;" onclick="VoterHomePage.openRegister()">
                এখনই শুরু করুন →
              </button>
            </div>
          </section>

          <!-- INTERACTIVE SAMPLE CARDS SECTION (9, 6, 4 per page) -->
          <section id="vh-samples" class="vh-section">
            <div class="vh-section-head">
              <h2 class="vh-section-title">ভোটার স্লিপ তৈরি করুন</h2>
              <p class="vh-section-sub">কম খরচে, অল্প সময় দ্রুত গতিতে</p>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">
                নিচের যেকোনো কার্ডে ক্লিক করে প্রতি পেজে ৯, ৬ ও ৪টি স্লিপের আসল HD নমুনা দেখুন
              </div>
            </div>

            <div class="vh-grid-3">
              <!-- 9 Per Page Card (EXACTLY 9 slips in 3x3 Portrait A4) -->
              <div class="vh-sample-card featured" onclick="VoterHomePage.openSamplePreview(9)">
                <div class="vh-pack-ribbon">⭐ সবচেয়ে জনপ্রিয় ও সাশ্রয়ী</div>
                <div>
                  <div class="vh-mini-a4-stage">
                    <div class="vh-mini-a4 grid-9">${this.buildMiniSlips(9)}</div>
                  </div>
                  <h3 class="vh-sample-title">প্রতি পেজে ৯টি স্লিপ</h3>
                  <div class="vh-sample-badge">৩×৩ পোর্ট্রেট A4 লেআউট</div>
                  <p class="vh-sample-desc">কাগজ ও প্রিন্ট খরচ সবচেয়ে কম — একটি A4 পেজে ৯ জন ভোটারের ঝকঝকে স্লিপ।</p>
                </div>
                <button class="vh-btn vh-btn-primary" style="width: 100%;">👁️ ৯টির নমুনা দেখুন</button>
              </div>

              <!-- 6 Per Page Card (EXACTLY 6 slips in 2x3 Landscape A4) -->
              <div class="vh-sample-card" onclick="VoterHomePage.openSamplePreview(6)">
                <div>
                  <div class="vh-mini-a4-stage">
                    <div class="vh-mini-a4 grid-6">${this.buildMiniSlips(6)}</div>
                  </div>
                  <h3 class="vh-sample-title">প্রতি পেজে ৬টি স্লিপ</h3>
                  <div class="vh-sample-badge">২×৩ ল্যান্ডস্কেপ A4 লেআউট</div>
                  <p class="vh-sample-desc">স্ট্যান্ডার্ড সাইজ ও মাঝারি-বড় ফন্ট — দেখতে পরিচ্ছন্ন ও পড়তে অত্যন্ত সহজ।</p>
                </div>
                <button class="vh-btn vh-btn-ghost" style="width: 100%;">👁️ ৬টির নমুনা দেখুন</button>
              </div>

              <!-- 4 Per Page Card (EXACTLY 4 slips in 2x2 Portrait A4) -->
              <div class="vh-sample-card" onclick="VoterHomePage.openSamplePreview(4)">
                <div>
                  <div class="vh-mini-a4-stage">
                    <div class="vh-mini-a4 grid-4">${this.buildMiniSlips(4)}</div>
                  </div>
                  <h3 class="vh-sample-title">প্রতি পেজে ৪টি স্লিপ</h3>
                  <div class="vh-sample-badge">২×২ পোর্ট্রেট A4 লেআউট</div>
                  <p class="vh-sample-desc">বড় ছবি, বড় মার্কা ও বড় অক্ষরে স্পষ্ট ভোটার স্লিপ।</p>
                </div>
                <button class="vh-btn vh-btn-ghost" style="width: 100%;">👁️ ৪টির নমুনা দেখুন</button>
              </div>
            </div>
          </section>

          <!-- PRICING CARDS SECTION -->
          <section id="vh-pricing" class="vh-section" style="padding-top: 26px;">
            <div class="vh-section-head">
              <h2 class="vh-section-title" style="font-size: 30px;">💰 প্যাকেজ ও মূল্য তালিকা</h2>
              <p id="vhPricingSectionSub" class="vh-section-sub" style="color: #7dd3fc; font-size: 15px;">
                ১ ভোটার = ১ টোকেন • যত বেশি ভোটার, খরচ তত সাশ্রয়ী
              </p>
            </div>

            <div id="vhPricingCardsGrid" class="vh-pricing-grid"></div>
          </section>

          <!-- 4 CORE FEATURE CARDS (Directly after the 9, 6, 4 sample cards) -->
          <section id="vh-features" class="vh-section" style="padding-top: 20px;">
            <div class="vh-section-head">
              <h2 class="vh-section-title" style="font-size: 28px;">কেন আমাদের ভোটার স্লিপ জেনারেটর সেরা?</h2>
              <p class="vh-section-sub" style="color: #94a3b8; font-weight: 500; font-size: 14.5px;">আধুনিক ডিজাইন, নির্ভুল বাংলা ফন্ট এবং অবিশ্বাস্য গতির সমন্বয়</p>
            </div>

            <div class="vh-grid-4">
              <div class="vh-feature-card">
                <div class="vh-feature-icon">⚡</div>
                <h3 class="vh-feature-title">অল্প সময়ে বিশাল কাজ</h3>
                <p class="vh-feature-desc">একটি পূর্ণাঙ্গ কেন্দ্রের হাজারো ভোটারের স্লিপ সাজাতে ঘণ্টার পর ঘণ্টা নয় — মাত্র কয়েক সেকেন্ডেই প্রস্তুত।</p>
              </div>

              <div class="vh-feature-card">
                <div class="vh-feature-icon">🖨️</div>
                <h3 class="vh-feature-title">নিখুঁত HD প্রিন্ট লেআউট</h3>
                <p class="vh-feature-desc">প্রতি পেজে ৯, ৬ বা ৪টি স্লিপ — প্রতিটি স্লিপে কেন্দ্রের নাম, প্রার্থীর ছবি, মার্কা ও ফুটার থাকবে ঝকঝকে।</p>
              </div>

              <div class="vh-feature-card">
                <div class="vh-feature-icon">📄</div>
                <h3 class="vh-feature-title">ছবি ও টেক্সট উভয় সাপোর্ট</h3>
                <p class="vh-feature-desc">নির্বাচন কমিশনের পিডিএফ থেকে টেক্সট এক্সট্র্যাক্ট করে কিংবা স্লাইস করা ছবি — দুইভাবেই স্লিপ তৈরি করা যায়।</p>
              </div>

              <div class="vh-feature-card">
                <div class="vh-feature-icon">🔒</div>
                <h3 class="vh-feature-title">নিরাপদ টোকেন ওয়ালেট</h3>
                <p class="vh-feature-desc">একবার টোকেন রিচার্জ করলে ব্যালেন্স আপনার একাউন্টে সুরক্ষিত থাকবে; যত এলাকায় কাজ করবেন ততটুকুই কাটবে।</p>
              </div>
            </div>
          </section>

          <!-- HOW IT WORKS SECTION -->
          <section id="vh-steps" class="vh-section">
            <div class="vh-section-head">
              <h2 class="vh-section-title" style="font-size: 28px;">মাত্র ৩টি সহজ ধাপে ভোটার স্লিপ প্রস্তুত</h2>
              <p class="vh-section-sub" style="color: #94a3b8; font-weight: 500; font-size: 14.5px;">কোনো জটিল সফটওয়্যার ইনস্টল করার প্রয়োজন নেই — ব্রাউজার থেকেই সম্পূর্ণ কাজ</p>
            </div>

            <div class="vh-grid-3">
              <div class="vh-step-card">
                <div class="vh-step-num">১</div>
                <h3 class="vh-feature-title">নতুন ইউজার রেজিস্ট্রেশন</h3>
                <p class="vh-feature-desc">আপনার নাম, মোবাইল নম্বর এবং ৪-ডিজিটের পিন দিয়ে ১০ সেকেন্ডেই নতুন একাউন্ট তৈরি করুন।</p>
              </div>

              <div class="vh-step-card">
                <div class="vh-step-num">২</div>
                <h3 class="vh-feature-title">টোকেন রিচার্জ করুন</h3>
                <p class="vh-feature-desc">আপনার প্রয়োজনীয় ভোটার সংখ্যা অনুযায়ী বিকাশ বা নগদ থেকে টাকা পাঠিয়ে TrxID সাবমিট করুন।</p>
              </div>

              <div class="vh-step-card">
                <div class="vh-step-num">৩</div>
                <h3 class="vh-feature-title">১ ক্লিকে HD পিডিএফ ডাউনলোড</h3>
                <p class="vh-feature-desc">ডিজাইন সিলেক্ট করে ভোটার ফাইল আপলোড করলেই প্রিন্ট করার জন্য ঝকঝকে পিডিএফ তৈরি হয়ে যাবে।</p>
              </div>
            </div>
          </section>

          <!-- CLEAN CONTACT SECTION -->
          <section id="vh-contact" class="vh-section">
            <div class="vh-contact-banner">
              <div class="vh-eyebrow" style="margin-bottom: 12px;">📞 ২৪/৭ সাপোর্ট ও যোগাযোগ</div>
              <h2 class="vh-section-title" style="font-size: 28px; margin-bottom: 10px;">যেকোনো প্রয়োজনে সরাসরি যোগাযোগ করুন</h2>
              <p style="font-size: 15px; color: #cbd5e1; line-height: 1.7; max-width: 620px; margin: 0 auto 24px;">
                টোকেন রিচার্জ, বড় আসনের বিশেষ প্যাকেজ অথবা সফটওয়্যার ব্যবহারে যেকোনো সহযোগিতার জন্য আমাদের হোয়াটসঅ্যাপে মেসেজ করুন (প্রতিদিন সকাল ৯:০০টা – রাত ১১:০০টা)।
              </p>
              <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <a id="vhWhatsappBtn" href="https://wa.me/8801556452488" target="_blank" class="vh-btn vh-btn-primary vh-btn-lg">
                  💬 হোয়াটসঅ্যাপে যোগাযোগ (<span id="vhContactWaLabel">${DEFAULT_WHATSAPP_NUMBER}</span>)
                </a>
                <button class="vh-btn vh-btn-ghost vh-btn-lg" onclick="VoterHomePage.openRegister()">
                  ✨ নতুন একাউন্ট তৈরি
                </button>
              </div>
            </div>
          </section>

          <footer class="vh-footer">
            © ২০২৬ ভোটার স্লিপ জেনারেটর (ওয়েব সংস্করণ) — দ্রুত, সাশ্রয়ী ও আধুনিক ভোটার স্লিপ সল্যুশন।
          </footer>
        </div>

        <!-- REAL SAMPLE IMAGE PREVIEW MODAL (Full A4 Sheet with Exact 9 / 6 / 4 Masked Slips) -->
        <div id="vhSampleModal" class="vh-sample-modal" onclick="if(event.target===this) VoterHomePage.closeSamplePreview()">
          <div class="vh-sample-dialog">
            <div class="vh-sample-modal-head">
              <div>
                <div id="vhSampleModalTitle" style="font-size: 18px; font-weight: 800; color: #38bdf8;">🖼️ প্রতি পেজে ৯টি স্লিপের নমুনা</div>
                <div id="vhSampleModalSub" style="font-size: 12px; color: #94a3b8;">আসল ভোটার স্লিপের HD নমুনা প্রিভিউ</div>
              </div>

              <div class="vh-sample-switcher">
                <button id="vhSw9" class="vh-sw-btn active" onclick="VoterHomePage.openSamplePreview(9)">৯টি (পোর্ট্রেট)</button>
                <button id="vhSw6" class="vh-sw-btn" onclick="VoterHomePage.openSamplePreview(6)">৬টি (ল্যান্ডস্কেপ)</button>
                <button id="vhSw4" class="vh-sw-btn" onclick="VoterHomePage.openSamplePreview(4)">৪টি (পোর্ট্রেট)</button>
              </div>

              <div class="vh-sample-head-right">
                <button class="vh-btn vh-btn-primary" style="padding: 8px 16px; font-size: 13px;" onclick="VoterHomePage.closeSamplePreview(); VoterHomePage.openRegister();">
                  একাউন্ট খুলুন
                </button>
                <button class="token-close-btn" onclick="VoterHomePage.closeSamplePreview()" title="বন্ধ করুন">&times;</button>
              </div>
            </div>

            <div class="vh-sample-img-frame">
              <div id="vhSampleSheetContainer" style="width: 100%; display: flex; justify-content: center;"></div>
            </div>
          </div>
        </div>
      `;

      document.body.insertBefore(root, document.body.firstChild);
    }

    openSamplePreview(count) {
      const modal = document.getElementById('vhSampleModal');
      const titleEl = document.getElementById('vhSampleModalTitle');
      const subEl = document.getElementById('vhSampleModalSub');
      const container = document.getElementById('vhSampleSheetContainer');
      if (!modal || !container) return;

      const validCount = (count === 6 || count === 4) ? count : 9;
      const info = SAMPLE_IMAGES[validCount];
      if (titleEl) titleEl.textContent = info.title;
      if (subEl) subEl.textContent = info.subtitle;

      let slipsHtml = '';
      for (let i = 0; i < validCount; i++) {
        slipsHtml += `<img class="vh-real-slip-img" src="${info.src}" alt="ভোটার স্লিপ নমুনা ${i + 1}" />`;
      }
      container.innerHTML = `<div class="vh-real-a4-sheet sheet-${validCount}">${slipsHtml}</div>`;
      const frame = container.parentElement;
      if (frame) frame.scrollTop = 0;

      [9, 6, 4].forEach(n => {
        const btn = document.getElementById('vhSw' + n);
        if (btn) btn.classList.toggle('active', n === validCount);
      });

      modal.classList.add('active');
    }

    closeSamplePreview() {
      const modal = document.getElementById('vhSampleModal');
      if (modal) modal.classList.remove('active');
    }

    getPricingConfig() {
      const s = this.getSettings();
      const mode = (window.TokenSystem && typeof window.TokenSystem.getPricingMode === 'function')
        ? window.TokenSystem.getPricingMode()
        : (s.pricingMode === 'flat' ? 'flat' : 'slab');

      const flatRate = (window.TokenSystem && typeof window.TokenSystem.getFlatRate === 'function')
        ? window.TokenSystem.getFlatRate()
        : Math.max(0.01, Math.round((parseFloat(s.flatRate) || 0.20) * 100) / 100);

      if (window.TokenSystem && typeof window.TokenSystem.getSlabConfig === 'function') {
        return { mode, flatRate, slabConfig: window.TokenSystem.getSlabConfig() };
      }

      const raw = (s && typeof s.slabConfig === 'object' && s.slabConfig) ? s.slabConfig : {};
      const p10 = Math.max(1, Math.round((parseFloat(raw.price10k) || 3000) * 100) / 100);
      const p20 = Math.max(p10, Math.round((parseFloat(raw.price20k) || 3500) * 100) / 100);
      const p30 = Math.max(p20, Math.round((parseFloat(raw.price30k) || 4000) * 100) / 100);
      const r40 = Math.max(0.01, Math.round((parseFloat(raw.rate40kPlus) || 0.10) * 100) / 100);
      return {
        mode,
        flatRate,
        slabConfig: { price10k: p10, price20k: p20, price30k: p30, rate40kPlus: r40 }
      };
    }

    calcProgressive(tokens) {
      if (window.TokenSystem && typeof window.TokenSystem.calculateProgressivePrice === 'function') {
        return window.TokenSystem.calculateProgressivePrice(tokens);
      }
      const qty = Math.max(0, parseInt(tokens, 10) || 0);
      const { mode, flatRate, slabConfig: cfg } = this.getPricingConfig();

      if (mode === 'flat') {
        const totalTaka = Math.round(qty * flatRate * 100) / 100;
        return { mode: 'flat', tokens: qty, totalTaka, avgRate: flatRate, minRate: flatRate, flatRate, breakdown: [] };
      }

      const r1 = cfg.price10k / 10000;
      const r2 = (cfg.price20k - cfg.price10k) / 10000;
      const r3 = (cfg.price30k - cfg.price20k) / 10000;
      const p40Target = Math.round(40000 * cfg.rate40kPlus * 100) / 100;
      const r4Bridge = p40Target > cfg.price30k ? (p40Target - cfg.price30k) / 10000 : 0;

      let totalTaka = 0;
      if (qty >= 40000) {
        totalTaka = Math.round(qty * cfg.rate40kPlus * 100) / 100;
      } else if (qty <= 10000) {
        totalTaka = qty === 10000 ? cfg.price10k : Math.round(qty * r1 * 100) / 100;
      } else if (qty <= 20000) {
        totalTaka = qty === 20000 ? cfg.price20k : Math.round((cfg.price10k + (qty - 10000) * r2) * 100) / 100;
      } else if (qty <= 30000) {
        totalTaka = qty === 30000 ? cfg.price30k : Math.round((cfg.price20k + (qty - 20000) * r3) * 100) / 100;
      } else {
        totalTaka = Math.round((cfg.price30k + (qty - 30000) * r4Bridge) * 100) / 100;
      }

      const avgRate = qty > 0 ? Math.round((totalTaka / qty) * 100) / 100 : Math.round(r1 * 100) / 100;
      return { mode: 'slab', tokens: qty, totalTaka, avgRate, minRate: cfg.rate40kPlus, slabConfig: cfg, breakdown: [] };
    }

    syncWithSettings() {
      const { mode, flatRate, slabConfig } = this.getPricingConfig();
      const displayRate = mode === 'flat' ? flatRate : slabConfig.rate40kPlus;
      const rateUnit = this.getMoneyUnit(displayRate);

      const spotTag = document.getElementById('vhHeroSpotTag');
      const spotLabel = document.getElementById('vhHeroSpotLabel');
      const spotSub = document.getElementById('vhHeroSpotSub');
      const heroRate = document.getElementById('vhHeroRatePrice');

      if (spotTag) {
        spotTag.textContent = mode === 'flat' ? '🏷️ ফ্ল্যাট প্রাইজ অফার' : '🔥 ধাপভিত্তিক সাশ্রয়ী রেট';
      }
      if (spotLabel) {
        spotLabel.textContent = mode === 'flat' ? 'প্রতি ভোটার স্লিপ খরচ মাত্র' : 'প্রতি ভোটার স্লিপ খরচ সর্বনিম্ন';
      }
      if (spotSub) {
        spotSub.textContent = mode === 'flat'
          ? '(যেকোনো সংখ্যক ভোটারের জন্য একই রেট • কোনো হিডেন চার্জ নেই)'
          : `(৪০ হাজার+ হলে ১ থেকে সব ৳ ${this.formatMoney(slabConfig.rate40kPlus)} ${this.getMoneyUnit(slabConfig.rate40kPlus)} • কোনো হিডেন চার্জ নেই)`;
      }
      if (heroRate) {
        heroRate.innerHTML = `<span>৳ ${this.formatMoney(displayRate)}</span><span class="vh-spot-currency-unit">${rateUnit}</span>`;
      }

      const waDisplay = DEFAULT_WHATSAPP_NUMBER;
      const cleanDigits = waDisplay.replace(/[^0-9]/g, '');
      const waNum = cleanDigits.startsWith('88') ? cleanDigits : '88' + cleanDigits;
      const waHref = `https://wa.me/${waNum}?text=${encodeURIComponent('আসসালামু আলাইকুম, ভোটার স্লিপ জেনারেটর সম্পর্কে জানতে চাচ্ছি।')}`;

      const navWaLink = document.getElementById('vhNavWaLink');
      const navWaNum = document.getElementById('vhNavWaNumber');
      if (navWaLink) navWaLink.href = waHref;
      if (navWaNum) navWaNum.textContent = waDisplay;

      const waBtn = document.getElementById('vhWhatsappBtn');
      const contactWaLbl = document.getElementById('vhContactWaLabel');
      if (waBtn) waBtn.href = waHref;
      if (contactWaLbl) contactWaLbl.textContent = waDisplay;

      this.renderPricingCards();
      this.updateHomeCalc();
    }

    formatPriceComma(val) {
      const n = Math.round((parseFloat(val) || 0) * 100) / 100;
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    renderPricingCards() {
      const grid = document.getElementById('vhPricingCardsGrid');
      const subEl = document.getElementById('vhPricingSectionSub');
      if (!grid) return;

      const { mode, flatRate, slabConfig: cfg } = this.getPricingConfig();

      if (mode === 'flat') {
        grid.classList.add('flat-mode');
        if (subEl) {
          subEl.textContent = `ফ্ল্যাট প্রাইজ চালু আছে — যেকোনো সংখ্যক ভোটারের জন্য প্রতি টোকেন মাত্র ৳ ${this.formatMoney(flatRate)} ${this.getMoneyUnit(flatRate)}`;
        }
        const ex10 = flatRate * 10000;
        const ex20 = flatRate * 20000;
        const ex50 = flatRate * 50000;

        grid.innerHTML = `
          <div class="vh-price-card featured">
            <div class="vh-pack-ribbon">🏷️ ফ্ল্যাট প্রাইজ অফার</div>
            <div>
              <div class="vh-price-badge" style="margin-top: 6px;">এক রেট • কোনো শর্ত নেই</div>
              <h3 class="vh-price-card-title">সকল ভোটারের জন্য ফ্ল্যাট প্রাইজ</h3>
              <div class="vh-price-amount">
                <span>৳ ${this.formatMoney(flatRate)}</span>
                <span class="vh-price-amount-unit">${this.getMoneyUnit(flatRate)}</span>
              </div>
              <div class="vh-price-rate-pill">প্রতি ১টি ভোটার স্লিপ = ১ টোকেন (কোনো হিডেন চার্জ নেই)</div>

              <div class="vh-flat-examples">
                <div class="vh-flat-ex-box">
                  <div style="font-size: 11.5px; color: #94a3b8;">১০,০০০ ভোটার</div>
                  <div style="font-size: 14px; font-weight: 800; color: #34d399; margin-top: 3px;">৳ ${this.formatPriceComma(ex10)} ${this.getMoneyUnit(ex10)}</div>
                </div>
                <div class="vh-flat-ex-box">
                  <div style="font-size: 11.5px; color: #94a3b8;">২০,০০০ ভোটার</div>
                  <div style="font-size: 14px; font-weight: 800; color: #34d399; margin-top: 3px;">৳ ${this.formatPriceComma(ex20)} ${this.getMoneyUnit(ex20)}</div>
                </div>
                <div class="vh-flat-ex-box">
                  <div style="font-size: 11.5px; color: #94a3b8;">৫০,০০০ ভোটার</div>
                  <div style="font-size: 14px; font-weight: 800; color: #34d399; margin-top: 3px;">৳ ${this.formatPriceComma(ex50)} ${this.getMoneyUnit(ex50)}</div>
                </div>
              </div>

              <ul class="vh-price-list">
                <li><span>✅</span> ১ টোকেন থেকে যেকোনো পরিমাণ — একই ফ্ল্যাট রেট</li>
                <li><span>✅</span> প্রতি পেজে ৯, ৬ ও ৪টি HD ভোটার স্লিপ তৈরি</li>
                <li><span>✅</span> বিকাশ ও নগদে দ্রুত টোকেন রিচার্জ</li>
              </ul>
            </div>

            <button class="vh-btn vh-btn-primary" style="width: 100%;" onclick="VoterHomePage.openRegister()">
              🚀 একাউন্ট খুলুন
            </button>
          </div>
        `;
        return;
      }

      grid.classList.remove('flat-mode');
      if (subEl) {
        subEl.textContent = `১ ভোটার = ১ টোকেন • ৪০,০০০+ হলেই ১ থেকে সকল টোকেন মাত্র ৳ ${this.formatMoney(cfg.rate40kPlus)} ${this.getMoneyUnit(cfg.rate40kPlus)}`;
      }

      const r1 = cfg.price10k / 10000;
      const r2 = (cfg.price20k - cfg.price10k) / 10000;
      const r3 = (cfg.price30k - cfg.price20k) / 10000;
      const avg20 = Math.round((cfg.price20k / 20000) * 100) / 100;
      const avg30 = Math.round((cfg.price30k / 30000) * 100) / 100;
      const p40 = cfg.rate40kPlus * 40000;
      const p50 = cfg.rate40kPlus * 50000;

      grid.innerHTML = `
        <!-- Card 1: 10,000 -->
        <div class="vh-price-card">
          <div>
            <div class="vh-price-badge">স্টার্টার প্যাকেজ</div>
            <h3 class="vh-price-card-title">১০,০০০ টোকেন</h3>
            <div class="vh-price-amount">
              <span>৳ ${this.formatPriceComma(cfg.price10k)}</span>
              <span class="vh-price-amount-unit">${this.getMoneyUnit(cfg.price10k)}</span>
            </div>
            <div class="vh-price-rate-pill">প্রতি টোকেন ৳ ${this.formatMoney(r1)} ${this.getMoneyUnit(r1)}</div>
            <ul class="vh-price-list">
              <li><span>✅</span> ১ – ১০,০০০ ভোটারের জন্য প্রযোজ্য</li>
              <li><span>✅</span> ১ ভোটার = ১ টোকেন</li>
              <li><span>✅</span> ৯, ৬ ও ৪টি স্লিপ HD প্রিন্ট</li>
            </ul>
          </div>
          <button class="vh-btn vh-btn-ghost" style="width: 100%;" onclick="VoterHomePage.openRegister()">
            🚀 একাউন্ট খুলুন
          </button>
        </div>

        <!-- Card 2: 20,000 -->
        <div class="vh-price-card">
          <div>
            <div class="vh-price-badge">জনপ্রিয় প্যাকেজ</div>
            <h3 class="vh-price-card-title">২০,০০০ টোকেন</h3>
            <div class="vh-price-amount">
              <span>৳ ${this.formatPriceComma(cfg.price20k)}</span>
              <span class="vh-price-amount-unit">${this.getMoneyUnit(cfg.price20k)}</span>
            </div>
            <div class="vh-price-rate-pill">গড় রেট ৳ ${this.formatMoney(avg20)} ${this.getMoneyUnit(avg20)} / টোকেন</div>
            <ul class="vh-price-list">
              <li><span>✅</span> প্রথম ১০ হাজার = ৳ ${this.formatPriceComma(cfg.price10k)} ${this.getMoneyUnit(cfg.price10k)}</li>
              <li><span>✅</span> ১০ হাজারের পর মাত্র ৳ ${this.formatMoney(r2)} ${this.getMoneyUnit(r2)}/টোকেন</li>
              <li><span>✅</span> ১ ভোটার = ১ টোকেন</li>
            </ul>
          </div>
          <button class="vh-btn vh-btn-ghost" style="width: 100%;" onclick="VoterHomePage.openRegister()">
            🚀 একাউন্ট খুলুন
          </button>
        </div>

        <!-- Card 3: 30,000 -->
        <div class="vh-price-card">
          <div>
            <div class="vh-price-badge">সাশ্রয়ী প্যাকেজ</div>
            <h3 class="vh-price-card-title">৩০,০০০ টোকেন</h3>
            <div class="vh-price-amount">
              <span>৳ ${this.formatPriceComma(cfg.price30k)}</span>
              <span class="vh-price-amount-unit">${this.getMoneyUnit(cfg.price30k)}</span>
            </div>
            <div class="vh-price-rate-pill">গড় রেট ৳ ${this.formatMoney(avg30)} ${this.getMoneyUnit(avg30)} / টোকেন</div>
            <ul class="vh-price-list">
              <li><span>✅</span> প্রথম ২০ হাজার = ৳ ${this.formatPriceComma(cfg.price20k)} ${this.getMoneyUnit(cfg.price20k)}</li>
              <li><span>✅</span> ২০ হাজারের পর মাত্র ৳ ${this.formatMoney(r3)} ${this.getMoneyUnit(r3)}/টোকেন</li>
              <li><span>✅</span> ১ ভোটার = ১ টোকেন</li>
            </ul>
          </div>
          <button class="vh-btn vh-btn-ghost" style="width: 100%;" onclick="VoterHomePage.openRegister()">
            🚀 একাউন্ট খুলুন
          </button>
        </div>

        <!-- Card 4: 40,000+ (Featured) -->
        <div class="vh-price-card featured">
          <div class="vh-pack-ribbon">🔥 সেরা অফার</div>
          <div>
            <div class="vh-price-badge" style="margin-top: 4px;">৪০,০০০+ স্পেশাল</div>
            <h3 class="vh-price-card-title">৪০,০০০+ টোকেন</h3>
            <div class="vh-price-amount">
              <span>৳ ${this.formatMoney(cfg.rate40kPlus)}</span>
              <span class="vh-price-amount-unit">${this.getMoneyUnit(cfg.rate40kPlus)}</span>
            </div>
            <div class="vh-price-rate-pill">১ থেকে সকল টোকেন প্রতি পিস ৳ ${this.formatMoney(cfg.rate40kPlus)} ${this.getMoneyUnit(cfg.rate40kPlus)}</div>
            <ul class="vh-price-list">
              <li><span>✅</span> ৪০,০০০ টোকেন = ৳ ${this.formatPriceComma(p40)} ${this.getMoneyUnit(p40)}</li>
              <li><span>✅</span> ৫০,০০০ টোকেন = ৳ ${this.formatPriceComma(p50)} ${this.getMoneyUnit(p50)}</li>
              <li><span>✅</span> বড় নির্বাচনী এলাকার জন্য সবচেয়ে কম খরচ</li>
            </ul>
          </div>
          <button class="vh-btn vh-btn-primary" style="width: 100%;" onclick="VoterHomePage.openRegister()">
            ✨ এখনই শুরু করুন
          </button>
        </div>
      `;
    }

    updateHomeCalc() {
      const slider = document.getElementById('vhVoterSlider');
      const countEl = document.getElementById('vhCalcVoterCount');
      const totalEl = document.getElementById('vhCalcTotalCost');
      const avgEl = document.getElementById('vhCalcAvgRate');
      if (!slider || !countEl || !totalEl) return;

      const voters = parseInt(slider.value, 10) || 10000;
      const calc = this.calcProgressive(voters);

      countEl.textContent = `${voters.toLocaleString('en-US')} ভোটার`;
      totalEl.textContent = `৳ ${this.formatMoney(calc.totalTaka)} ${this.getMoneyUnit(calc.totalTaka)}`;

      if (avgEl) {
        if (calc.mode === 'flat') {
          avgEl.textContent = `ফ্ল্যাট রেট: ৳ ${this.formatMoney(calc.flatRate)} ${this.getMoneyUnit(calc.flatRate)} / ভোটার`;
        } else if (voters >= 40000) {
          avgEl.textContent = `৪০হাজার+ রেট: ৳ ${this.formatMoney(calc.slabConfig.rate40kPlus)} ${this.getMoneyUnit(calc.slabConfig.rate40kPlus)} / ভোটার (১ থেকে সব)`;
        } else {
          avgEl.textContent = `গড় রেট: ৳ ${this.formatMoney(calc.avgRate)} ${this.getMoneyUnit(calc.avgRate)} / ভোটার`;
        }
      }
    }

    scrollToSection(sectionId) {
      if (sectionId === 'vh-top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if ((window.location.protocol === 'http:' || window.location.protocol === 'https:') && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    openLogin() {
      if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        window.history.replaceState(null, '', '/login');
      }
      if (window.TokenSystem) {
        window.TokenSystem.switchUserAuthTab('login');
        window.TokenSystem.openModal('tokenUserAuthModal');
      }
    }

    openRegister() {
      if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        window.history.replaceState(null, '', '/login');
      }
      if (window.TokenSystem) {
        window.TokenSystem.switchUserAuthTab('register');
        window.TokenSystem.openModal('tokenUserAuthModal');
      }
    }
  }

  function initHomePageOnce() {
    if (!window.VoterHomePage) {
      window.VoterHomePage = new VoterHomePageManager();
    }
  }

  window.addEventListener('DOMContentLoaded', initHomePageOnce);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initHomePageOnce();
  }
})();
