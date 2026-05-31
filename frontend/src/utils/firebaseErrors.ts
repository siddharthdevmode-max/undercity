export function getFriendlyError(error: any): string {
  const code = error?.code || '';
  const message = error?.message || 'Something went wrong.';

  const map: Record<string, string> = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/missing-password': 'Please enter your password.',
  };

  if (map[code]) return map[code];

  // Strip Firebase prefix if no match
  return message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim();
}
