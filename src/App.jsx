import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthScreen from './components/AuthScreen';
import { authService } from './services/authService';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Pulihkan sesi Supabase yang tersimpan (reload halaman).
    authService.getSession().then((session) => {
      if (!alive) return;
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: meta.username || String(session.user.email || '').split('@')[0],
          name: meta.name || meta.username || String(session.user.email || '').split('@')[0],
        });
      }
      setLoading(false);
    });

    // Ikuti perubahan sesi (login/logout/refresh) agar state selalu sinkron.
    const sub = authService.onAuthStateChange((u) => {
      if (alive) setUser(u);
    });

    return () => { alive = false; sub?.unsubscribe?.(); };
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/laporan" replace /> : <AuthScreen onLogin={handleLogin} />}
        />
        <Route
          path="/*"
          element={user ? <Suspense fallback={<div className="p-6 text-center">Memuat…</div>}><Dashboard user={user} onLogout={handleLogout} /></Suspense> : <Navigate to="/login" />}
        />
      </Routes>
    </div>
  );
}

export default App;
