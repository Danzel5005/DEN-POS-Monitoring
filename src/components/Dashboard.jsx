import { useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import LaporanView from './LaporanView';
import RiwayatView from './RiwayatView';
import DevicesView from './DevicesView';
import SyncDataView from './SyncDataView';
import AccountView from './AccountView';

// Daftar tab navigasi — satu sumber untuk desktop & mobile.
const NAV = [
  { to: '/laporan', label: 'Laporan' },
  { to: '/riwayat', label: 'Riwayat' },
  { to: '/data-sync', label: 'Data Tersinkron' },
  { to: '/perangkat', label: 'Perangkat' },
  { to: '/akun', label: 'Akun' },
];

// DEN POS-style colors
const G = "#1a5c38";       // Primary green
const OR = "#e87c2a";      // Secondary orange
const W = "#ffffff";       // White surface
const BG = "#f5f5f0";      // Light gray background
const BD = "#e0e0d8";      // Border
const TX = "#1a1a1a";      // Text primary
const MT = "#888888";      // Text muted

export default function Dashboard({ user, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  // Get route name for display
  const getRouteName = () => {
    if (location.pathname.includes('laporan')) return 'Laporan';
    if (location.pathname.includes('riwayat')) return 'Riwayat';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      {/* Navigation Bar */}
      <nav style={{ backgroundColor: W, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderBottom: `1px solid ${BD}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <svg className="h-8 w-8" style={{ color: G }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="ml-2 text-xl font-bold" style={{ color: G }}>DEN POS Monitor</span>
              </div>
              
              {/* Navigation Tabs */}
              <div className="hidden md:ml-6 md:flex md:space-x-4">
                {NAV.map((tab) => (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    style={
                      location.pathname.includes(tab.to)
                        ? { backgroundColor: '#e8f5ee', color: G }
                        : { color: '#666' }
                    }
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: G }}>
                    {user?.name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-medium hidden md:inline" style={{ color: TX }}>
                    {user?.name || user?.username}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20" style={{ border: `1px solid ${BD}` }}>
                      <div className="px-4 py-2" style={{ borderBottom: `1px solid ${BD}` }}>
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500">@{user?.username}</p>
                        <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded" style={{ backgroundColor: '#e8f5ee', color: G }}>
                          {user?.role?.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          onLogout();
                          setShowUserMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 py-2" style={{ backgroundColor: W, borderBottom: `1px solid ${BD}` }}>
        <div className="flex space-x-2">
          {NAV.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex-1 text-center px-3 py-2 rounded-md text-xs font-medium transition-colors"
              style={
                location.pathname.includes(tab.to)
                  ? { backgroundColor: '#e8f5ee', color: G }
                  : { color: '#666' }
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="laporan" element={<LaporanView user={user} />} />
          <Route path="riwayat" element={<RiwayatView user={user} />} />
          <Route path="data-sync" element={<SyncDataView />} />
          <Route path="perangkat" element={<DevicesView />} />
          <Route path="akun" element={<AccountView user={user} />} />
          <Route index element={<Navigate to="/laporan" />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              © 2024 DEN POS Monitoring System
            </p>
            <div className="flex items-center space-x-4 mt-2 md:mt-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-gray-600">Auto-updating every 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
