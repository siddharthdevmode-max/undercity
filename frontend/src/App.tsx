import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Crimes from './pages/Crimes';
import './App.css';

// Placeholder pages — wrapped in Shell so sidebar stays
const ComingSoon = ({ page }: { page: string }) => (
  <Shell>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#e94560',
      gap: '10px'
    }}>
      <h1 style={{ fontSize: '48px' }}>🚧</h1>
      <h2>{page}</h2>
      <p style={{ color: '#95a5a6' }}>Coming soon...</p>
    </div>
  </Shell>
);

function App() {
  return (
    <BrowserRouter>
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
          <ProtectedRoute><ComingSoon page="City" /></ProtectedRoute>
        } />
        <Route path="/crimes" element={
          <ProtectedRoute><Crimes /></ProtectedRoute>
        } />
        <Route path="/job" element={
          <ProtectedRoute><ComingSoon page="Job" /></ProtectedRoute>
        } />
        <Route path="/gym" element={
          <ProtectedRoute><ComingSoon page="Gym" /></ProtectedRoute>
        } />
        <Route path="/properties" element={
          <ProtectedRoute><ComingSoon page="Properties" /></ProtectedRoute>
        } />
        <Route path="/missions" element={
          <ProtectedRoute><ComingSoon page="Missions" /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;