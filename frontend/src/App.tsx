import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';
import SkipNav from './components/SkipNav';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Legal from './pages/Legal';
import Home from './pages/Home';
import Crimes from './pages/Crimes';
import Admin from './pages/Admin';
import City from './pages/City';
import Gym from './pages/Gym';
import Job from './pages/Job';
import Company from './pages/Company';
import Properties from './pages/Properties';
import Inventory from './pages/Inventory';
import Travel from './pages/Travel';
import Missions from './pages/Missions';
import Casino from './pages/Casino';
import BlackMarket from './pages/BlackMarket';
import Hospital from './pages/Hospital';
import Jail from './pages/Jail';
import FederalJail from './pages/FederalJail';
import Gang from './pages/Gang';
import LinkedGangs from './pages/LinkedGangs';
import GangWars from './pages/GangWars';
import Forum from './pages/Forum';
import Events from './pages/Events';
import Newspaper from './pages/Newspaper';
import Calendar from './pages/Calendar';
import Onboarding from './pages/Onboarding';
import DevOnboardingPreview from './pages/DevOnboardingPreview';
import NotFound from './pages/NotFound';
import { ToastContainer } from './components/ui/Toast';
import { PageTransition } from './components/ui/PageTransition';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <SkipNav />
          <PageTransition>
            <Routes>
              {/* ── Public ── */}
              <Route path="/"              element={<Landing />} />
              <Route path="/login"         element={<Login />} />
              <Route path="/register"      element={<Register />} />
              <Route path="/legal/:page"   element={<Legal />} />

              {/* ── Game (protected) ── */}
              <Route path="/home"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/crimes"       element={<ProtectedRoute><Crimes /></ProtectedRoute>} />
              <Route path="/gym"          element={<ProtectedRoute><Gym /></ProtectedRoute>} />
              <Route path="/inventory"    element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
              <Route path="/city"         element={<ProtectedRoute><City /></ProtectedRoute>} />
              <Route path="/job"          element={<ProtectedRoute><Job /></ProtectedRoute>} />
              <Route path="/company"      element={<ProtectedRoute><Company /></ProtectedRoute>} />
              <Route path="/properties"   element={<ProtectedRoute><Properties /></ProtectedRoute>} />
              <Route path="/travel"       element={<ProtectedRoute><Travel /></ProtectedRoute>} />
              <Route path="/missions"     element={<ProtectedRoute><Missions /></ProtectedRoute>} />
              <Route path="/casino"       element={<ProtectedRoute><Casino /></ProtectedRoute>} />
              <Route path="/black-market"  element={<ProtectedRoute><BlackMarket /></ProtectedRoute>} />
              <Route path="/hospital"     element={<ProtectedRoute><Hospital /></ProtectedRoute>} />
              <Route path="/jail"         element={<ProtectedRoute><Jail /></ProtectedRoute>} />
              <Route path="/federal-jail" element={<ProtectedRoute><FederalJail /></ProtectedRoute>} />
              <Route path="/gang"         element={<ProtectedRoute><Gang /></ProtectedRoute>} />
              <Route path="/linked-gangs" element={<ProtectedRoute><LinkedGangs /></ProtectedRoute>} />
              <Route path="/gang-wars"    element={<ProtectedRoute><GangWars /></ProtectedRoute>} />
              <Route path="/forum"        element={<ProtectedRoute><Forum /></ProtectedRoute>} />
              <Route path="/events"       element={<ProtectedRoute><Events /></ProtectedRoute>} />
              <Route path="/newspaper"    element={<ProtectedRoute><Newspaper /></ProtectedRoute>} />
              <Route path="/calendar"     element={<ProtectedRoute><Calendar /></ProtectedRoute>} />

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
          </PageTransition>
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
