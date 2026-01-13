# NyayHub Visual Semantics Contract

> **Version**: 1.0.0  
> **Status**: LOCKED FOR BETA  
> **Last Updated**: 2026-01-13  
> **Authority**: This document is the single source of truth for NyayHub's visual semantics.

---

## 🔒 Change Control Policy

**Any future visual change to urgency states requires:**
1. At least 5 real lawyer feedback confirmations
2. Explicit confusion evidence between "danger" and "my turn"
3. A follow-up audit before rollout

**No experimentation is allowed during beta without evidence.**

No new meanings may be assigned to existing colors without user validation.

---

## Core Semantic Palette

### 🟡 Gold (`--court-gold`, `--primary`)
**HSL**: `43 96% 56%`

**REPRESENTS:**
- Authority and judicial gravitas
- Primary user actions (buttons, links, CTAs)
- Confirmed control and ownership
- Focus indicators and ring highlights
- Active selection states

**MUST NEVER REPRESENT:**
- Errors or destructive actions
- Warnings or caution states
- Informational messages
- Disabled or inactive states

---

### 🔴 Danger/Red Spectrum (`--court-danger`, `--court-danger-light`, `--destructive`)

| Token | HSL | Use Case |
|-------|-----|----------|
| `--court-danger` | `0 72% 25%` | Deep danger backgrounds |
| `--court-danger-light` | `0 84% 60%` | Danger borders, panic pulses |
| `--destructive` | `0 84% 32%` | Destructive button backgrounds |

**REPRESENTS:**
- Danger and irreversible states
- Panic alerts (case approaching imminently)
- Destructive actions (delete, cancel, revoke)
- System errors and failures
- Critical notifications requiring immediate attention

**MUST NEVER REPRESENT:**
- Success or completion
- Information or guidance
- Standard navigation
- Neutral status

---

### 🟠 Warning/Amber (`--court-warning`)
**HSL**: `38 92% 50%`

**REPRESENTS:**
- Caution and pending states
- Non-fatal attention requirements
- Lunch break / court recess indicators
- Supplementary list items
- Stale data warnings
- Network degradation (offline/slow)

**MUST NEVER REPRESENT:**
- Critical errors
- Success states
- Primary actions
- Authority signals

**⚠️ SEMANTIC LOAD WARNING:**  
Amber is currently at maximum semantic capacity. No additional meanings should be assigned without splitting into distinct tokens.

---

### 🟢 Success/Green (`--court-success`)
**HSL**: `142 76% 36%`

**REPRESENTS:**
- Completed states
- Safe/stable conditions
- Sync complete indicators
- Verified/confirmed data
- Network online status

**MUST NEVER REPRESENT:**
- In-progress states
- Warnings or caution
- Actions (use gold instead)
- Authority signals

---

### ⬜ Muted/Slate Spectrum

| Token | HSL | Use Case |
|-------|-----|----------|
| `--court-slate-900` | `222 47% 9%` | Primary background |
| `--court-slate-800` | `217 33% 12%` | Card backgrounds |
| `--court-slate-700` | `215 20% 20%` | Borders, dividers |
| `--muted-foreground` | `215 20% 65%` | Secondary text |

**REPRESENTS:**
- Informational/secondary content
- Inactive or disabled states
- Background structure
- Visual hierarchy (lower priority)

**MUST NEVER REPRESENT:**
- Active states
- Urgency
- Errors or success
- Primary content

---

## 🚨 Urgency Semantics (Critical)

### Semantic Separation: "My Turn" vs "Danger"

| State | Current Token | Semantic Token | Visual Appearance |
|-------|--------------|----------------|-------------------|
| PANIC (case imminent, 1-2 away) | `--court-danger-light` | `--court-danger-light` | Red pulse/border |
| MY CASE IS RUNNING | `--court-danger` | `--court-positive-urgency` | Red background gradient |
| SYSTEM ERROR | `--destructive` | `--destructive` | Red button/alert |

**Note**: `--court-positive-urgency` is currently mapped to the same visual as danger states. This semantic separation prepares for future visual distinction if user feedback indicates confusion.

---

## UI State Mappings

### Badge Variants (from badge.tsx)

| Variant | Semantic Meaning | Visual |
|---------|-----------------|--------|
| `default` | Primary/authority | Gold |
| `secondary` | Secondary info | Muted |
| `destructive` | Error/danger | Red |
| `outline` | Neutral | Border only |
| `gold` | Authority signal | Gold outline |
| `danger` | Danger state | Red outline |
| `success` | Completed | Green |
| `warning` | Caution | Amber |
| `supplementary` | Supplementary list | Amber |
| `running` | Case currently running | Red (uses `--court-positive-urgency`) |

### Button Variants (from button.tsx)

| Variant | Semantic Meaning |
|---------|-----------------|
| `default` | Primary action |
| `destructive` | Dangerous/irreversible action |
| `outline` | Secondary action |
| `ghost` | Tertiary/subtle action |
| `gold` | Authority/premium action |
| `danger` | Critical warning action |
| `court` | Court-specific action |
| `whisper` | Whisper/notification action |

---

## Animation Tokens

| Animation | Token Reference | Purpose |
|-----------|----------------|---------|
| `panic-pulse-once` | `--court-danger-light` | One-time attention grab for panic state |
| `status-running` | `--court-positive-urgency` | Running case indicator |
| `glow-pulse` | `--court-gold` | Authority/focus glow |
| `gold-glow` | `--court-gold` | Hover/focus enhancement |

---

## Glassmorphism Tokens

| Token | Purpose |
|-------|---------|
| `--glass` | Translucent card background |
| `--glass-foreground` | Text on glass surfaces |
| `--glass-border` | Subtle glass borders |

**Usage**: Glass effects MUST only be used for:
- Card backgrounds
- Overlay panels
- Modal surfaces
- Toolbar backgrounds

**MUST NOT** be used for:
- Status indicators
- Buttons
- Text areas
- Input fields

---

## 🚫 Prohibited Patterns

1. **No hardcoded colors in components**  
   All colors MUST reference CSS variables or Tailwind tokens.

2. **No semantic overloading**  
   Each color may only represent its documented meanings.

3. **No visual changes without this document being updated**  
   Any color change requires updating this contract first.

4. **No gradient or decorative additions**  
   The current flat/glass aesthetic is locked.

5. **No light mode implementation**  
   Dark mode is the only supported theme during beta.

---

## Future Evolution Guidelines

When (and only when) user feedback confirms confusion between "danger" and "my turn":

1. `--court-positive-urgency` may be visually differentiated
2. Recommended approach: Gold-tinted glow instead of pure red
3. Implementation requires 5+ lawyer confirmations
4. Changes must be announced before deployment

---

## Token Reference Quick-Sheet

```css
/* Authority / Action */
--primary: 43 96% 56%;          /* Gold */
--court-gold: 43 96% 56%;       /* Gold */

/* Danger / Urgency */
--court-danger: 0 72% 25%;       /* Deep red */
--court-danger-light: 0 84% 60%; /* Bright red */
--destructive: 0 84% 32%;        /* Destructive red */
--court-positive-urgency: 0 72% 25%; /* Running state (semantic alias) */

/* Caution */
--court-warning: 38 92% 50%;     /* Amber */

/* Success */
--court-success: 142 76% 36%;    /* Green */

/* Neutral / Background */
--court-slate-900: 222 47% 9%;   /* Background */
--court-slate-800: 217 33% 12%;  /* Card */
--court-slate-700: 215 20% 20%;  /* Border */
--muted-foreground: 215 20% 65%; /* Secondary text */
```

---

## Document History

| Date | Version | Change |
|------|---------|--------|
| 2026-01-13 | 1.0.0 | Initial semantic freeze for beta |

---

*This document is binding for all NyayHub development during the beta phase.*
