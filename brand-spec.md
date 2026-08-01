# Toby Tang Portfolio Brand Specification

## Brand idea

The portfolio presents Toby as a multidisciplinary product designer who turns particles, systems, and visual craft into shipped experiences. The interaction system follows one narrative: **From Particle to Product**.

## Existing identity assets

- Wordmark: `TOBY TANG`, set in Anybody, heavy weight.
- Hero world: the pixel-city video in `hero-bg.mp4`.
- Portrait: `assets/images/toby-tang-headshot.webp`.
- Project imagery: the WebP files in `assets/images/` remain the primary proof and should not be obscured by effects.

## Visual tokens

- Navy base: `#0c1445`.
- Pool cyan: `#00d4ff`.
- Mint: `#5eead4`.
- Sunset purple: `#c084fc`.
- Coral: `#ff6b7f`.
- Cream text: `#fff5eb`.
- Display: Anybody. Body: Outfit. Technical labels: Space Mono.
- Cards use 6–12 px radii, thin translucent borders, and restrained shadows. Glow is reserved for the Hero flow, the active capability, and the Featured Product Case.

## Motion language

- Hero: a quiet, mist-like particle current drifts through loose Product, UX, Game, and VFX formations. Modes morph slowly without visible geometry guides; pointer and touch create a soft current rather than a hard collision. Scrolling gathers the field into a broad, staggered handoff above the featured project.
- Tools: the technology list uses one low-contrast, continuous horizontal marquee. It pauses on hover, the global Pause Motion control, and `prefers-reduced-motion`.
- Expertise: Product uses a grid, UX uses connected nodes, Game uses trajectories, and VFX uses energy ripples.
- Projects: AI uses agent nodes, Game uses sparks, VFX uses a shockwave, and Calligraphy × 3D uses ink diffusion.
- Effects are short, input-driven, and idle at zero animation frames. Mouse, touch, and keyboard focus receive equivalent responses.
- Respect `prefers-reduced-motion`; the Pause Motion control stops the Hero video and all Canvas animation.

### P3 motion specification

| Token | Value | Use |
| --- | --- | --- |
| Fast | `160ms` | Color, opacity, underline, and focus feedback |
| Base | `280ms` | Small transforms, borders, shadows, and control state changes |
| Slow | `520ms` | Navigation, media transitions, and section reveals |
| Effect | `720ms` | Standard one-shot Canvas responses |
| Effect long | `960ms` | Organic diffusion, ripples, and ink-like responses |
| Morph | `1040ms` | Hero formations and other deliberate state-to-state transformations |

- Use `cubic-bezier(.22, 1, .36, 1)` as the primary easing. Linear easing is reserved for the Tools marquee; particle springs and smootherstep interpolation are reserved for generative formations.
- Use three viewport triggers: **near** (`threshold: 0`, `rootMargin: 100px`) for resource preparation, **reveal** (`threshold: .18`, bottom margin `-18%`) for one-shot content entry, and **commit** (`threshold: .62`, once per item) for coarse-pointer previews. The Hero scroll handoff remains a separate narrative timeline.
- Color feedback is semantic: Pool cyan for global actions and focus, Mint for Product and shipped states, Sunset purple for Game, Coral for VFX and energy, and Cream for neutral selection. Strengthen the existing semantic color before adding glow or a new hue.

| Profile | Frame rate | Canvas DPR | Hero particles | Default use |
| --- | ---: | ---: | ---: | --- |
| Full | `60fps` | up to `1.5` | `120–150` | Healthy desktop and fine-pointer devices |
| Lite | `30fps` | `1` | `42–56` | Screens up to 900 px, coarse pointers, or limited hardware |
| Static | `0fps` | up to `1` | `24–32`, drawn once | Reduced motion, Save-Data, or sustained low performance |

- Profiles may only step down during a session. Mobile starts in Lite: avoid hover-only behavior, keep touch and keyboard responses equivalent, run no more than one local effect at once, and remove secondary continuous motion before hiding content.
- Pause video, Canvas, and the Tools marquee outside the **near** range and whenever the page is hidden, the menu or lightbox is open, or the user pauses motion. Resume only visible instances. Temporary background or user pauses remain distinct from the persistent Static profile.
- `prefers-reduced-motion` always selects Static, replaces scroll animation with immediate state changes, and preserves a clear still composition rather than an empty effect layer.

## Guardrails

- Never place decorative effects above readable copy or project labels.
- Keep project screenshots visually dominant.
- Avoid adding new glow, pill, or looping-animation styles unless they replace an existing one.
- Keep Hero particles low-contrast and organic: no permanent grids, straight connection networks, synchronized pulsing, or tightly collapsed landing points.
- Maintain a 44 px target for interactive controls and a visible focus indicator.
