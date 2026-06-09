/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../AuthContext';
import type { Player } from '../AuthContext';

// ── Firebase mock ─────────────────────────────────────────────
let authStateCallback: ((user: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    authStateCallback = cb;
    cb(null); // default: logged out
    return mockUnsubscribe;
  },
}));

vi.mock('../../firebase', () => ({ auth: {} }));

// ── authAPI mock ──────────────────────────────────────────────
const mockMe = vi.fn();

vi.mock('../../services/api', () => ({
  authAPI: {
    me: (...args: unknown[]) => mockMe(...args),
  },
}));

// ── Fixture ───────────────────────────────────────────────────
const mockPlayer: Player = {
  id:                  1,
  firebaseUid:         'uid-123',
  username:            'TestPlayer',
  email:               'test@undercity.com',
  level:               1,
  money:               750,
  points:              0,
  nerve:               20,
  maxNerve:            30,
  life:                100,
  maxLife:             100,
  energy:              100,
  maxEnergy:           100,
  happiness:           50,
  jailUntil:           null,
  hospitalUntil:       null,
  federalJailUntil:    null,
  lastCrimeAt:         null,
  lastSeenAt:          null,
  onboardingCompleted: false,
  isAdmin:             false,
  isDeveloper:         false,
  isModerator:         false,
  userTier:            'player',
  tierExpiresAt:       null,
  createdAt:           '2026-06-07T00:00:00.000Z',
};

// ── Test consumer ─────────────────────────────────────────────
function TestConsumer() {
  const ctx = React.useContext(AuthContext);
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user?.username ?? 'null'}</span>
      <span data-testid="error">{ctx.error ?? 'null'}</span>
      <button onClick={() => void ctx.refreshUser()}>refresh</button>
      <button onClick={ctx.clearError}>clearError</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

// ── Helpers ───────────────────────────────────────────────────
async function simulateLogin() {
  await act(async () => {
    authStateCallback?.({ uid: 'uid-123', email: 'test@undercity.com' });
  });
}

async function simulateLogout() {
  await act(async () => {
    authStateCallback?.(null);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMe.mockResolvedValue(mockPlayer);
  authStateCallback = null;
});

// ═════════════════════════════════════════════════════════════
describe('AuthProvider — logged out', () => {
  it('resolves loading to false when firebase user is null', async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('has null user when logged out', async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('does not call authAPI.me when logged out', async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(mockMe).not.toHaveBeenCalled();
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderProvider();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
describe('AuthProvider — logged in', () => {
  it('calls authAPI.me when firebase user signs in', async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await simulateLogin();

    await waitFor(() => {
      expect(mockMe).toHaveBeenCalled();
    });
  });

  it('sets user data after successful me() call', async () => {
    renderProvider();
    await simulateLogin();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('TestPlayer');
    });
  });

  it('sets loading false after user is fetched', async () => {
    renderProvider();
    await simulateLogin();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('clears user on logout after login', async () => {
    renderProvider();

    await simulateLogin();
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('TestPlayer');
    });

    await simulateLogout();
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });
});

// ═════════════════════════════════════════════════════════════
describe('AuthProvider — error handling', () => {
  it('sets error after authAPI.me fails both attempts', async () => {
    mockMe.mockRejectedValue(new Error('Network error'));

    renderProvider();
    await simulateLogin();

    await waitFor(
      () => {
        expect(screen.getByTestId('error').textContent).toBe(
          'Failed to load player data'
        );
      },
      { timeout: 6000 }
    );
  }, 8000);

  it('clearError resets error to null', async () => {
    mockMe.mockRejectedValue(new Error('fail'));

    renderProvider();
    await simulateLogin();

    await waitFor(
      () => {
        expect(screen.getByTestId('error').textContent).not.toBe('null');
      },
      { timeout: 6000 }
    );

    await act(async () => {
      screen.getByText('clearError').click();
    });

    expect(screen.getByTestId('error').textContent).toBe('null');
  }, 10000);
});

// ═════════════════════════════════════════════════════════════
describe('AuthContext — defaults without provider', () => {
  it('provides correct default values when used outside provider', () => {
    function Bare() {
      const ctx = React.useContext(AuthContext);
      return (
        <div>
          <span data-testid="loading">{String(ctx.loading)}</span>
          <span data-testid="user">{String(ctx.user)}</span>
          <span data-testid="error">{String(ctx.error)}</span>
        </div>
      );
    }

    render(<Bare />);
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('error').textContent).toBe('null');
  });
});

// ═════════════════════════════════════════════════════════════
describe('refreshUser', () => {
  it('re-fetches user data when called', async () => {
    renderProvider();
    await simulateLogin();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('TestPlayer');
    });

    const before = mockMe.mock.calls.length;

    await act(async () => {
      screen.getByText('refresh').click();
    });

    await waitFor(() => {
      expect(mockMe.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('updates displayed user data on refresh', async () => {
    renderProvider();
    await simulateLogin();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('TestPlayer');
    });

    mockMe.mockResolvedValueOnce({ ...mockPlayer, username: 'UpdatedPlayer' });

    await act(async () => {
      screen.getByText('refresh').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('UpdatedPlayer');
    });
  });
});
