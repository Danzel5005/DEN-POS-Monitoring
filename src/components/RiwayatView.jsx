import { useState, useEffect, useCallback, useMemo } from 'react';
import { historyService } from '../services/syncService';
import { formatCurrency, formatDateTime, formatRelativeTime, getPaymentLabel } from '../utils/formatters';

// DEN POS-style color constants (matching src/constants/design.js)
const G = "#1a5c38";       // Primary green
const OR = "#e87c2a";      // Secondary orange  
const W = "#ffffff";       // White surface
const BG = "#f5f5f0";      // Light gray background
const BD = "#e0e0d8";      // Border
const TX = "#1a1a1a";      // Text primary
const MT = "#888888";      // Text muted
const LT = "#f0f5ee";      // Light green tint
const DD = "#e0d0d0";      // Red tint for voided

const VOID_REASON_LABELS = {
  cancel: "Pembatalan pelanggan",
  refund: "Pengembalian",
  error: "Kesalahan input",
  promotion: "Promo gratis",
  other: "Lainnya"
};

export default function RiwayatView({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', limit: 500 });
  const [search, setSearch] = useState('');
  const [selectedTrx, setSelectedTrx] = useState(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await historyService.getRiwayat(filters);
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const transactions = data?.data || [];

  // Client-side search filter
  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t => {
      return (
        String(t.id || '').toLowerCase().includes(q) ||
        String(t.metodeBayar || '').toLowerCase().includes(q) ||
        String(t.customerNama || t.customer || '').toLowerCase().includes(q) ||
        String(t.total || '').includes(q)
      );
    });
  }, [transactions, search]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a5c38] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat riwayat transaksi...</p>
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

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: TX, marginBottom: '8px' }}>Riwayat Transaksi</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: MT, marginBottom: 0 }}>
            {filteredTransactions.length} transaksi • Last updated: {lastUpdated ? formatRelativeTime(lastUpdated) : '-'}
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
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 500 }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card title="Filter & Cari">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MT, fontWeight: 500, marginBottom: '4px' }}>Dari Tanggal</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              style={{ 
                width: '100%', 
                padding: '8px 10px', 
                border: `1px solid ${BD}`,
                borderRadius: 8,
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MT, fontWeight: 500, marginBottom: '4px' }}>Sampai Tanggal</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              style={{ 
                width: '100%', 
                padding: '8px 10px', 
                border: `1px solid ${BD}`,
                borderRadius: 8,
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MT, fontWeight: 500, marginBottom: '4px' }}>Cari</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, metode, dll..."
              style={{ 
                width: '100%', 
                padding: '8px 10px', 
                border: `1px solid ${BD}`,
                borderRadius: 8,
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={() => {
                setFilters({ startDate: '', endDate: '', limit: 500 });
                setSearch('');
              }}
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                backgroundColor: BG,
                color: TX,
                border: 'none',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Reset Filter
            </button>
          </div>
        </div>
      </Card>

      {/* Transaction List */}
      <div style={{ marginTop: '16px' }}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((trx) => (
            <TransactionCard
              key={trx.id}
              transaction={trx}
              onClick={() => setSelectedTrx(trx)}
            />
          ))
        ) : (
          <Card>
            <div style={{ padding: '48px', textAlign: 'center', color: MT }}>
              Tidak ada transaksi ditemukan
            </div>
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTrx && (
        <TransactionModal transaction={selectedTrx} onClose={() => setSelectedTrx(null)} />
      )}
    </div>
  );
}

function TransactionCard({ transaction, onClick }) {
  const isVoid = transaction.status === 'voided' || transaction.voided === true;
  const itemCount = (transaction.items || []).length;
  const methodLabel = getPaymentLabel(transaction.metodeBayar, transaction.metodeBayarLabel);
  
  return (
    <div
      onClick={onClick}
      style={{
        background: isVoid ? '#fafafa' : W,
        border: `1px solid ${isVoid ? DD : BD}`,
        borderRadius: 8,
        padding: '12px',
        marginBottom: '10px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        opacity: isVoid ? 0.75 : 1
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = isVoid ? '#d8b8b8' : '#a8d5b8'}
      onMouseLeave={e => e.currentTarget.style.borderColor = isVoid ? DD : BD}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag label={`TRX #${String(transaction.id)}`} bg={isVoid ? '#f0e8e8' : LT} tc={isVoid ? '#b03030' : G} />
          <Tag 
            label={methodLabel} 
            bg={getPaymentColorBg(transaction.metodeBayar)}
            tc={getPaymentTextColor(transaction.metodeBayar)} 
          />
          {isVoid && (
            <Tag label="VOID" bg="#fdecec" tc="#c02020" />
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: isVoid ? MT : G }}>
            {formatCurrency(transaction.total)}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px', color: MT }}>
        <span>🕐 {formatDateTime(transaction.createdAt)}</span>
        <span>📦 {itemCount} item</span>
        {transaction.shiftInfo && (
          <span>👤 {transaction.shiftInfo.operator || '-'}</span>
        )}
      </div>

      {/* Items preview */}
      {transaction.items && transaction.items.length > 0 && (
        <div style={{ fontSize: '11px', color: MT, marginTop: '8px' }}>
          {transaction.items.slice(0, 3).map((i, idx) => `${i.qty}x ${i.nama || i.name || 'Unknown'}`).join(' · ') + 
           (transaction.items.length > 3 ? '...' : '')}
        </div>
      )}
    </div>
  );
}

function TransactionModal({ transaction, onClose }) {
  const items = transaction.items || [];
  const isVoid = transaction.status === 'voided' || transaction.voided === true;
  const reasonLabel = transaction.voidReason ? VOID_REASON_LABELS[transaction.voidReason] || transaction.voidReason : '';

  return (
    <div 
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div 
        style={{ 
          background: W, 
          borderRadius: 8, 
          maxWidth: '500px', 
          width: '90%', 
          maxHeight: '90vh', 
          overflow: 'auto' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: `1px solid ${BD}`
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: TX, marginBottom: '4px' }}>Detail Transaksi</h3>
            <p style={{ fontSize: '12px', color: MT, margin: 0 }}>TRX #{String(transaction.id)}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: MT
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', paddingBottom: '20px' }}>
          {/* Info Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '16px',
            marginBottom: '20px'
          }}>
            <InfoField label="Waktu" value={formatDateTime(transaction.createdAt)} />
            <InfoField label="Metode Bayar" value={getPaymentLabel(transaction.metodeBayar, transaction.metodeBayarLabel)} />
            <InfoField label="Status" value={isVoid ? 'VOID' : 'Selesai'} />
            <InfoField label="Operator" value={transaction.shiftInfo?.operator || '-'} />
          </div>

          {/* Items */}
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: TX, marginBottom: '12px' }}>
            Item ({items.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: BG,
                borderRadius: 4
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: TX, margin: '0 0 4px' }}>{item.nama || item.name || 'Unknown'}</p>
                  <p style={{ fontSize: '11px', color: MT, margin: 0 }}>
                    {item.qty} × {formatCurrency(item.harga || item.price || 0)}
                  </p>
                </div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: TX, margin: 0 }}>
                  {formatCurrency((item.harga || item.price || 0) * (item.qty || 0))}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: `2px solid ${BD}`, paddingTop: '16px' }}>
            {transaction.subtotal != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: MT }}>Subtotal</span>
                <span style={{ color: TX }}>{formatCurrency(transaction.subtotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: TX }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: G }}>{formatCurrency(transaction.total)}</span>
            </div>
            {transaction.bayar != null && Number(transaction.bayar) !== Number(transaction.total) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: MT }}>Dibayar</span>
                <span style={{ color: TX }}>{formatCurrency(transaction.bayar)}</span>
              </div>
            )}
            {transaction.kembalian != null && Number(transaction.kembalian) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                <span style={{ color: MT }}>Kembalian</span>
                <span style={{ color: TX }}>{formatCurrency(transaction.kembalian)}</span>
              </div>
            )}
          </div>

          {isVoid && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: 4, fontSize: '11px', color: '#c02020' }}>
              Dibatalkan{reasonLabel ? ` · ${reasonLabel}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ label, bg, tc }) {
  return (
    <span style={{ 
      padding: '4px 10px', 
      backgroundColor: bg, 
      color: tc, 
      borderRadius: 4,
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      background: W,
      border: `1px solid ${BD}`,
      borderRadius: 8,
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {title && <h2 style={{ fontSize: '14px', fontWeight: 600, color: TX, marginBottom: '16px' }}>{title}</h2>}
      {children}
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: MT, fontWeight: 500, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: TX, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  );
}

// Payment method color helpers (matching METODE_COLORS from design.js)
function getPaymentColorBg(method) {
  const colors = {
    cash: '#fff8e0',
    'qris': '#e8f5ee',
    qris_bca: '#e8f5ee',
    qris_bni: '#e0f5f5',
    debit_bca: '#e8f0fe',
    debit_bni: '#fff0e8',
    transfer_bca: '#e8f5ee'
  };
  return colors[method?.toLowerCase()] || '#f0f0f0';
}

function getPaymentTextColor(method) {
  const colors = {
    cash: '#b87a00',
    'qris': '#1a5c38',
    qris_bca: '#1a5c38',
    qris_bni: '#0a7a7a',
    debit_bca: '#1a5fb4',
    debit_bni: '#c05a00',
    transfer_bca: '#1a5c38'
  };
  return colors[method?.toLowerCase()] || '#888888';
}
