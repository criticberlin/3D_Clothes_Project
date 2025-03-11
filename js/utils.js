/**
 * Utility functions for 3D Clothes Project
 */

// Logging utility with different log levels
export const Logger = {
    // Log levels
    LEVELS: {
        NONE: 0,
        ERROR: 1,
        WARN: 2,
        INFO: 3,
        DEBUG: 4,
        VERBOSE: 5
    },
    
    // Current log level - can be changed at runtime
    level: 1, // Default to ERROR only
    
    // Enable production mode to disable most logs
    enableProductionMode() {
        this.level = this.LEVELS.ERROR;
    },
    
    // Enable development mode for more verbose logging
    enableDevelopmentMode() {
        this.level = this.LEVELS.INFO;
    },
    
    // Enable debug mode for all logs
    enableDebugMode() {
        this.level = this.LEVELS.VERBOSE;
    },
    
    // Logging methods
    error(message, ...args) {
        if (this.level >= this.LEVELS.ERROR) {
            console.error(message, ...args);
        }
    },
    
    warn(message, ...args) {
        if (this.level >= this.LEVELS.WARN) {
            console.warn(message, ...args);
        }
    },
    
    info(message, ...args) {
        if (this.level >= this.LEVELS.INFO) {
            console.log(message, ...args);
        }
    },
    
    debug(message, ...args) {
        if (this.level >= this.LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
    
    verbose(message, ...args) {
        if (this.level >= this.LEVELS.VERBOSE) {
            console.log(`[VERBOSE] ${message}`, ...args);
        }
    }
};

// Performance utilities
export const Performance = {
    // Store measurements
    timings: {},
    
    // Start measuring
    start(label) {
        this.timings[label] = performance.now();
    },
    
    // End measuring and log result if above threshold
    end(label, thresholdMs = 16) { // 16ms = 60fps
        if (!this.timings[label]) return;
        
        const duration = performance.now() - this.timings[label];
        delete this.timings[label];
        
        if (duration > thresholdMs) {
            Logger.warn(`Performance issue: ${label} took ${duration.toFixed(2)}ms (threshold: ${thresholdMs}ms)`);
        }
        
        return duration;
    }
};

// Set the appropriate mode based on environment
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    Logger.enableDevelopmentMode();
} else {
    Logger.enableProductionMode();
} 