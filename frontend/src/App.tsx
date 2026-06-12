// ============================================================
// APP — UNDERCITY
// All pages are lazy-loaded for optimal bundle splitting.
// Only Landing, Login, Register load immediately.
// ============================================================

import { lazy, Suspense }              from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider }                 from './context/AuthContext';
import ProtectedRoute                   from './components/ProtectedRoute';
import AdminRoute                       from './components/AdminRoute';
import ErrorBoundary                    from './components/ErrorBoundary';
import SkipNav                          from './components/SkipNav';
import { ToastContainer }               from './components/ui/Toast';
import { PageTransition }               from './components/ui/PageTransition';
import { useNotifications }             from './hooks/useSocket';
import { Skeleton }                     from './components/ui/Skeleton';

// ── Eagerly loaded — needed on first paint ─────────────────
import Landing  from './pages/Landing';
import Login    from './pages/Login';
import Register from './pages/Register';

// ── Lazily loaded — only when user navigates there ─────────
const Legal           = lazy(() => import('./pages/Legal'));
const Home            = lazy(() => import('./pages/Home'));
const Crimes          = lazy(() => import('./pages/Crimes'));
const Bank            = lazy(() => import('./pages/Bank'));
const Admin           = lazy(() => import('./pages/Admin'));
const City            = lazy(() => import('./pages/City'));
const Gym             = lazy(() => import('./pages/Gym'));
const Job             = lazy(() => import('./pages/Job'));
const Company         = lazy(() => import('./pages/Company'));
const Properties      = lazy(() => import('./pages/Properties'));
const Inventory       = lazy(() => import('./pages/Inventory'));
const Travel          = lazy(() => import('./pages/Travel'));
const Missions        = lazy(() => import('./pages/Missions'));
const Casino          = lazy(() => import('./pages/Casino'));
const BlackMarket     = lazy(() => import('./pages/BlackMarket'));
const Hospital        = lazy(() => import('./pages/Hospital'));
const Jail            = lazy(() => import('./pages/Jail'));
const FederalJail     = lazy(() => import('./pages/FederalJail'));
const Gang            = lazy(() => import('./pages/Gang'));
const LinkedGangs     = lazy(() => import('./pages/LinkedGangs'));
const GangWars        = lazy(() => import('./pages/GangWars'));
const Forum           = lazy(() => import('./pages/Forum'));
const Events          = lazy(() => import('./pages/Events'));
const Newspaper       = lazy(() => import('./pages/Newspaper'));
const Calendar        = lazy(() => import('./pages/Calendar'));
const Onboarding      = lazy(() => import('./pages/Onboarding'));
const Settings        = lazy(() => import('./pages/Settings'));
const Profile         = lazy(() => import('./pages/Profile'));
const Leaderboard     = lazy(() => import('./pages/Leaderboard'));
const Attack          = lazy(() => import('./pages/Attack'));
const Referral        = lazy(() => import('./pages/Referral'));
const StockMarket     = lazy(() => import('./pages/StockMarket'));
const Church          = lazy(() => import('./pages/Church'));
const PublicRecords   = lazy(() => import('./pages/PublicRecords'));
const About           = lazy(() => import('./pages/About'));
const Contributor     = lazy(() => import('./pages/Contributor'));
const BlackCard       = lazy(() => import('./pages/BlackCard'));
const ForumThread     = lazy(() => import('./pages/ForumThread'));
const Messages        = lazy(() => import('./pages/Messages'));
const Upgrade         = lazy(() => import('./pages/Upgrade'));
const NotFound        = lazy(() => import('./pages/NotFound'));

// Dev only
const DevOnboardingPreview = lazy(() => import('./pages/DevOnboardingPreview'));

import './App.css';

// ── Page loading fallback ─────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
    }}>
      <Skeleton width={200} height={4} />
    </div>
  );
}

// ── Notification bridge ───────────────────────────────────
function NotificationBridge() {
  useNotifications();
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <SkipNav />
          <NotificationBridge />
          <PageTransition>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public ── */}
                <Route path="/"            element={<Landing />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/register"    element={<Register />} />
                <Route path="/legal/:page" element={<Legal />} />
                <Route path="/about"       element={<About />} />
                <Route path="/contributor"  element={<Contributor />} />
                <Route path="/black-card"   element={<BlackCard />} />

                {/* ── Game (protected) ── */}
                <Route path="/home"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/bank"         element={<ProtectedRoute><Bank /></ProtectedRoute>} />
                <Route path="/crimes"       element={<ProtectedRoute><Crimes /></ProtectedRoute>} />
                <Route path="/gym"          element={<ProtectedRoute><Gym /></ProtectedRoute>} />
                <Route path="/inventory"    element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/city"         element={<ProtectedRoute><City /></ProtectedRoute>} />
                <Route path="/job"          element={<ProtectedRoute><Job /></ProtectedRoute>} />
                <Route path="/company"      element={<ProtectedRoute><Company /></ProtectedRoute>} />
                <Route path="/properties"   element={<ProtectedRoute><Properties /></ProtectedRoute>} />
                <Route path="/travel"       element={<ProtectedRoute><Travel /></ProtectedRoute>} />
                <Route path="/missions"     element={<ProtectedRoute><Missions /></ProtectedRoute>} />
                <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/leaderboard"      element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                <Route path="/casino"           element={<ProtectedRoute><Casino /></ProtectedRoute>} />
                <Route path="/black-market" element={<ProtectedRoute><BlackMarket /></ProtectedRoute>} />
                <Route path="/hospital"     element={<ProtectedRoute><Hospital /></ProtectedRoute>} />
                <Route path="/jail"         element={<ProtectedRoute><Jail /></ProtectedRoute>} />
                <Route path="/federal-jail" element={<ProtectedRoute><FederalJail /></ProtectedRoute>} />
                <Route path="/attack"       element={<ProtectedRoute><Attack /></ProtectedRoute>} />
                <Route path="/gang"         element={<ProtectedRoute><Gang /></ProtectedRoute>} />
                <Route path="/linked-gangs" element={<ProtectedRoute><LinkedGangs /></ProtectedRoute>} />
                <Route path="/gang-wars"    element={<ProtectedRoute><GangWars /></ProtectedRoute>} />
                <Route path="/forum"          element={<ProtectedRoute><Forum /></ProtectedRoute>} />
                <Route path="/forum/thread/:id" element={<ProtectedRoute><ForumThread /></ProtectedRoute>} />
                <Route path="/events"       element={<ProtectedRoute><Events /></ProtectedRoute>} />
                <Route path="/newspaper"    element={<ProtectedRoute><Newspaper /></ProtectedRoute>} />
                <Route path="/calendar"     element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                <Route path="/messages"      element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/referral"      element={<ProtectedRoute><Referral /></ProtectedRoute>} />
                <Route path="/stock-market" element={<ProtectedRoute><StockMarket /></ProtectedRoute>} />
                <Route path="/church"       element={<ProtectedRoute><Church /></ProtectedRoute>} />
                <Route path="/public-records" element={<ProtectedRoute><PublicRecords /></ProtectedRoute>} />
                <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/upgrade"      element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />

                {/* ── Onboarding ── */}
                <Route path="/onboarding" element={
                  <ProtectedRoute><Onboarding /></ProtectedRoute>
                } />

                {/* ── Dev only ── */}
                {import.meta.env.DEV && (
                  <Route path="/dev/onboarding" element={<DevOnboardingPreview />} />
                )}

                {/* ── Admin ── */}
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

                {/* ── 404 ── */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </PageTransition>
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
