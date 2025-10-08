/**
 * CLI Commands Module
 *
 * This module exports all CLI command implementations for the Vibe Check MCP server.
 * Each command is implemented as a separate module for better organization and maintainability.
 */

export { default as installCommand } from './install.js';
export { default as startCommand } from './start.js';
export { default as uninstallCommand } from './uninstall.js';
export { default as doctorCommand } from './doctor.js';
export { default as cleanupCommand } from './cleanup.js';

// Re-export for convenience
export { default as install } from './install.js';
export { default as start } from './start.js';
export { default as uninstall } from './uninstall.js';
export { default as doctor } from './doctor.js';
export { default as cleanup } from './cleanup.js';