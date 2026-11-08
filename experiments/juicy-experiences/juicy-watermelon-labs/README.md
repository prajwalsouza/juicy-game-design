# Juicy Watermelon Lab

A single-file Three.js playground for slicing, squishing, and splashing a watermelon.

[Play the lab](https://juicy-games.github.io/experiments/juicy-experiences/juicy-watermelon-labs/)

## Play

- **Simple** loads by default: tap or swipe to slice, or hold the fruit to squish it before releasing.
- **Advanced** explores a coarse soft-body model with partial cuts and tissue bridges.
- Use the bottom mode switch to start a fresh fruit in either mode.
- The pen icon opens the feel controls; the refresh icon clears the board.
- Keyboard: focus the cutting board and press Enter or Space to slice. Escape closes the controls.

The board is limited to 12 fruit pieces and 11 cuts. Droplets, wet patches, and crumbs use bounded rendering pools. The FPS readout reports local rendering performance.

## Run locally

Serve this directory with a static HTTP server, then open its `index.html`. There is no build step. Three.js 0.180.0 loads from jsDelivr, and Poppins loads from Google Fonts, so the first load needs internet access. There are no analytics, accounts, API keys, or application data uploads.

## Implementation

The source stays in `index.html`: interface styles, scene setup, geometry, liquid effects, simulation, and input handling. Simple uses spring-driven squash and stretch with rigid contact handling. Advanced uses coarse XPBD distance/volume constraints, separate rind/flesh stiffness, and convex collision envelopes. Liquid uses particles and surface films; a volume-equivalent ledger tracks released juice and pulp.

These are interactive approximations, not calibrated watermelon mechanics or a full fluid/fracture solver. Advanced can retain small contact errors and motion in dense piles. Mode changes reset the scene; tuning stays available in the current session.

## Dependencies and attribution

- [Three.js](https://github.com/mrdoob/three), MIT license; pinned runtime version above.
- [Poppins](https://github.com/itfoundry/Poppins), SIL Open Font License.
- Embedded [Font Awesome Free](https://fontawesome.com/license/free) icons, CC BY 4.0; attribution is retained beside the SVGs.
- XPBD constraint formulation: [Macklin et al., 2016](https://mmacklin.com/xpbd.pdf).

The companion [Juicy Game Design guide](https://github.com/prajwalsouza/juicy-game-design/blob/main/JUICY_DESIGN.md) describes the feedback and potentiality ideas explored by these demos.
