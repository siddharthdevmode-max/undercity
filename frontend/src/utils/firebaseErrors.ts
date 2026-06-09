// ============================================================
// FIREBASE ERROR → FRIENDLY MESSAGE
// ============================================================

interface FirebaseError {
  code?: string;
  message?: string;
}

function isFirebaseError(err: unknown): err is FirebaseError {
  return typeof err === 'object' && err !== null;
}

const ERROR_MAP: Record<string, string> = {
  // Email/password
  'auth/email-already-in-use':   'This email is already registered.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/weak-password':          'Password is too weak. Use at least 6 characters.',
  'auth/user-not-found':         'No account found with this email.',
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-credential':     'Invalid email or password.',
  'auth/too-many-requests':      'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/user-disabled':          'This account has been disabled.',
  'auth/operation-not-allowed':  'This sign-in method is not enabled.',
  'auth/missing-password':       'Please enter your password.',

  // Google SSO
  'auth/popup-closed-by-user':         'Sign-in cancelled. The popup was closed.',
  'auth/popup-blocked':                'Popup was blocked by your browser. Allow popups for this site.',
  'auth/cancelled-popup-request':      'Sign-in cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/credential-already-in-use':    'This Google account is already linked to another user.',
  'auth/unauthorized-domain':          'This domain is not authorised for Google sign-in.',
  'auth/internal-error':               'An internal error occurred. Please try again.',
  'auth/user-cancelled':               'Sign-in was cancelled.',
  'auth/missing-client-identifier':    'Configuration error. Please contact support.',
};

export function getFriendlyError(err: unknown): string {
  if (!isFirebaseError(err)) return 'Something went wrong.';

  const code    = err.code    ?? '';
  const message = err.message ?? 'Something went wrong.';

  if (ERROR_MAP[code]) return ERROR_MAP[code];

  return message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim();
}
