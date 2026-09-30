import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services/syncService';
import { formatCurrency, formatNumber, formatRelativeTime } from '../utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// DEN POS-style color constants (matching src/constants/design.js)
const G = "#1a5c38";       // Primary green
const OR = "#e87c2a";      // Secondary orange  
const W = "#ffffff";       // White surface
const BG = "#f7f8f5";      // Table header background
const BD = "#e0e0d8";      // Border
const TX = "#1a1a1a";      // Text primary
const MT = "#888888";      // Text muted

// Fallback colors for pie chart (when payment method color not defined)
const COLORS = ["#1a5c38", "#e87c2a", "#0a7a7a", "#d32f2f", "#1a5fb4", "#c05a00"];

// Payment method colors (matching METODE_COLORS from design.js)
const PAYMENT_COLORS = {
  cash: "#e87c2a",         // orange
  qris: "#1a5c38",         // green
  qris_bca: "#1a5c38",
  qris_bni: "#0a7a7a",     // teal
  debit_bca: "#1a5fb4",    // blue
  debit_bni: "#0a7a7a",
  transfer_bca: "#1a5c38"
};

function paymentLabel(key) {
  const labels = {
    cash: 'Tunai',
    qris: 'QRIS',
    'qris-bca': 'QRIS BCA',
    'qris-bni': 'QRIS BNI',
    'debit-bca': 'Debit BCA',
    'debit-bni': 'Debit BNI',
    'transfer-bca': 'Transfer BCA'
  };
  return labels[key] || (String(key).startsWith('custom_') ? 'Metode pembayaran' : String(key));
}

export default function LaporanView({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await reportService.getLaporan();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a5c38] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat laporan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#ffebee', border: `1px solid ${BD}`, borderRadius: 8, padding: 24 }}>
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => load(true)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const transactions = data?.data?.transactions || [];
  const topProducts = data?.data?.topProducts || [];

  // Build payment method breakdown
  const paymentBreakdown = {};
  transactions.forEach(t => {
    if (t.status === 'voided') return;
    const method = t.metodeBayar || 'cash';
    const paidAmount = Number(t.bayar ?? t.paid ?? t.total) || 0;
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + paidAmount;
  });

  const paymentData = Object.entries(paymentBreakdown).map(([name, value]) => ({
    key: name,
    name: transactions.find(t => t.metodeBayar === name)?.metodeBayarLabel
      || paymentLabel(name),
    value: Math.round(value)
  }));

  const topProductsData = topProducts.slice(0, 8).map(p => ({
    name: p.name?.substring(0, 15) || 'Unknown',
    qty: p.qty,
    revenue: Math.round(p.revenue)
  }));

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header - DEN POS style */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: TX, marginBottom: '8px' }}>Laporan Transaksi</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: MT, marginBottom: 0 }}>
            Last updated: {lastUpdated ? formatRelativeTime(lastUpdated) : '-'}
          </p>
          <button
            onClick={() => load(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              backgroundColor: G,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.target.style.backgroundColor = '#14492e'}
            onMouseLeave={e => e.target.style.backgroundColor = G}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 500 }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards - DEN POS card style */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <SummaryCard
          title="Total Pendapatan"
          value={formatCurrency(summary.totalRevenue)}
          icon="💰"
        />
        <SummaryCard
          title="Total Transaksi"
          value={formatNumber(summary.totalTransactions)}
          icon="🧾"
        />
        <SummaryCard
          title="Rata-rata Transaksi"
          value={formatCurrency(summary.averageOrderValue)}
          icon="📊"
        />
        <SummaryCard
          title="Transaksi Void"
          value={formatNumber(summary.voidedTransactions)}
          icon="⚠️"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Top Products Chart */}
        <ChartCard title="Produk Terlaris (7 hari)">
          {topProductsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} style={{ fontSize: '10px' }} />
                <YAxis tick={{ fontSize: 10, color: MT }} />
                <Tooltip 
                  formatter={(value) => formatNumber(value)}
                  contentStyle={{ 
                    backgroundColor: W, 
                    border: `1px solid ${BD}`,
                    borderRadius: 8,
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="qty" fill={G} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MT }}>
              Tidak ada data penjualan
            </div>
          )}
        </ChartCard>

        {/* Payment Method Breakdown - PIED CHART SAIA YANG DIJAGA */}
        <ChartCard title="Metode Pembayaran">
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[entry.key] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: W, 
                    border: `1px solid ${BD}`,
                    borderRadius: 8,
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MT }}>
              Tidak ada data pembayaran
            </div>
          )}
        </ChartCard>
      </div>

      {/* Top Products Table */}
      <TableCard title="Detail Produk Terlaris">
        {topProducts.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: BG }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Produk</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty Terjual</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, idx) => (
                <tr key={product.id || idx} style={{ borderBottom: `1px solid ${BD}` }}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>{product.name || 'Unknown'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(product.qty)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', color: MT }}>
            Tidak ada data produk
          </div>
        )}
      </TableCard>
    </div>
  );
}

function SummaryCard({ title, value, icon }) {
  return (
    <div style={{
      background: W,
      border: `1px solid ${BD}`,
      borderRadius: 8,
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: '12px', color: MT, fontWeight: 500, marginBottom: '4px' }}>{title}</p>
          <p style={{ fontSize: '24px', fontWeight: 600, color: TX, margin: 0 }}>{value}</p>
        </div>
        <div style={{ fontSize: '32px' }}>{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: W,
      border: `1px solid ${BD}`,
      borderRadius: 8,
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: TX, marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  );
}

function TableCard({ title, children }) {
  return (
    <div style={{
      background: W,
      border: `1px solid ${BD}`,
      borderRadius: 8,
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: TX, marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  );
}

const thStyle = {
  padding: '12px 16px',
  fontSize: '12px',
  fontWeight: 600,
  color: TX,
  textAlign: 'left',
  borderBottom: `2px solid ${BD}`
};

const tdStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  color: TX,
  borderBottom: `1px solid ${BD}`
};
