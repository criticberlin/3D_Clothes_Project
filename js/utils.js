/**
 * Utility functions for 3D Clothes Project
 */

// Logging utility with different log levels
export const Logger = {
    LEVELS: { ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 },
    level: 1,

    setLevel(level) {
        this.level = level;
    },

    error(message, ...args) {
        if (this.level >= this.LEVELS.ERROR) console.error(message, ...args);
    },

    warn(message, ...args) {
        if (this.level >= this.LEVELS.WARN) console.warn(message, ...args);
    },

    info(message, ...args) {
        if (this.level >= this.LEVELS.INFO) console.log(message, ...args);
    },

    debug(message, ...args) {
        if (this.level >= this.LEVELS.DEBUG) console.log(`[DEBUG] ${message}`, ...args);
    }
};

// Performance utilities
export const Performance = {
    timings: {},

    start(label) {
        this.timings[label] = performance.now();
    },

    end(label, thresholdMs = 16) {
        if (!this.timings[label]) return;
        const duration = performance.now() - this.timings[label];
        delete this.timings[label];
        if (duration > thresholdMs) {
            Logger.warn(`Performance issue: ${label} took ${duration.toFixed(2)}ms (threshold: ${thresholdMs}ms)`);
        }
        return duration;
    }
};

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Set mode based on environment
Logger.setLevel(window.location.hostname.includes('localhost') ? Logger.LEVELS.INFO : Logger.LEVELS.ERROR); 