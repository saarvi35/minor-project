import { useEffect, useState } from "react";
import { postData } from "../lib/api";

const STATS = [
  { value: "2,400", suffix: "+", label: "Enterprise Clients Worldwide" },
  { value: "99.9", suffix: "%", label: "Guaranteed Uptime SLA" },
  { value: "60", suffix: "+", label: "Countries Served" },
  { value: "850", suffix: "+", label: "Employees Globally" },
];

const CLIENTS = [
  "NorthBank",
  "Veltrix",
  "CoreMed",
  "Stratum",
  "Fenix Co.",
  "Arrowhead",
  "Meridian",
  "Helios Inc",
  "TerraOps",
  "Prism AI",
];

const ACCESS_CARDS = [
  {
    title: "Organization Account",
    body: "For company admins managing teams, billing, and organization-wide settings.",
    href: "/register",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: "Employee Account",
    body: "For team members and individual contributors accessing their daily workspace.",
    href: "/login",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const CONTACT_POINTS = [
  "Response within 1 business day",
  "Dedicated enterprise support team",
  "Available across all time zones",
  "No sales pressure, just honest answers",
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

*, *::before, *::after { box-sizing: border-box; }

.home-page {
  --wz-ink: var(--ui-text);
  --wz-ink-2: var(--ui-bg-elevated);
  --wz-ink-3: var(--ui-bg-soft);
  --wz-mist: var(--ui-bg-soft);
  --wz-mist-2: var(--ui-border);
  --wz-gold: var(--ui-primary);
  --wz-gold-light: var(--ui-primary-strong);
  --wz-white: var(--ui-text);
  --wz-text-dim: var(--ui-text-muted);
  --wz-text-body: var(--ui-text-soft);
  --wz-shell: var(--ui-bg);
  --wz-shell-2: var(--ui-bg-soft);
  --wz-surface: var(--ui-surface);
  --wz-surface-hover: var(--ui-surface-strong);
  --wz-line: var(--ui-border);
  --wz-soft-text: var(--ui-text-soft);
  --wz-muted-on-shell: var(--ui-text-muted);
  --wz-primary-rgb: 37, 99, 235;
  --wz-shadow: var(--ui-shadow);
}

html[data-theme="light"] .home-page {
  --wz-shell: var(--ui-bg);
  --wz-shell-2: var(--ui-bg-soft);
  --wz-surface: rgba(255, 255, 255, 0.88);
  --wz-surface-hover: #ffffff;
  --wz-line: var(--ui-border);
  --wz-soft-text: var(--ui-text-soft);
  --wz-muted-on-shell: var(--ui-text-muted);
  --wz-gold: var(--ui-primary);
  --wz-gold-light: var(--ui-primary-strong);
}

html[data-theme="dark"] .home-page {
  --wz-white: #ffffff;
  --wz-primary-rgb: 75, 139, 255;
}

html { scroll-behavior: smooth; }
body { overflow-x: hidden; }

.home-page {
  min-height: 100vh;
  background: var(--wz-white);
  color: var(--wz-ink);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.home-page ~ .global-theme-toggle,
.global-theme-toggle {
  border-color: var(--wz-line, rgba(37, 99, 235, 0.22));
  background: var(--wz-surface, rgba(13, 17, 23, 0.86));
  color: var(--wz-gold, #2563eb);
  font-family: 'DM Sans', sans-serif;
  box-shadow: var(--ui-shadow-soft);
  backdrop-filter: blur(12px);
}

html[data-theme="light"] .wz-field input,
html[data-theme="light"] .wz-field select,
html[data-theme="light"] .wz-field textarea {
  background: rgba(255, 255, 255, 0.86);
  border-color: var(--ui-border);
  color: var(--wz-ink);
}

html[data-theme="light"] .wz-field input::placeholder,
html[data-theme="light"] .wz-field textarea::placeholder {
  color: var(--ui-text-muted);
}

html[data-theme="light"] .wz-field label,
html[data-theme="light"] .wz-privacy,
html[data-theme="light"] .wz-success-body,
html[data-theme="light"] .wz-company {
  color: var(--ui-text-muted);
}

.wz-container { max-width: 1200px; margin: 0 auto; }

.wz-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
  padding: 0 64px;
  background: color-mix(in srgb, var(--wz-shell) 94%, transparent);
  border-bottom: 1px solid var(--wz-line);
  backdrop-filter: blur(12px);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.wz-nav.scrolled {
  border-bottom-color: var(--ui-border-strong);
  box-shadow: var(--ui-shadow-soft);
}

.wz-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.wz-brand-mark {
  width: 30px;
  height: 30px;
  border: 1.5px solid var(--wz-gold);
  display: grid;
  place-items: center;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.wz-brand-mark-inner {
  width: 12px;
  height: 12px;
  background: var(--wz-gold);
}

.wz-brand-name {
  font-family: 'DM Serif Display', serif;
  font-size: 18px;
  color: var(--wz-white);
  letter-spacing: 0.04em;
}

.wz-brand-name span { color: var(--wz-gold); }

.wz-nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.wz-nav-links a {
  color: var(--wz-text-dim);
  font-size: 13px;
  letter-spacing: 0.03em;
  text-decoration: none;
  transition: color 0.2s;
}

.wz-nav-links a:hover,
.wz-nav-links a.active { color: var(--wz-gold); }

.wz-nav-cta {
  padding: 9px 22px;
  background: var(--wz-gold);
  color: #ffffff !important;
  border-radius: 6px;
  font-weight: 600;
  transition: background 0.2s, transform 0.15s;
}

.wz-nav-cta:hover {
  background: var(--wz-gold-light);
  transform: translateY(-1px);
}

.wz-hero {
  min-height: 100vh;
  background: var(--wz-shell);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 120px 64px 80px;
  position: relative;
  overflow: hidden;
}

.wz-hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 50% 80%, rgba(var(--wz-primary-rgb), 0.12) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 20% 20%, rgba(var(--wz-primary-rgb), 0.14) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 80% 80%, rgba(22, 163, 74, 0.08) 0%, transparent 70%);
}

.wz-hero-grid,
.wz-cta-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(var(--wz-primary-rgb), 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--wz-primary-rgb), 0.06) 1px, transparent 1px);
  background-size: 60px 60px;
}

.wz-hero-content {
  position: relative;
  z-index: 2;
  max-width: 820px;
}

.wz-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  color: var(--wz-gold);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wz-eyebrow::before,
.wz-eyebrow::after {
  content: "";
  width: 28px;
  height: 1px;
  background: var(--wz-gold);
  opacity: 0.6;
}

.wz-title {
  margin: 0 0 28px;
  color: var(--wz-white);
  font-family: 'DM Serif Display', serif;
  font-size: clamp(42px, 6vw, 76px);
  line-height: 1.1;
}

.wz-title em,
.wz-section-title em,
.wz-cta-title em { color: var(--wz-gold); font-style: italic; }

.wz-hero-sub {
  max-width: 590px;
  margin: 0 auto 48px;
  color: var(--wz-soft-text);
  font-size: 17px;
  font-weight: 300;
  line-height: 1.7;
}

.wz-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.wz-btn-primary,
.wz-btn-ghost {
  border-radius: 8px;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.wz-btn-primary {
  padding: 14px 32px;
  background: var(--wz-gold);
  color: #ffffff;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.wz-btn-primary:hover {
  background: var(--wz-gold-light);
  box-shadow: 0 12px 28px rgba(var(--wz-primary-rgb), 0.25);
  transform: translateY(-2px);
}

.wz-btn-ghost {
  padding: 14px 32px;
  border: 1.5px solid var(--wz-line);
  color: var(--wz-text-body);
  font-weight: 500;
}

.wz-btn-ghost:hover {
  border-color: var(--wz-gold);
  color: var(--wz-gold);
}

.wz-scroll {
  position: absolute;
  bottom: 36px;
  left: 50%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
}

.wz-scroll span {
  color: var(--wz-text-dim);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wz-scroll div {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, rgba(var(--wz-primary-rgb), 0.55), transparent);
  animation: wzScrollPulse 2s ease-in-out infinite;
}

@keyframes wzScrollPulse {
  0%, 100% { opacity: 0.4; transform: scaleY(1); }
  50% { opacity: 1; transform: scaleY(1.15); }
}

.wz-section {
  padding: 100px 64px;
}

.wz-access {
  background: var(--wz-shell);
  border-top: 1px solid var(--wz-line);
  padding: 72px 64px;
}

.wz-access-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 48px;
  flex-wrap: wrap;
}

.wz-section-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: var(--wz-gold);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wz-section-eyebrow::before {
  content: "";
  width: 24px;
  height: 1px;
  background: var(--wz-gold);
  opacity: 0.6;
}

.wz-section-title,
.wz-cta-title {
  margin: 0 0 16px;
  color: var(--wz-ink);
  font-family: 'DM Serif Display', serif;
  font-size: clamp(30px, 3.5vw, 44px);
  line-height: 1.2;
}

.wz-section-body {
  max-width: 580px;
  color: var(--wz-text-body);
  font-size: 15px;
  font-weight: 300;
  line-height: 1.75;
}

.wz-access-copy { max-width: 430px; }
.wz-access-copy .wz-section-title { color: var(--wz-white); font-size: clamp(24px, 2.5vw, 34px); }
.wz-access-copy .wz-section-body { color: var(--wz-muted-on-shell); }
.wz-access-copy a { color: var(--wz-gold); text-decoration: none; border-bottom: 1px solid rgba(var(--wz-primary-rgb), 0.3); }

.wz-access-cards {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.wz-portal-card {
  width: 260px;
  min-height: 258px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 32px 28px;
  background: var(--wz-surface);
  border: 1.5px solid var(--wz-line);
  border-radius: 16px;
  color: inherit;
  overflow: hidden;
  position: relative;
  text-decoration: none;
  transition: all 0.25s ease;
}

.wz-portal-card::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--wz-gold);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}

.wz-portal-card:hover {
  border-color: rgba(var(--wz-primary-rgb), 0.5);
  background: var(--wz-surface-hover);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
  transform: translateY(-5px);
}

.wz-portal-card:hover::before { transform: scaleX(1); }

.wz-portal-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  margin-bottom: 20px;
  background: rgba(var(--wz-primary-rgb), 0.1);
  border: 1px solid rgba(var(--wz-primary-rgb), 0.2);
  border-radius: 12px;
  color: var(--wz-gold);
}

.wz-portal-label {
  margin-bottom: 8px;
  color: var(--wz-white);
  font-family: 'DM Serif Display', serif;
  font-size: 18px;
}

.wz-portal-desc {
  flex: 1;
  margin-bottom: 24px;
  color: var(--wz-muted-on-shell);
  font-size: 13px;
  font-weight: 300;
  line-height: 1.6;
}

.wz-portal-arrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--wz-gold);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: gap 0.2s;
}

.wz-portal-card:hover .wz-portal-arrow { gap: 12px; }

.wz-stats {
  background: var(--wz-shell);
  padding: 80px 64px;
}

.wz-center { text-align: center; }
.wz-center .wz-section-eyebrow { justify-content: center; }
.wz-center .wz-section-eyebrow::after {
  content: "";
  width: 24px;
  height: 1px;
  background: var(--wz-gold);
  opacity: 0.6;
}

.wz-stats .wz-section-title,
.wz-clients .wz-section-title,
.wz-cta .wz-section-title { color: var(--wz-white); }

.wz-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 56px;
  background: var(--wz-line);
  border: 1px solid var(--wz-line);
  border-radius: 16px;
  overflow: hidden;
}

.wz-stat-card {
  padding: 48px 36px;
  background: var(--wz-surface);
  box-shadow: inset 0 0 0 1px rgba(var(--wz-primary-rgb), 0.02);
  text-align: center;
  transition: background 0.2s;
}

.wz-stat-card:hover { background: var(--wz-surface-hover); }

.wz-stat-number {
  margin-bottom: 8px;
  color: var(--wz-gold);
  font-family: 'DM Serif Display', serif;
  font-size: 48px;
  line-height: 1;
}

.wz-stat-suffix {
  color: var(--wz-gold);
  font-family: 'DM Serif Display', serif;
  font-size: 24px;
}

.wz-stat-desc {
  margin-top: 8px;
  color: var(--wz-muted-on-shell);
  font-size: 13px;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

.wz-clients {
  background: var(--wz-shell);
  padding: 80px 64px;
}

.wz-client-title { margin-bottom: 56px; }

.wz-client-title .wz-section-eyebrow::before,
.wz-client-title .wz-section-eyebrow::after { display: none; }

.wz-logos-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  margin-bottom: 56px;
  background: var(--wz-line);
  border: 1px solid var(--wz-line);
  border-radius: 12px;
  overflow: hidden;
}

.wz-logo-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 28px;
  background: var(--wz-surface);
  transition: background 0.2s;
}

.wz-logo-cell:hover { background: var(--wz-surface-hover); }

.wz-logo-text {
  color: var(--wz-text-body);
  font-family: 'DM Serif Display', serif;
  font-size: 18px;
  letter-spacing: 0.05em;
  transition: color 0.2s;
}

.wz-logo-cell:hover .wz-logo-text { color: var(--wz-gold); }

.wz-testimonial {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
}

.wz-quote {
  margin-bottom: 24px;
  color: var(--wz-ink);
  font-family: 'DM Serif Display', serif;
  font-size: clamp(18px, 2vw, 24px);
  font-style: italic;
  line-height: 1.6;
}

.wz-author {
  color: var(--wz-gold);
  font-size: 13px;
  letter-spacing: 0.05em;
}

.wz-company {
  margin-top: 4px;
  color: var(--wz-text-dim);
  font-size: 12px;
}

.wz-cta {
  background: var(--wz-shell);
  padding: 100px 64px;
  position: relative;
  overflow: hidden;
}

.wz-cta-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(var(--wz-primary-rgb), 0.13) 0%, transparent 70%);
}

.wz-cta-layout {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

.wz-cta-title {
  color: var(--wz-white);
  font-size: clamp(28px, 3vw, 44px);
}

.wz-cta-sub {
  margin-bottom: 36px;
  color: var(--wz-muted-on-shell);
  font-size: 15px;
  font-weight: 300;
  line-height: 1.75;
}

.wz-check-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wz-check {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--wz-muted-on-shell);
  font-size: 14px;
}

.wz-check-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(var(--wz-primary-rgb), 0.3);
  border-radius: 50%;
  background: rgba(var(--wz-primary-rgb), 0.15);
  color: var(--wz-gold);
  flex-shrink: 0;
}

.wz-contact-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 36px;
}

.wz-contact-links a {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--wz-muted-on-shell);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.2s;
}

.wz-contact-links a:hover { color: var(--wz-gold); }

.wz-form-card,
.wz-success-card {
  background: var(--wz-surface);
  border: 1.5px solid var(--wz-line);
  border-radius: 20px;
  padding: 40px 36px;
}

.wz-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.wz-field { margin-bottom: 16px; }

.wz-field label {
  display: block;
  margin-bottom: 7px;
  color: var(--wz-text-dim);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.wz-field input,
.wz-field select,
.wz-field textarea {
  width: 100%;
  padding: 11px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: var(--wz-white);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.wz-field input::placeholder,
.wz-field textarea::placeholder { color: rgba(255, 255, 255, 0.26); }

.wz-field select option { background: var(--wz-ink-2); }
.wz-field textarea { resize: vertical; min-height: 112px; }
.wz-field input:focus,
.wz-field select:focus,
.wz-field textarea:focus { border-color: rgba(var(--wz-primary-rgb), 0.5); }

.wz-error {
  margin-bottom: 14px;
  padding: 10px 14px;
  background: rgba(224, 112, 112, 0.08);
  border: 1px solid rgba(224, 112, 112, 0.2);
  border-radius: 6px;
  color: #e07070;
  font-size: 12px;
}

.wz-submit {
  width: 100%;
  padding: 14px;
  background: var(--wz-gold);
  border: none;
  border-radius: 10px;
  color: #ffffff;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: all 0.2s;
}

.wz-submit:hover { background: var(--wz-gold-light); }
.wz-submit:disabled { cursor: wait; opacity: 0.7; }

.wz-privacy {
  margin: 14px 0 0;
  color: var(--wz-text-dim);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.wz-privacy a { color: var(--wz-gold); text-decoration: none; }

.wz-success-card {
  padding: 48px 36px;
  background: rgba(46, 204, 143, 0.06);
  border-color: rgba(46, 204, 143, 0.2);
  text-align: center;
}

.wz-success-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  margin: 0 auto 20px;
  background: rgba(46, 204, 143, 0.1);
  border-radius: 50%;
  color: #2ecc8f;
}

.wz-success-title {
  margin-bottom: 10px;
  color: var(--wz-white);
  font-family: 'DM Serif Display', serif;
  font-size: 22px;
}

.wz-success-body {
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
  line-height: 1.65;
}

.wz-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 40px 64px;
  background: var(--wz-shell-2);
  border-top: 1px solid var(--wz-line);
}

.wz-footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wz-footer .wz-brand-mark {
  width: 22px;
  height: 22px;
  border-color: rgba(var(--wz-primary-rgb), 0.3);
}

.wz-footer .wz-brand-mark-inner {
  width: 8px;
  height: 8px;
  background: rgba(var(--wz-primary-rgb), 0.35);
}

.wz-footer-brand-name {
  color: var(--wz-text-body);
  font-family: 'DM Serif Display', serif;
  font-size: 16px;
}

.wz-footer-brand-name span { color: var(--wz-gold); }

.wz-footer-copy {
  color: var(--wz-text-dim);
  font-size: 12px;
}

.wz-footer-links {
  display: flex;
  gap: 24px;
}

.wz-footer-links a {
  color: rgba(255, 255, 255, 0.25);
  font-size: 12px;
  text-decoration: none;
  transition: color 0.15s;
}

.wz-footer-links a:hover { color: var(--wz-gold); }

.wz-reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.65s ease, transform 0.65s ease;
}

.wz-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

.wz-delay-1 { transition-delay: 0.1s; }
.wz-delay-2 { transition-delay: 0.2s; }
.wz-delay-3 { transition-delay: 0.3s; }

@media (max-width: 1024px) {
  .wz-nav { padding: 0 32px; }
  .wz-nav-links { gap: 20px; }
  .wz-section,
  .wz-access,
  .wz-stats,
  .wz-clients,
  .wz-cta { padding-left: 32px; padding-right: 32px; }
  .wz-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .wz-logos-grid { grid-template-columns: repeat(3, 1fr); }
  .wz-cta-layout { grid-template-columns: 1fr; gap: 48px; }
}

@media (max-width: 760px) {
  .wz-nav { padding: 0 20px; }
  .wz-nav-links li:not(:last-child) { display: none; }
  .wz-hero { padding: 116px 22px 82px; }
  .wz-section,
  .wz-access,
  .wz-stats,
  .wz-clients,
  .wz-cta { padding-left: 22px; padding-right: 22px; }
  .wz-access-cards,
  .wz-portal-card { width: 100%; }
  .wz-stats-grid { grid-template-columns: 1fr; }
  .wz-logos-grid { grid-template-columns: repeat(2, 1fr); }
  .wz-form-grid { grid-template-columns: 1fr; gap: 0; }
  .wz-footer { flex-direction: column; text-align: center; }
  .wz-footer-links { flex-wrap: wrap; justify-content: center; }
}
`;

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  subject: "",
  message: "",
};

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll(".wz-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitContact = async (event) => {
    event.preventDefault();
    const values = Object.values(form).map((value) => value.trim());

    if (values.some((value) => !value)) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid work email address.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await postData("/contact-messages/", {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm(initialForm);
    } catch (apiError) {
      const data = apiError?.response?.data;
      const firstFieldError = data && typeof data === "object"
        ? Object.values(data).flat().filter(Boolean)[0]
        : null;
      setError(firstFieldError || "Message save nahi ho paya. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <main className="home-page">
        <header className={`wz-nav ${scrolled ? "scrolled" : ""}`}>
          <a href="/" className="wz-brand">
            <div className="wz-brand-mark"><div className="wz-brand-mark-inner" /></div>
            <span className="wz-brand-name">Work<span>Zen</span></span>
          </a>
          <ul className="wz-nav-links">
            <li><a href="#access-portal">Platform</a></li>
            <li><a href="#numbers">Solutions</a></li>
            <li><a href="#hero" className="active">About</a></li>
            <li><a href="#customers">Customers</a></li>
            <li><a href="/login">Sign In</a></li>
            <li><a href="#contact" className="wz-nav-cta">Contact Us</a></li>
          </ul>
        </header>

        <section className="wz-hero" id="hero">
          <div className="wz-hero-bg" />
          <div className="wz-hero-grid" />
          <div className="wz-hero-content">
            <div className="wz-eyebrow wz-reveal visible">About WorkZen</div>
            <h1 className="wz-title wz-reveal visible wz-delay-1">
              Built for the enterprises<br />that <em>can't afford</em> to fail
            </h1>
            <p className="wz-hero-sub wz-reveal visible wz-delay-2">
              We build the operational backbone for demanding organizations where reliability,
              security, and performance are not features, they are requirements.
            </p>
            <div className="wz-actions wz-reveal visible wz-delay-3">
              <a href="/login" className="wz-btn-primary">Sign In</a>
              <a href="#contact" className="wz-btn-ghost">Contact Us</a>
            </div>
          </div>
        </section>

        <section className="wz-access" id="access-portal">
          <div className="wz-container wz-access-layout">
            <div className="wz-access-copy wz-reveal">
              <div className="wz-section-eyebrow">Access Portal</div>
              <h2 className="wz-section-title">
                Sign in to your<br /><em>WorkZen</em> workspace
              </h2>
              <p className="wz-section-body">
                Choose your account type below. Not sure which to use? <a href="#contact">Contact your admin.</a>
              </p>
            </div>

            <div className="wz-access-cards">
              {ACCESS_CARDS.map((card, index) => (
                <a href={card.href} className={`wz-portal-card wz-reveal wz-delay-${index + 1}`} key={card.title}>
                  <div className="wz-portal-icon">{card.icon}</div>
                  <div className="wz-portal-label">{card.title}</div>
                  <div className="wz-portal-desc">{card.body}</div>
                  <div className="wz-portal-arrow">
                    Sign In
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="wz-stats" id="numbers">
          <div className="wz-container">
            <div className="wz-center">
              <div className="wz-section-eyebrow wz-reveal">By the Numbers</div>
              <h2 className="wz-section-title wz-reveal wz-delay-1">
                Scale that speaks<br />for <em>itself</em>
              </h2>
            </div>
            <div className="wz-stats-grid">
              {STATS.map((stat, index) => (
                <div className={`wz-stat-card wz-reveal wz-delay-${index}`} key={stat.label}>
                  <div className="wz-stat-number">
                    {stat.value}<span className="wz-stat-suffix">{stat.suffix}</span>
                  </div>
                  <div className="wz-stat-desc">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wz-clients" id="customers">
          <div className="wz-container">
            <div className="wz-client-title wz-center">
              <div className="wz-section-eyebrow wz-reveal">Trusted By</div>
              <h2 className="wz-section-title wz-reveal wz-delay-1">
                Powering the world's<br />most <em>demanding</em> teams
              </h2>
            </div>
            <div className="wz-logos-grid wz-reveal">
              {CLIENTS.map((client) => (
                <div className="wz-logo-cell" key={client}>
                  <span className="wz-logo-text">{client}</span>
                </div>
              ))}
            </div>
            <div className="wz-testimonial wz-reveal">
              <div className="wz-quote">
                "WorkZen replaced six separate tools we were using. Our ops team now moves twice as fast,
                and our incident response time dropped by 70%."
              </div>
              <div className="wz-author">Michael Torres, VP of Engineering</div>
              <div className="wz-company">NorthBank Financial Group</div>
            </div>
          </div>
        </section>

        <section className="wz-cta" id="contact">
          <div className="wz-cta-bg" />
          <div className="wz-cta-grid" />
          <div className="wz-container wz-cta-layout">
            <div>
              <div className="wz-section-eyebrow wz-reveal">Get in Touch</div>
              <h2 className="wz-cta-title wz-reveal wz-delay-1">
                We'd love to<br /><em>hear from you</em>
              </h2>
              <p className="wz-cta-sub wz-reveal wz-delay-2">
                Have a question about WorkZen, pricing, integrations, or enterprise onboarding?
                Our team is here to help. Fill in the form and we'll get back to you within one business day.
              </p>

              <div className="wz-check-list wz-reveal wz-delay-3">
                {CONTACT_POINTS.map((point) => (
                  <div className="wz-check" key={point}>
                    <span className="wz-check-icon">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {point}
                  </div>
                ))}
              </div>

              <div className="wz-contact-links wz-reveal wz-delay-3">
                <a href="mailto:hello@workzen.io">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  hello@workzen.io
                </a>
                <a href="tel:+18005550100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11.01h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.84 8.17a16 16 0 0 0 6.99 6.99l1.52-1.52a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  +1 800 555 0100
                </a>
              </div>
            </div>

            <div className="wz-reveal wz-delay-2">
              {!submitted ? (
                <form className="wz-form-card" onSubmit={submitContact}>
                  <div className="wz-form-grid">
                    <div className="wz-field">
                      <label htmlFor="contactFirst">First Name</label>
                      <input id="contactFirst" name="firstName" value={form.firstName} onChange={updateForm} placeholder="James" />
                    </div>
                    <div className="wz-field">
                      <label htmlFor="contactLast">Last Name</label>
                      <input id="contactLast" name="lastName" value={form.lastName} onChange={updateForm} placeholder="Mercer" />
                    </div>
                  </div>
                  <div className="wz-field">
                    <label htmlFor="contactEmail">Work Email</label>
                    <input id="contactEmail" name="email" type="email" value={form.email} onChange={updateForm} placeholder="james@company.com" />
                  </div>
                  <div className="wz-field">
                    <label htmlFor="contactSubject">Subject</label>
                    <select id="contactSubject" name="subject" value={form.subject} onChange={updateForm}>
                      <option value="">Select a topic</option>
                      <option value="pricing">Pricing and Plans</option>
                      <option value="integration">Integrations and API</option>
                      <option value="enterprise">Enterprise Onboarding</option>
                      <option value="support">Technical Support</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="wz-field">
                    <label htmlFor="contactMessage">Message</label>
                    <textarea id="contactMessage" name="message" rows="4" value={form.message} onChange={updateForm} placeholder="Tell us how we can help..." />
                  </div>
                  {error ? <div className="wz-error">{error}</div> : null}
                  <button className="wz-submit" type="submit" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                  <p className="wz-privacy">
                    By submitting, you agree to our <a href="#contact">Privacy Policy</a>. We'll never share your data.
                  </p>
                </form>
              ) : (
                <div className="wz-success-card">
                  <div className="wz-success-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="wz-success-title">Message received!</div>
                  <div className="wz-success-body">
                    Thanks for reaching out. Our team will get back to you within 1 business day.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="wz-footer">
          <div className="wz-footer-brand">
            <div className="wz-brand-mark"><div className="wz-brand-mark-inner" /></div>
            <span className="wz-footer-brand-name">Work<span>Zen</span></span>
          </div>
          <span className="wz-footer-copy">&copy; 2026 WorkZen Inc. All rights reserved.</span>
          <div className="wz-footer-links">
            <a href="#contact">Privacy Policy</a>
            <a href="#contact">Terms of Use</a>
            <a href="#numbers">Security</a>
            <a href="#contact">Contact</a>
          </div>
        </footer>
      </main>
    </>
  );
}
