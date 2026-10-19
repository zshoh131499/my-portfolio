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

## Motion enhancements layer (`assets/enhance.js`)

The enhancement layer sits on top of `motion.js` and borrows the vocabulary of award-winning typographic portfolios: smooth scrolling, masked text reveals, scroll-linked parallax, a cursor follower and magnetic controls. It never replaces the particle system and degrades to the CSS fallbacks when GSAP is unavailable.

- Libraries: GSAP 3.13 core, ScrollTrigger and SplitText, plus Lenis 1.3 for smooth scrolling. All are pinned CDN builds; `html.no-enhance` marks a page where they failed to load.
- **Base tier** (`html.is-enhanced`, any profile except Static): hero entrance choreography with masked headline lines, one-shot section reveals (titles split into masked lines on entry and reverted afterwards), project card wipe-ins, the experience timeline draw and the top scroll-progress line.
- **Rich tier** (`html.is-rich`, fine pointer and motion not paused): Lenis smooth scroll, hero exit parallax, thumbnail parallax (images are oversized by 18% so no edge shows), the cursor follower with `View` / `Open` labels, magnetic CTAs and the scroll-velocity-driven tools marquee.
- Pause Motion tears the rich tier down and restores native scrolling and the CSS marquee; Static and `prefers-reduced-motion` skip both tiers. Menu and lightbox open states stop Lenis so focus trapping keeps working.
- Reveals clear their inline styles on completion so the existing hover transforms keep working; hover zoom on thumbnails uses the `scale` property so it can coexist with GSAP transforms.
- Contact adds a local-time clock for the current base and a copy-to-clipboard control with visible and announced feedback; both work without GSAP.

## Hero fluid ink (`assets/fluid.js`)

A compact WebGL stable-fluids solver (advection, vorticity confinement, Jacobi pressure solve) renders brand-colored ink over the hero. Pointer movement injects velocity and dye; the ink swirls, dissolves over roughly six seconds and the loop sleeps shortly after the last input, so the layer idles at zero frames.

- Layering: the fluid canvas sits at z-index 3 between the particle field and the copy, blends with `screen`, and dims the particle field to 30% while active. Three intersecting masks keep the ink faint under the headline (left), away from the bright sun (centre) and off the CTAs (bottom), so it lives mostly in the dark sky and city on the right.
- Brightness is tone-mapped with a hard cap (`OPACITY`, 0.42) so overlapping strokes saturate instead of washing the hero white; single strokes land around 0.3. Raise `OPACITY` or soften the masks to make it louder.
- Palette follows the selected discipline pill (Product mint, UX pool, Game purple, VFX coral); switching a pill fires a short burst in the new color, and hovering a pill previews its palette.
- Profiles: Full runs a 128-cell simulation with a 720-wide dye buffer, Lite drops to 96 and 480, Static and reduced-motion never start it. A frame-time watchdog downgrades once and then disables the layer on slow GPUs.
- Pause Motion, hidden tabs, open menus and the lightbox freeze the current frame and resume where they left off; Static, reduced motion, coarse pointers, a lost context or a slow GPU tear the layer down and clear it. Touch pointers do not drive it.
