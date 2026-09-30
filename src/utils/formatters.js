// Currency formatting (Indonesian Rupiah)
export const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Number formatting with thousand separators
export const formatNumber = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID').format(num);
};

// Date formatting
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

// Date and time formatting
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

// Time only
export const formatTime = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

// Relative time (e.g., "5 minutes ago")
export const formatRelativeTime = (date) => {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

// Get payment method label
export const getPaymentLabel = (method, transactionLabel = '') => {
  if (transactionLabel) return transactionLabel;
  const labels = {
    cash: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer',
    debit: 'Debit',
    ewallet: 'E-Wallet'
  };
  if (labels[method]) return labels[method];

  // Custom methods are persisted by the POS as custom_<timestamp>, while
  // the human-readable label is stored on the transaction/settings object.
  // Never expose the internal custom key in the monitoring UI.
  if (String(method || '').startsWith('custom_')) return 'Metode pembayaran';

  return method || 'Unknown';
};

// Calculate percentage change
export const percentChange = (current, previous) => {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};
