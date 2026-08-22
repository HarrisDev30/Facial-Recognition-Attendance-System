# Apple Face ID-Style Biometric Registration UX with Dynamic Radial Ticks

We decided to elevate the student biometric enrollment experience to an Apple Face ID-style circular reticle featuring dynamic radial tick bars that grow and light up as the user rotates their head, combined with hands-free auto-locking and an interactive single-angle retake tray.

## Context
Biometric enrollment can feel intimidating or clunky for students if guidance is purely static text. Students frequently struggle with knowing how far to turn their head or if their face is properly centered, leading to failed submissions or low-quality embeddings.

## Considered Options
- **Static Multi-Step Form with Photo Upload**: Standard file upload inputs. (Rejected: prone to poor lighting, wrong poses, and spoofing).
- **Basic Square Camera Box with Polling Text**: A square webcam feed with text alerts at the bottom. (Rejected: feels dated and lacks immediate directional guidance).
- **Apple Face ID-Inspired Dynamic Circular Reticle with Growing Radial Bars**: A circular viewfinder surrounded by 36-48 dynamic radial tick marks that physically grow, extrude, and transition from translucent grey to electric emerald/cyan in real-time as the student rotates their head across yaw/pitch angles. Features hands-free auto-locking, subtle flash feedback, and a 1-tap single-angle retake carousel. (Accepted).

## Consequences
- Students receive real-time, tactile visual feedback on how far they need to turn their head as the radial notches fill in.
- Enrollment completion rate increases significantly due to intuitive, gamified visual guidance.
- Higher biometric quality scores for InsightFace Buffalo_L embeddings across the 6 poses.
- Frictionless mobile experience on iOS/Android browsers with camera access.
