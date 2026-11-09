/** Asset contract. Null = the self-contained procedural edition. */
export const CONFIG = {
  assets: {
    // PRODUCTION: '/assets/models/pisces-electronica.glb'. Export rigid named parts;
    // apply transforms, triangulate, and bake 2K PBR maps. See ARCHITECTURE.md.
    fish: null,
    // PRODUCTION: '/assets/environment/underwater-studio.hdr' (linear HDR).
    environment: null,
    // PRODUCTION: '/assets/textures/corroded-metal-normal.webp' (non-color data).
    normal: null,
    // Optional '/assets/decoders/draco/' with matching Three.js DRACO decoder files.
    dracoDecoderPath: null
  },
  quality: {
    high: { label: 'ALTA', count: 50000, dpr: 1.65, raySteps: 16, dof: 1, bloom: true },
    balanced: { label: 'AUTO', count: 24000, dpr: 1.25, raySteps: 10, dof: .65, bloom: true },
    low: { label: 'LEVE', count: 8000, dpr: 1, raySteps: 6, dof: 0, bloom: false }
  },
  maxParticles: 50000,
  color: { water: '#0a2825', abyss: '#020b0d', mint: '#d5f69a', copper: '#bd7743' }
};
