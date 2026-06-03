import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SkipNav from './components/SkipNav';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Crimes from './pages/Crimes';
import Admin from './pages/Admin';
import City from './pages/City';
import Gym from './pages/Gym';
import Job from './pages/Job';
import Properties from './pages/Properties';
import Inventory from './pages/Inventory';
import Travel from './pages/Travel';
import Company from './pages/Company';
import Casino from './pages/Casino';
import Faction from './pages/Faction';
import Forum from './pages/Forum';
import Events from './pages/Events';
import Newspaper from './pages/Newspaper';
import BlackMarket from './pages/BlackMarket';
import Hospital from './pages/Hospital';
import Jail from './pages/Jail';
import FederalJail from './pages/FederalJail';
import Calendar from './pages/Calendar';
import FactionLink from './pages/FactionLink';
import { ToastContainer } from './components/ui/Toast';
import { PageTransition } from './components/ui/PageTransition';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SkipNav />
        <PageTransition>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Core Game */}
            <Route path="/home"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/crimes"       element={<ProtectedRoute><Crimes /></ProtectedRoute>} />
            <Route path="/inventory"    element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/city"         element={<ProtectedRoute><City /></ProtectedRoute>} />
            <Route path="/gym"          element={<ProtectedRoute><Gym /></ProtectedRoute>} />
            <Route path="/job"          element={<ProtectedRoute><Job /></ProtectedRoute>} />
            <Route path="/company"      element={<ProtectedRoute><Company /></ProtectedRoute>} />
            <Route path="/properties"   element={<ProtectedRoute><Properties /></ProtectedRoute>} />
            <Route path="/travel"       element={<ProtectedRoute><Travel /></ProtectedRoute>} />

            {/* Social & Economy */}
            <Route path="/casino"       element={<ProtectedRoute><Casino /></ProtectedRoute>} />
            <Route path="/black-market" element={<ProtectedRoute><BlackMarket /></ProtectedRoute>} />
            <Route path="/faction"      element={<ProtectedRoute><Faction /></ProtectedRoute>} />
            <Route path="/faction-link" element={<ProtectedRoute><FactionLink /></ProtectedRoute>} />
            <Route path="/forum"        element={<ProtectedRoute><Forum /></ProtectedRoute>} />
            <Route path="/events"       element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/newspaper"    element={<ProtectedRoute><Newspaper /></ProtectedRoute>} />
            <Route path="/calendar"     element={<ProtectedRoute><Calendar /></ProtectedRoute>} />

            {/* Status */}
            <Route path="/hospital"     element={<ProtectedRoute><Hospital /></ProtectedRoute>} />
            <Route path="/jail"         element={<ProtectedRoute><Jail /></ProtectedRoute>} />
            <Route path="/federal-jail" element={<ProtectedRoute><FederalJail /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin"        element={<ProtectedRoute><Admin /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
