/**
 * NextAuth Handlers
 */

import { auth, signIn as authSignIn, signOut as authSignOut } from './index';

// Export handlers for API route
export { auth as handlers, authSignIn as signIn, authSignOut as signOut };

export default auth;
