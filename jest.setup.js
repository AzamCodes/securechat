/**
 * Jest Setup
 * Global test configuration
 */

// Mock Web Crypto API for tests
if (typeof global.crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}

// Mock IndexedDB
import { openDB } from 'idb';

// Suppress console errors in tests (optional)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

