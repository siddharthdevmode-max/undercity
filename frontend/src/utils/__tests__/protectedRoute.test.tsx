// ============================================================
// PROTECTED ROUTE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';

// ── Mock useAuth ───────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Helpers ────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id:                  1,
    firebaseUid:         'test-uid',
    username:            'testuser',
    email:               'test@test.com',
    level:               1,
    money:               750,
    points:              0,
    nerve:               30,
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
    onboardingCompleted: true,
    isAdmin:             false,
    isDeveloper:         false,
    isModerator:         false,
    userTier:            'player' as const,
    tierExpiresAt:       null,
    createdAt:           new Date().toISOString(),
    ...overrides,
  };
}

function renderProtected(initialPath = '/home') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login"      element={<div>Login Page</div>} />
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

// ============================================================
// TESTS
// ============================================================

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: null });
    renderProtected();
    expect(screen.getByText(/entering undercity/i)).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated and no error', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null });
    renderProtected();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows retry screen on network error (does NOT redirect to login)', () => {
    mockUseAuth.mockReturnValue({
      user:    null,
      loading: false,
      error:   'Failed to load player data',
    });
    renderProtected();
    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated and onboarded', () => {
    mockUseAuth.mockReturnValue({
      user:    makeUser({ onboardingCompleted: true }),
      loading: false,
      error:   null,
    });
    renderProtected();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when user has not completed onboarding', () => {
    mockUseAuth.mockReturnValue({
      user:    makeUser({ onboardingCompleted: false }),
      loading: false,
      error:   null,
    });
    renderProtected();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('does NOT redirect to onboarding if already on /onboarding', () => {
    mockUseAuth.mockReturnValue({
      user:    makeUser({ onboardingCompleted: false }),
      loading: false,
      error:   null,
    });
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/login"      element={<div>Login Page</div>} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <div>Onboarding Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Onboarding Content')).toBeInTheDocument();
  });

  it('does not show protected content when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: null });
    renderProtected();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('does not show protected content when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null });
    renderProtected();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
