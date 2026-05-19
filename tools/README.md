# Tools

One-off Node scripts used to extract sprites from the Prison Architect tileset.
Not part of the runtime — moved here to keep the repo root clean.

Each script reads the PA tileset / atlas and writes WEBP frames into
`src/assets/textures/objects/`. They depend on `sharp` (already in
`devDependencies` of the root `package.json`).

Run from the project root, e.g.:

```
node tools/extract_pa_rotations.js
```
