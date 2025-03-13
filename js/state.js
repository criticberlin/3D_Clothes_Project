// Application state - maintain both original and new property names for compatibility
export const state = {
    intro: true,              // Original: whether we're in intro screen
    color: '#FFFFFF',         // Original: shirt color
    fullDecal: null,          // Removed ThreeJS texture

    // New properties for toggle controls
    stylish: false,           // For UI: full texture toggle state

    // Camera view
    cameraView: 'front',      // Current camera view: 'front', 'back', 'left', 'right'

    // Theme
    darkMode: true,           // Theme mode: true for dark, false for light

    // Model selection
    currentModel: 'tshirt',   // Current 3D model ('tshirt' or 'hoodie')
    modelPaths: {
        tshirt: './models/tshirt.glb',
        hoodie: './models/hoodie.glb'
    }
};

// State change callbacks
const callbacks = new Set();

// Subscribe to state changes
export const subscribe = (property, callback) => {
    // Check if we're using the old or new signature
    if (typeof property === 'function' && callback === undefined) {
        // Old signature: subscribe(callback)
        const cb = property;
        if (typeof cb !== 'function') {
            console.error('Subscribe error: callback must be a function', cb);
            return () => { }; // Empty unsubscribe function
        }
        callbacks.add(cb);
        // Call immediately with current state
        cb(state);
        return () => callbacks.delete(cb);
    } else if (typeof property === 'string' && typeof callback === 'function') {
        // New signature: subscribe(property, callback)
        // This is a property-specific subscription
        // Store last value to prevent duplicate calls
        let lastValue = state[property];

        // Create a property watcher function
        const watcher = (newState) => {
            if (newState[property] !== lastValue) {
                lastValue = newState[property];
                callback(newState[property], newState);
            }
        };

        callbacks.add(watcher);
        // Initial call with current value
        callback(state[property], state);

        return () => callbacks.delete(watcher);
    } else {
        console.error('Subscribe error: invalid arguments', { property, callback });
        return () => { }; // Empty unsubscribe function
    }
};

// Update state and notify subscribers
export const updateState = (updates) => {
    // Handle paired properties (keep the old and new properties in sync)
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