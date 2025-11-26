/**
 * Conditional logger that only outputs debug messages in development mode
 */

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Only show debug logs in development mode
export const logger = {
    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },

    log: (...args: any[]) => {
        console.log(...args);
    },

    error: (...args: any[]) => {
        if (isDevelopment) {
            console.error(...args);
        }
    },

    warn: (...args: any[]) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    info: (...args: any[]) => {
        console.info(...args);
    }
};
