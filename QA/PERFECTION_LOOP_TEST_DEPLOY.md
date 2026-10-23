# JC test deployment — Perfection Loop

This branch is a **non-production test candidate**. It does not deploy the live website or release a desktop installer.

## Initial verification

- Source: `main` at `960c96a1d3a5a32d6e01596c1426d94cb0a39f97`.
- Electron and Three.js are present in the source.
- `package.json` does not currently define `npm test`.
- Sprite batch 0001–0012 is documented as **0/12 verified**.
- Runtime, Godot import, performance, gameplay, and full regression tests have **not** passed or been run as part of this branch creation.

## Safe smoke-test instructions

1. On a disposable test environment, check out this branch.
2. Install dependencies using the repository lockfile if present.
3. Run `npm run electron:pack` only after reviewing dependency scripts and build environment.
4. Launch the packaged Electron app in an isolated desktop environment.
5. Verify boot/menu, 3D scene load, movement, input, mission flow, save/reload, and exit behavior.
6. Record results, hardware, logs, and reproduction steps.
7. Keep this branch separate from `main` until acceptance tests pass.

**Release gate:** No production promotion or claims of a successful deployment without recorded test evidence.
