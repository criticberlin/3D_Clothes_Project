// Application state - maintain both original and new property names for compatibility
export const state = {
    intro: true,              // Original: whether we're in intro screen
    color: '#EFBD48',         // Original: shirt color
    isLogoTexture: false,      // Original: whether to show logo texture
    isFullTexture: false,     // Original: whether to show full texture
    logoDecal: null,  // Removed ThreeJS logo
    fullDecal: null,  // Removed ThreeJS texture

    // New properties for toggle controls
    logo: false,               // For UI: logo toggle state
    stylish: false,           // For UI: full texture toggle state

    // Logo positioning
    logoPosition: 'center',   // Position of logo: 'center', 'left', 'right', 'back', etc.

    // Camera view
    cameraView: 'front',      // Current camera view: 'front', 'back', 'left', 'right'

    // Theme
    darkMode: true,           // Theme mode: true for dark, false for light

    // Model selection
    currentModel: 'tshirt',   // Current 3D model ('tshirt' or 'hoodie')
    modelPaths: {
        tshirt: './shirt_baked.glb',
        hoodie: './hoodie_baked.glb'
    }
};

// State change callbacks
const callbacks = new Set();

// Subscribe to state changes
export const subscribe = (callback) => {
    callbacks.add(callback);
    // Call immediately with current state
    callback(state);
    return () => callbacks.delete(callback);
};

// Update state and notify subscribers
export const updateState = (updates) => {
    // Handle paired properties (keep the old and new properties in sync)
    if (updates.logo !== undefined && updates.isLogoTexture === undefined) {
        updates.isLogoTexture = updates.logo;
    }

    if (updates.isLogoTexture !== undefined && updates.logo === undefined) {
        updates.logo = updates.isLogoTexture;
    }

    if (updates.stylish !== undefined && updates.isFullTexture === undefined) {
        updates.isFullTexture = updates.stylish;
    }

    if (updates.isFullTexture !== undefined && updates.stylish === undefined) {
        updates.stylish = updates.isFullTexture;
    }

    // Apply updates
    Object.assign(state, updates);

    // Notify subscribers
    callbacks.forEach(callback => callback(state));
};

// Make functions available globally for use by direct scripts
window.state = state;
window.updateState = updateState;
window.subscribe = subscribe; 