import { MAX_CENTS } from '../lib/money.js';
export const isCents = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS;
