import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Crimes from './pages/Crimes';
import { ToastContainer } from './components/ui/Toast';
import { ComingSoon } from './components/ui/EmptyState';
import { PageTransition } from './components/ui/PageTransition';
import './App.css';

// Wrap ComingSoon in Shell so sidebar stays
const ComingSoonPage = ({ feature }: { feature: string }) => (
  <Shell>
    <ComingSoon feature={feature} />
  </Shell>
);

function App() {
  return (
    <BrowserRouter>
      <PageTransition>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Game Routes */}
          <Route path="/home" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />
          <Route path="/city" element={
            <ProtectedRoute><ComingSoonPage feature="City" /></ProtectedRoute>
          } />
          <Route path="/crimes" element={
            <ProtectedRoute><Crimes /></ProtectedRoute>
          } />
          <Route path="/job" element={
            <ProtectedRoute><ComingSoonPage feature="Job" /></ProtectedRoute>
          } />
          <Route path="/gym" element={
            <ProtectedRoute><ComingSoonPage feature="Gym" /></ProtectedRoute>
          } />
          <Route path="/properties" element={
            <ProtectedRoute><ComingSoonPage feature="Properties" /></ProtectedRoute>
          } />
          <Route path="/missions" element={
            <ProtectedRoute><ComingSoonPage feature="Missions" /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>

      {/* Global toast notifications (mounts to document.body via portal) */}
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
