# Product

## Register

product

## Users

Three primary roles + staff attendees:

- **Students** — University students attending events, checking in via face recognition, tracking attendance records, registering biometrics. On mobile and desktop.
- **Admins** — Department administrators managing events, sessions, attendees, scanner devices, and generating reports. Desktop-focused.
- **Marshals** — Event marshals operating face-recognition scanners during live sessions, performing manual check-ins and overrides. Web-based, often laptop or mobile.
- **Staff** — University staff who also attend events as participants, similar workflow to students but with department-specific scoping.

## Product Purpose

A face-recognition attendance management system for university events. Replaces manual roll-call and paper sign-in sheets with automated biometric check-in. Students enroll once (6-angle face capture), then scan at event sessions. The system tracks attendance per department for clearance verification.

Success looks like: students check in within 2 seconds of facing the scanner, marshals operate sessions without training, admins manage cross-department events without friction.

## Brand Personality

- **Professional** — University administrative tool, not a consumer app. Gravity and trustworthiness matter.
- **Clean** — Minimally designed, no decorative clutter. Every element serves a function.
- **Confident** — Dark theme, precise typography, intentional spacing. Feels like a premium SaaS product (Linear, Vercel dashboard).

## Anti-references

- Avoid student-project aesthetic (bright gradients, decorative illustrations, playful animations, rounded cards everywhere).
- Avoid Material Design 3 aesthetic (overly colorful, heavy shadows, floating action buttons).
- Avoid purple-to-blue AI-generated gradients.
- Avoid Inter as the only font without pairing.
- Avoid cards nested inside cards — prefer single-layer layouts.

## Design Principles

1. **Show, don't tell** — Users should understand their attendance standing at a glance without reading paragraphs.
2. **One task per screen** — Each page has one primary action (check in, view attendance, manage events).
3. **Confidence through precision** — Clean typography, intentional spacing, and consistent alignment signal reliability.
4. **Dark-first, never harsh** — Dark theme with muted accents; never pure white on pure black.
5. **Respect the user's time** — Check-in flow should take seconds. Navigation should require zero thinking.

## Accessibility & Inclusion

- Target WCAG AA minimum
- Dark theme contrast: text `#ededed` on `#171717` cards (passes AA at 12.4:1)
- All interactive elements keyboard-navigable
- Notification indicators use color + position (green dot), not color alone
- Respect `prefers-reduced-motion` — pulse animations and scale transforms should disable when set
