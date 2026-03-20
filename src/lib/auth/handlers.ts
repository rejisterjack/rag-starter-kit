/**
 * NextAuth Handlers
 */

import { auth } from './index';

// Export handlers for API route
export const handlers = auth.handlers;
export const signIn = auth.signIn;
export const signOut = auth.signOut;

export default handlers;
