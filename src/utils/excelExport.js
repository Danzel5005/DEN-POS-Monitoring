// ── Excel (.xlsx) export helpers ───────────────────────────────────────────
// Menggunakan SheetJS (xlsx) untuk membangun workbook dan triggering download.

import { formatNumber } from './formatters';

const VOID_REASON_LABELS = {
  cancel: 'Pembatalan pelanggan',
  refund: 'Pengembalian',
  error: 'Kesalahan input',
  promotion: 'Promo gratis',
  other: 'Lainnya'
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isVoided(t) {
  return t?.status === 'voided' || t?.voided === true;
}

function trxDate(t) {
  return t?.createdAt || t?.occurredAt || t?.date || t?.syncedAt || null;
}

/** Format ke "dd/mm/yyyy hh:mm" gaya Indonesia untuk dibaca manusia. */
function formatDateTimeId(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return String(dateString);
  }
}

function paymentLabel(t) {
  return (
    t?.metodeBayarLabel ||
    t?.metodeLabel ||
    t?.metodeBayar ||
    t?.metode ||
    t?.paymentMethod ||
    '-'
  );
}

/** Nama file aman + timestamp, mis. "riwayat-transaksi-2026-10-01_1430.xlsx". */
function buildFileName(prefix, rangeSuffix = '') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const suffix = rangeSuffix ? `-${rangeSuffix}` : '';
  return `${prefix}${suffix}-${stamp}.xlsx`;
}

/** Ubah rentang tanggal filter menjadi suffix nama file, mis. "2026-01-01_2026-01-31". */
export function rangeSuffix(startDate, endDate) {
  if (startDate && endDate) return `${startDate}_${endDate}`;
  if (startDate) return `dari-${startDate}`;
  if (endDate) return `sampai-${endDate}`;
  return '';
}

/** Auto-fit kolom lebar berdasarkan konten */
function autoFitColumns(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const maxLen = rows.reduce((max, row) => {
      const raw = row[key];
      const text = typeof raw === 'number' ? formatNumber(raw) : String(raw ?? '');
      return Math.max(max, text.length);
    }, key.length);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });
}

/** Tambah sheet dari array of objects */
function addSheet(XLSX, workbook, name, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = autoFitColumns(rows);
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

// ── Riwayat Transaksi Helpers ──────────────────────────────────────────────

function buildTransactionSummaryRows(transactions) {
  return transactions.map((t) => {
    const void_ = isVoided(t);
    const items = t.items || [];
    return {
      'ID Transaksi': t.id ?? t.trxId ?? '-',
      'Tanggal & Waktu': formatDateTimeId(trxDate(t)),
      'Status': void_ ? 'VOID' : 'Selesai',
      'Metode Bayar': paymentLabel(t),
      'Operator': t.shiftInfo?.operator || t.operator || '-',
      'Jumlah Item': items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
      'Subtotal': Number(t.subtotal) || 0,
      'Total': Number(t.total) || 0,
      'Dibayar': Number(t.bayar ?? t.paid ?? t.total) || 0,
      'Kembalian': Number(t.kembalian) || 0,
      'Alasan Void': void_ ? (VOID_REASON_LABELS[t.voidReason] || t.voidReason || '-') : ''
    };
  });
}

function buildTransactionItemRows(transactions) {
  const rows = [];
  for (const t of transactions) {
    const void_ = isVoided(t);
    const items = t.items || [];
    if (!items.length) continue;
    for (const it of items) {
      const qty = Number(it.qty ?? it.baseQty) || 0;
      const price = Number(it.harga ?? it.price) || 0;
      rows.push({
        'ID Transaksi': t.id ?? t.trxId ?? '-',
        'Tanggal & Waktu': formatDateTimeId(trxDate(t)),
        'Status': void_ ? 'VOID' : 'Selesai',
        'Produk': it.nama || it.name || 'Unknown',
        'Qty': qty,
        'Harga Satuan': price,
        'Subtotal': price * qty
      });
    }
  }
  return rows;
}

/** Load XLSX library lazily */
async function loadXLSX() {
  const module = await import('xlsx');
  return module.default || module;
}

// ── Export Functions ───────────────────────────────────────────────────────

/** Ekspor riwayat transaksi ke file .xlsx */
export async function exportRiwayatToXlsx(transactions = [], meta = {}) {
  try {
    const XLSX = await loadXLSX();
    const workbook = XLSX.utils.book_new();

    const summaryRows = buildTransactionSummaryRows(transactions);
    addSheet(XLSX, workbook, 'Transaksi', summaryRows);

    const itemRows = buildTransactionItemRows(transactions);
    if (itemRows.length) {
      addSheet(XLSX, workbook, 'Detail Item', itemRows);
    }

    const fileName = buildFileName(
      'riwayat-transaksi',
      rangeSuffix(meta.startDate, meta.endDate)
    );
    
    XLSX.writeFile(workbook, fileName, { compression: true });
    return fileName;
  } catch (err) {
    console.error('[exportRiwayatToXlsx]', err);
    throw new Error('Gagal membuat file Excel: ' + err.message);
  }
}

// ── Laporan Transaksi ──────────────────────────────────────────────────────

function buildReportSummaryRows(report) {
  const { summary } = report || {};
  if (!summary) return [];
  
  return [
    { 'Metric': 'Total Revenue', 'Value': summary.totalRevenue || 0 },
    { 'Metric': 'Total Transactions', 'Value': summary.totalTransactions || 0 },
    { 'Metric': 'Average Order Value', 'Value': summary.averageOrderValue || 0 },
    { 'Metric': 'Voided Transactions', 'Value': summary.voidedTransactions || 0 }
  ];
}

function buildTopProductsRows(report) {
  const { data } = report || {};
  if (!data?.topProducts) return [];
  
  return data.topProducts.map((p, idx) => ({
    'Rank': idx + 1,
    'Produk': p.name || String(p.id),
    'Qty Terjual': p.qty || 0,
    'Revenue': p.revenue || 0
  }));
}

/** Ekspor laporan ke file .xlsx */
export async function exportLaporanToXlsx(report = {}, meta = {}) {
  try {
    const XLSX = await loadXLSX();
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Laporan
    const summaryRows = buildReportSummaryRows(report);
    if (summaryRows.length) {
      addSheet(XLSX, workbook, 'Ringkasan', summaryRows);
    }

    // Sheet 2: Semua Transaksi
    const allTransactions = report?.data?.transactions || [];
    if (allTransactions.length) {
      addSheet(XLSX, workbook, 'Semua Transaksi', buildTransactionSummaryRows(allTransactions));
    }

    // Sheet 3: Top Products
    const topProductsRows = buildTopProductsRows(report);
    if (topProductsRows.length) {
      addSheet(XLSX, workbook, 'Top Products', topProductsRows);
    }

    const fileName = buildFileName(
      'laporan',
      rangeSuffix(meta.startDate, meta.endDate)
    );
    
    XLSX.writeFile(workbook, fileName, { compression: true });
    return fileName;
  } catch (err) {
    console.error('[exportLaporanToXlsx]', err);
    throw new Error('Gagal membuat file Excel: ' + err.message);
  }
}
