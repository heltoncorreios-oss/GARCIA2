import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// 1. DASHBOARD: 3D Glossy Blue Monitor with Bar Chart & Pie Chart
export const Icon3DDashboard: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-dashboard" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="db-frame" x1="14" y1="8" x2="86" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0ea5e9" />
        <stop offset="0.5" stopColor="#0284c7" />
        <stop offset="1" stopColor="#03457a" />
      </linearGradient>
      <linearGradient id="db-screen" x1="18" y1="12" x2="82" y2="54" gradientUnits="userSpaceOnUse">
        <stop stopColor="#07192f" />
        <stop offset="1" stopColor="#020b16" />
      </linearGradient>
      <linearGradient id="db-bar1" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#38bdf8" />
        <stop offset="1" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="db-bar2" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#00f0ff" />
        <stop offset="1" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="db-pie-slice" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#00e5ff" />
        <stop offset="1" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="db-stand" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#38bdf8" />
        <stop offset="1" stopColor="#034980" />
      </linearGradient>
    </defs>

    {/* Monitor Stand Base */}
    <ellipse cx="50" cy="74" rx="20" ry="4.5" fill="url(#db-stand)" filter="url(#glow-dashboard)" opacity="0.8" />
    <path d="M 45 56 L 55 56 L 53 72 L 47 72 Z" fill="url(#db-stand)" />

    {/* Monitor Outer Glow Frame */}
    <rect
      x="13"
      y="8"
      width="74"
      height="50"
      rx="9"
      fill="url(#db-frame)"
      stroke="#38bdf8"
      strokeWidth="2"
      filter="url(#glow-dashboard)"
    />

    {/* Inner Screen */}
    <rect x="17" y="12" width="66" height="42" rx="6" fill="url(#db-screen)" />

    {/* Chart Bars */}
    <rect x="23" y="32" width="7" height="17" rx="2" fill="url(#db-bar1)" />
    <rect x="33" y="22" width="7" height="27" rx="2" fill="url(#db-bar2)" />
    <rect x="43" y="27" width="7" height="22" rx="2" fill="url(#db-bar1)" />

    {/* 3D Pie Chart */}
    <g transform="translate(63, 33)">
      <circle cx="0" cy="0" r="12" fill="#0369a1" />
      {/* 3/4 pie body */}
      <path d="M 0 0 L 0 -12 A 12 12 0 1 1 -12 0 Z" fill="url(#db-pie-slice)" />
      {/* 1/4 offset slice */}
      <path
        d="M -2 -2 L -2 -13 A 12 12 0 0 0 -13 -2 Z"
        fill="#38bdf8"
        stroke="#e0f2fe"
        strokeWidth="0.5"
      />
    </g>

    {/* Screen Gloss Highlights */}
    <path
      d="M 17 12 L 83 12 L 40 40 L 17 30 Z"
      fill="white"
      opacity="0.06"
      style={{ pointerEvents: 'none' }}
    />
  </svg>
);

// 2. SALDO CONSOLIDADO: 3D Golden Classical Bank with Gold Coins ($)
export const Icon3DSaldoConsolidado: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="gold-bright" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#fef08a" />
        <stop offset="0.5" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="gold-column" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#fde68a" />
        <stop offset="0.3" stopColor="#fffbeb" />
        <stop offset="0.7" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#92400e" />
      </linearGradient>
      <linearGradient id="gold-pediment" x1="50" y1="8" x2="50" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fef08a" />
        <stop offset="0.4" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="coin-face" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fef08a" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
    </defs>

    {/* Ambient Gold Glow */}
    <circle cx="50" cy="40" r="30" fill="#f59e0b" filter="url(#glow-gold)" opacity="0.15" />

    {/* Pediment (Triangular Roof) */}
    <path
      d="M 50 8 L 82 24 L 18 24 Z"
      fill="url(#gold-pediment)"
      stroke="#fef08a"
      strokeWidth="1.5"
      filter="url(#glow-gold)"
    />

    {/* Architrave Beam */}
    <rect x="16" y="24" width="68" height="6" rx="2" fill="url(#gold-bright)" stroke="#fef08a" strokeWidth="1" />

    {/* 3 Columns */}
    {/* Column 1 */}
    <rect x="24" y="30" width="10" height="26" rx="1.5" fill="url(#gold-column)" />
    <rect x="22" y="29.5" width="14" height="2.5" rx="1" fill="#fef08a" />
    <rect x="22" y="54" width="14" height="2.5" rx="1" fill="#fef08a" />

    {/* Column 2 */}
    <rect x="45" y="30" width="10" height="26" rx="1.5" fill="url(#gold-column)" />
    <rect x="43" y="29.5" width="14" height="2.5" rx="1" fill="#fef08a" />
    <rect x="43" y="54" width="14" height="2.5" rx="1" fill="#fef08a" />

    {/* Column 3 */}
    <rect x="66" y="30" width="10" height="26" rx="1.5" fill="url(#gold-column)" />
    <rect x="64" y="29.5" width="14" height="2.5" rx="1" fill="#fef08a" />
    <rect x="64" y="54" width="14" height="2.5" rx="1" fill="#fef08a" />

    {/* Base Steps */}
    <rect x="15" y="56" width="70" height="5" rx="1.5" fill="url(#gold-bright)" />
    <rect x="11" y="61" width="78" height="6" rx="2" fill="url(#gold-pediment)" stroke="#fef08a" strokeWidth="0.8" />

    {/* Stack of Gold Coins on the Front-Right */}
    <g transform="translate(10, 0)">
      {/* Coin 1 - Lower */}
      <ellipse cx="68" cy="67" rx="12" ry="4.5" fill="#92400e" />
      <path d="M 56 67 A 12 4.5 0 0 0 80 67 v 3 A 12 4.5 0 0 1 56 70 Z" fill="#b45309" />
      <ellipse cx="68" cy="67" rx="11.5" ry="4" fill="url(#coin-face)" stroke="#fef08a" strokeWidth="0.5" />

      {/* Coin 2 - Middle */}
      <path d="M 56 63 A 12 4.5 0 0 0 80 63 v 3 A 12 4.5 0 0 1 56 66 Z" fill="#b45309" />
      <ellipse cx="68" cy="63" rx="11.5" ry="4" fill="url(#coin-face)" stroke="#fef08a" strokeWidth="0.5" />

      {/* Coin 3 - Top with $ Emblem */}
      <circle
        cx="68"
        cy="55"
        r="10.5"
        fill="url(#coin-face)"
        stroke="#fef08a"
        strokeWidth="1.5"
        filter="url(#glow-gold)"
      />
      <circle cx="68" cy="55" r="8.5" fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.8" />
      <text
        x="68"
        y="59"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fontFamily="sans-serif"
        fill="#fef08a"
        style={{ filter: 'drop-shadow(0 1px 1px #78350f)' }}
      >
        $
      </text>
    </g>
  </svg>
);

// 3. MOVIMENTAÇÕES: 3D Blue Card with Bullet List & Opposing Dual Arrows (Green Right, Cyan Left)
export const Icon3DMovimentacoes: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="mov-card" x1="14" y1="10" x2="82" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0284c7" />
        <stop offset="0.6" stopColor="#0369a1" />
        <stop offset="1" stopColor="#075985" />
      </linearGradient>
      <linearGradient id="mov-arrow-green" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="mov-arrow-cyan" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#0284c7" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
    </defs>

    {/* Card Base */}
    <rect
      x="15"
      y="12"
      width="68"
      height="58"
      rx="12"
      fill="url(#mov-card)"
      stroke="#38bdf8"
      strokeWidth="2"
      filter="url(#glow-cyan)"
    />

    {/* Card Folded Corner Top Right */}
    <path d="M 69 12 L 83 26 L 69 26 Z" fill="#38bdf8" />
    <path d="M 69 26 L 83 26 L 69 12 Z" fill="#075985" opacity="0.4" />

    {/* Bullet List Lines on Left */}
    <circle cx="27" cy="27" r="3" fill="#38bdf8" />
    <rect x="34" y="25" width="18" height="4" rx="2" fill="#bae6fd" />

    <circle cx="27" cy="40" r="3" fill="#38bdf8" />
    <rect x="34" y="38" width="15" height="4" rx="2" fill="#bae6fd" />

    <circle cx="27" cy="53" r="3" fill="#38bdf8" />
    <rect x="34" y="51" width="12" height="4" rx="2" fill="#bae6fd" />

    {/* Top 3D Arrow: Vibrant Emerald Green pointing RIGHT */}
    <g filter="url(#glow-cyan)">
      <path
        d="M 52 30 L 68 30 L 68 24 L 83 34 L 68 44 L 68 38 L 52 38 Z"
        fill="url(#mov-arrow-green)"
        stroke="#a7f3d0"
        strokeWidth="0.8"
      />
    </g>

    {/* Bottom 3D Arrow: Vibrant Cyan pointing LEFT */}
    <g filter="url(#glow-cyan)">
      <path
        d="M 76 50 L 60 50 L 60 44 L 45 54 L 60 64 L 60 58 L 76 58 Z"
        fill="url(#mov-arrow-cyan)"
        stroke="#cffafe"
        strokeWidth="0.8"
      />
    </g>
  </svg>
);

// 4. IMPORTAR EXTRATO: 3D White Document Sheet with Glowing Blue Cloud & Green Up-Arrow
export const Icon3DImportarExtrato: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="imp-doc" x1="20" y1="8" x2="72" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#f1f5f9" />
        <stop offset="1" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id="imp-cloud" x1="40" y1="42" x2="88" y2="74" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" />
        <stop offset="0.6" stopColor="#0284c7" />
        <stop offset="1" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="imp-arrow" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#4ade80" />
        <stop offset="0.5" stopColor="#22c55e" />
        <stop offset="1" stopColor="#15803d" />
      </linearGradient>
    </defs>

    {/* Background Document Sheet */}
    <path
      d="M 22 10 L 60 10 L 74 24 L 74 66 L 22 66 Z"
      fill="url(#imp-doc)"
      stroke="#94a3b8"
      strokeWidth="1.5"
      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
    />
    {/* Folded Dog-Ear Top Right */}
    <path d="M 60 10 L 60 24 L 74 24 Z" fill="#94a3b8" />
    <path d="M 60 24 L 74 24 L 60 10 Z" fill="#cbd5e1" opacity="0.6" />

    {/* Text Lines on Document */}
    <rect x="28" y="24" width="24" height="4" rx="2" fill="#94a3b8" />
    <rect x="28" y="32" width="28" height="4" rx="2" fill="#94a3b8" />
    <rect x="28" y="40" width="16" height="4" rx="2" fill="#94a3b8" />
    <rect x="28" y="48" width="18" height="4" rx="2" fill="#94a3b8" />

    {/* 3D Cyan/Blue Cloud */}
    <g filter="url(#glow-green)">
      {/* Cloud Base Lobes */}
      <path
        d="M 46 64 C 42 64 38 60 40 54 C 40 48 45 44 51 45 C 53 38 61 35 68 38 C 74 34 83 38 83 45 C 88 47 90 53 87 58 C 89 62 85 66 80 66 C 75 66 48 66 46 64 Z"
        fill="url(#imp-cloud)"
        stroke="#38bdf8"
        strokeWidth="1.5"
      />
    </g>

    {/* 3D Emerald Green Up-Arrow */}
    <g filter="url(#glow-green)">
      <path
        d="M 64 36 L 75 48 L 69 48 L 69 64 L 59 64 L 59 48 L 53 48 Z"
        fill="url(#imp-arrow)"
        stroke="#bbf7d0"
        strokeWidth="1"
      />
    </g>
  </svg>
);

// 5. RELATÓRIOS: 3D Purple Document Sheet with Bar Charts & Front-Overlapping Pie Chart
export const Icon3DRelatorios: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="rel-doc" x1="16" y1="10" x2="80" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7" />
        <stop offset="0.6" stopColor="#7e22ce" />
        <stop offset="1" stopColor="#581c87" />
      </linearGradient>
      <linearGradient id="rel-bar" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#f0abfc" />
        <stop offset="1" stopColor="#c026d3" />
      </linearGradient>
      <linearGradient id="rel-pie1" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#e879f9" />
        <stop offset="1" stopColor="#9333ea" />
      </linearGradient>
      <linearGradient id="rel-pie2" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#38bdf8" />
        <stop offset="1" stopColor="#0284c7" />
      </linearGradient>
    </defs>

    {/* Purple Document Sheet with Folded Corner */}
    <path
      d="M 18 12 L 60 12 L 74 26 L 74 68 L 18 68 Z"
      fill="url(#rel-doc)"
      stroke="#e879f9"
      strokeWidth="2"
      filter="url(#glow-purple)"
    />
    <path d="M 60 12 L 60 26 L 74 26 Z" fill="#e879f9" />
    <path d="M 60 26 L 74 26 L 60 12 Z" fill="#581c87" opacity="0.4" />

    {/* Horizontal Heading Bar */}
    <rect x="25" y="24" width="26" height="4" rx="2" fill="#f5d0fe" />

    {/* Bar Charts on Document */}
    <rect x="25" y="44" width="7" height="17" rx="2" fill="url(#rel-bar)" />
    <rect x="36" y="34" width="7" height="27" rx="2" fill="url(#rel-bar)" />
    <rect x="47" y="40" width="7" height="21" rx="2" fill="url(#rel-bar)" />

    {/* Overlapping Front 3D Pie Chart */}
    <g transform="translate(72, 57)" filter="url(#glow-purple)">
      {/* Outer Glow Disc */}
      <circle cx="0" cy="0" r="15" fill="#3b0764" stroke="#e879f9" strokeWidth="1" />
      {/* Purple Sector */}
      <path d="M 0 0 L 0 -14 A 14 14 0 1 1 -14 0 Z" fill="url(#rel-pie1)" />
      {/* Cyan/Lavender Sector */}
      <path
        d="M -1.5 -1.5 L -1.5 -15 A 14 14 0 0 0 -15 -1.5 Z"
        fill="url(#rel-pie2)"
        stroke="#bae6fd"
        strokeWidth="0.8"
      />
    </g>
  </svg>
);

// 6. ADMINISTRAÇÃO: 3D Purple/Violet Cogwheel Gear with Stylized Avatar User Silhouette
export const Icon3DAdministracao: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-admin" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="gear-purple" x1="15" y1="10" x2="85" y2="75" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7" />
        <stop offset="0.5" stopColor="#7e22ce" />
        <stop offset="1" stopColor="#4c1d95" />
      </linearGradient>
      <linearGradient id="gear-rim" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#c084fc" />
        <stop offset="1" stopColor="#581c87" />
      </linearGradient>
      <linearGradient id="user-avatar" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#ffffff" />
        <stop offset="1" stopColor="#e2e8f0" />
      </linearGradient>
    </defs>

    {/* 8-Teeth Gear Cogwheel */}
    <g filter="url(#glow-admin)">
      <path
        d="
          M 44 14 L 56 14 L 58 22 A 25 25 0 0 1 67 27 L 74 22 L 82 30 L 77 37 A 25 25 0 0 1 81 47 L 89 49 L 89 61 L 81 63 A 25 25 0 0 1 77 72 L 82 80 L 74 87 L 67 82 A 25 25 0 0 1 58 87 L 56 95 L 44 95 L 42 87 A 25 25 0 0 1 33 82 L 26 87 L 18 80 L 23 72 A 25 25 0 0 1 19 63 L 11 61 L 11 49 L 19 47 A 25 25 0 0 1 23 37 L 18 30 L 26 22 L 33 27 A 25 25 0 0 1 42 22 Z
        "
        transform="translate(0, -12) scale(0.9) translate(5, 5)"
        fill="url(#gear-purple)"
        stroke="#c084fc"
        strokeWidth="2"
      />
    </g>

    {/* Center Aperture Hole */}
    <circle cx="50" cy="42" r="16.5" fill="#1e1035" stroke="#c084fc" strokeWidth="1.5" />

    {/* User Avatar Silhouette inside Gear */}
    {/* Head */}
    <circle
      cx="50"
      cy="36"
      r="6.5"
      fill="url(#user-avatar)"
      filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
    />
    {/* Shoulders / Torso */}
    <path
      d="M 39 52 C 39 46 44 44 50 44 C 56 44 61 46 61 52 C 61 53 60 54 59 54 L 41 54 C 40 54 39 53 39 52 Z"
      fill="url(#user-avatar)"
      filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
    />
  </svg>
);

// 7. SAIR DO SISTEMA: 3D Crimson Red Door Portal Bracket with 3D Arrow Emerging Right
export const Icon3DSairDoSistema: React.FC<IconProps> = ({ className = 'w-9 h-9', size }) => (
  <svg
    viewBox="0 0 100 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: (size * 85) / 100 } : undefined}
  >
    <defs>
      <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="exit-door" x1="20" y1="12" x2="60" y2="72" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f87171" />
        <stop offset="0.5" stopColor="#ef4444" />
        <stop offset="1" stopColor="#991b1b" />
      </linearGradient>
      <linearGradient id="exit-arrow" x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#fca5a5" />
        <stop offset="0.4" stopColor="#ef4444" />
        <stop offset="1" stopColor="#b91c1c" />
      </linearGradient>
    </defs>

    {/* Door Frame Bracket Portal Shape `[` */}
    <g filter="url(#glow-red)">
      <path
        d="M 54 18 L 30 18 C 24 18 20 22 20 28 L 20 58 C 20 64 24 68 30 68 L 54 68"
        fill="none"
        stroke="url(#exit-door)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>

    {/* Bold 3D Red Arrow Emerging Right `→` */}
    <g filter="url(#glow-red)">
      <path
        d="M 38 39 L 60 39 L 60 30 L 80 43 L 60 56 L 60 47 L 38 47 Z"
        fill="url(#exit-arrow)"
        stroke="#fecaca"
        strokeWidth="1.2"
        filter="drop-shadow(0 3px 5px rgba(0,0,0,0.5))"
      />
    </g>
  </svg>
);

// SMALL CAPSULE BADGE ICONS (Exact miniature icons seen inside the capsule pills of the reference image)
export const BadgeIconDashboard: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" fill="#38bdf8" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" fill="#38bdf8" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" fill="#38bdf8" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" fill="#38bdf8" />
  </svg>
);

export const BadgeIconSaldo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M 12 3 L 21 8 L 3 8 Z" fill="#fbbf24" />
    <rect x="2" y="8" width="20" height="2" rx="0.5" fill="#f59e0b" />
    <rect x="4.5" y="11" width="3" height="7" rx="0.5" fill="#fbbf24" />
    <rect x="10.5" y="11" width="3" height="7" rx="0.5" fill="#fbbf24" />
    <rect x="16.5" y="11" width="3" height="7" rx="0.5" fill="#fbbf24" />
    <rect x="2" y="19" width="20" height="2.5" rx="0.5" fill="#f59e0b" />
  </svg>
);

export const BadgeIconMovimentacoes: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M 20 8 A 8 8 0 0 0 5.5 5.5 L 4 4 M 4 4 L 4 9 L 9 9"
      stroke="#22d3ee"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 4 16 A 8 8 0 0 0 18.5 18.5 L 20 20 M 20 20 L 20 15 L 15 15"
      stroke="#22d3ee"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BadgeIconImportar: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M 6.5 18 C 4 18 2 16 2 13.5 C 2 11.2 3.6 9.3 5.8 9 C 6.5 6 9.2 4 12.5 4 C 16.5 4 19.8 6.8 20.3 10.7 C 21.9 11.4 23 13 23 14.8 C 23 17.1 21.1 19 18.8 19 L 16.5 19"
      stroke="#34d399"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 12 12 L 12 21 M 8.5 15.5 L 12 12 L 15.5 15.5"
      stroke="#4ade80"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BadgeIconRelatorios: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M 5 3 L 15 3 L 20 8 L 20 21 C 20 21.6 19.5 22 19 22 L 5 22 C 4.4 22 4 21.6 4 21 L 4 4 C 4 3.4 4.4 3 5 3 Z"
      fill="#a855f7"
      fillOpacity="0.25"
      stroke="#c084fc"
      strokeWidth="1.8"
    />
    <path d="M 15 3 L 15 8 L 20 8" stroke="#c084fc" strokeWidth="1.8" />
    <path d="M 8 13 L 16 13 M 8 17 L 13 17" stroke="#e879f9" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const BadgeIconAdministracao: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M 12 15 C 13.6569 15 15 13.6569 15 12 C 15 10.3431 13.6569 9 12 9 C 10.3431 9 9 10.3431 9 12 C 9 13.6569 10.3431 15 12 15 Z"
      fill="#c084fc"
    />
    <path
      d="M 19.4 15 A 1.65 1.65 0 0 0 19.7 16.8 L 19.8 16.9 A 2 2 0 0 1 17 19.7 L 16.9 19.6 A 1.65 1.65 0 0 0 15 19.4 A 1.65 1.65 0 0 0 14.1 20.9 L 14.1 21 A 2 2 0 0 1 10.1 21 L 10.1 20.9 A 1.65 1.65 0 0 0 9 19.4 A 1.65 1.65 0 0 0 7.2 19.7 L 7.1 19.8 A 2 2 0 0 1 4.3 17 L 4.4 16.9 A 1.65 1.65 0 0 0 4.6 15 A 1.65 1.65 0 0 0 3.1 14.1 L 3 14.1 A 2 2 0 0 1 3 10.1 L 3.1 10.1 A 1.65 1.65 0 0 0 4.6 9 A 1.65 1.65 0 0 0 4.3 7.2 L 4.2 7.1 A 2 2 0 0 1 7 4.3 L 7.1 4.4 A 1.65 1.65 0 0 0 9 4.6 A 1.65 1.65 0 0 0 9.9 3.1 L 9.9 3 A 2 2 0 0 1 13.9 3 L 13.9 3.1 A 1.65 1.65 0 0 0 15 4.6 A 1.65 1.65 0 0 0 16.8 4.3 L 16.9 4.2 A 2 2 0 0 1 19.7 7 L 19.6 7.1 A 1.65 1.65 0 0 0 19.4 9 A 1.65 1.65 0 0 0 20.9 9.9 L 21 9.9 A 2 2 0 0 1 21 13.9 L 20.9 13.9 A 1.65 1.65 0 0 0 19.4 15 Z"
      stroke="#a855f7"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BadgeIconSair: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M 12 4 L 5 4 C 3.9 4 3 4.9 3 6 L 3 18 C 3 19.1 3.9 20 5 20 L 12 20"
      stroke="#ef4444"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 9 12 L 21 12 M 16 7 L 21 12 L 16 17"
      stroke="#f87171"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

