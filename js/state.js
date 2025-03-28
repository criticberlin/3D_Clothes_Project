// Application state - maintain both original and new property names for compatibility
export const state = {
    fullDecal: null,          // Removed ThreeJS texture

    // New properties for toggle controls
    stylish: false,           // For UI: full texture toggle state

    // Camera view
    cameraView: 'front',      // Current camera view: 'front', 'back', 'left', 'right'

    // Theme
    darkMode: false,           // Theme mode: true for dark, false for light

    // Model selection
    currentModel: 'tshirt',   // Current 3D model ('tshirt' or 'hoodie')
    modelPaths: {
        tshirt: './models/tshirt.glb',
        hoodie: './models/hoodie.glb'
    },

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

// Panel settings - stores the last state of edits for each panel
export const panelSettings = {
    // Text panel settings
    text: {
        items: [] // Will store text objects that have been created
    },
    // Photo panel settings
    photo: {
        items: [] // Will store photo objects that have been created
    },
    // AI panel settings
    ai: {
        items: [] // Will store AI generated images
    },
    // Shape panel settings
    shape: {
        items: [] // Will store shape objects that have been created
    }
};

/**
 * Save panel settings to localStorage
 */
export const savePanelSettings = () => {
    try {
        localStorage.setItem('panelSettings', JSON.stringify(panelSettings));
        console.log('Panel settings saved to localStorage');
    } catch (error) {
        console.error('Error saving panel settings to localStorage:', error);
    }
};

/**
 * Load panel settings from localStorage
 */
export const loadPanelSettings = () => {
    try {
        const savedSettings = localStorage.getItem('panelSettings');
        if (savedSettings) {
            Object.assign(panelSettings, JSON.parse(savedSettings));
            console.log('Panel settings loaded from localStorage');
        }
    } catch (error) {
        console.error('Error loading panel settings from localStorage:', error);
    }
};

/**
 * Add an item to panel settings
 * @param {string} panelType - The type of panel ('text', 'photo', 'ai', 'shape')
 * @param {Object} item - The item to add
 */
export const addPanelItem = (panelType, item) => {
    if (panelSettings[panelType]) {
        // Create a copy without circular references
        const itemCopy = JSON.parse(JSON.stringify(item, (key, value) => {
            // Skip node types and functions to avoid circular references
            if (key === 'img' || typeof value === 'function' || value instanceof Node) {
                return undefined;
            }
            return value;
        }));
        
        // Store src URL or relevant data
        if (item.src) {
            itemCopy.src = item.src;
        }
        
        // Add item to panel settings
        panelSettings[panelType].items.push(itemCopy);
        
        // Save settings to localStorage
        savePanelSettings();
        console.log(`Added ${panelType} item to panel settings`);
    }
};

/**
 * Remove an item from panel settings
 * @param {string} panelType - The type of panel ('text', 'photo', 'ai', 'shape')
 * @param {Object} item - The item to remove, must have an id property
 */
export const removePanelItem = (panelType, itemId) => {
    if (panelSettings[panelType] && panelSettings[panelType].items) {
        // Find and remove the item
        const index = panelSettings[panelType].items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            panelSettings[panelType].items.splice(index, 1);
            savePanelSettings();
            console.log(`Removed ${panelType} item from panel settings`);
        }
    }
};

// Make functions available globally for use by direct scripts
window.state = state;
window.updateState = updateState;
window.subscribe = subscribe;
window.panelSettings = panelSettings;
window.savePanelSettings = savePanelSettings;
window.loadPanelSettings = loadPanelSettings;
window.addPanelItem = addPanelItem;
window.removePanelItem = removePanelItem; 