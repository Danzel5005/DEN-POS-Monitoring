// ── Excel (.xlsx) export helpers ───────────────────────────────────────────
// Menggunakan SheetJS (xlsx) untuk membangun workbook di sisi browser lalu
// memicu unduhan file. Semua nilai angka ditulis sebagai number (bukan string)
// supaya bisa langsung dijumlahkan/di-sort di Excel.

import { formatNumber } from './formatters';

// xlsx dimuat secara lazy (dynamic import) supaya tidak membebani bundle awal —
// library hanya diunduh saat user benar-benar menekan tombol Download.
let xlsxPromise = null;
function loadXLSX() {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
}

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

/**
 * Auto-fit lebar kolom berdasarkan panjang konten (dibatasi agar tidak terlalu
 * lebar). Nilai numerik diformat dengan pemisah ribuan agar ikut terhitung.
 */
function autoFitColumns(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const maxLen = rows.reduce((max, row) => {
      const raw = row[key];
      const text =
        typeof raw === 'number' ? formatNumber(raw) : String(raw ?? '');
      return Math.max(max, text.length);
    }, key.length);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });
}

/** Tambah sheet dari array of objects dengan header & lebar kolom otomatis. */
function addSheet(XLSX, workbook, name, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = autoFitColumns(rows);
  // Bekukan baris header.
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

function triggerDownload(XLSX, workbook, fileName) {
  XLSX.writeFile(workbook, fileName, { compression: true });
}

// ── Riwayat Transaksi ──────────────────────────────────────────────────────

/**
 * Bangun baris ringkasan per transaksi (satu baris = satu transaksi).
 */
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
      'Alasan Void': void_
        ? VOID_REASON_LABELS[t.voidReason] || t.voidReason || '-'
        : ''
    };
  });
}

/**
 * Bangun baris rincian per item (satu baris = satu item transaksi).
 */
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

/**
 * Ekspor riwayat transaksi ke file .xlsx.
 * @param {Array} transactions daftar transaksi yang sudah difilter
 * @param {{startDate?: string, endDate?: string, search?: string}} [meta]
 */
export async function exportRiwayatToXlsx(transactions = [], meta = {}) {
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
  triggerDownload(XLSX, workbook, fileName);
  return fileName;
}

// ── Laporan Transaksi ──────────────────────────────────────────────────────

/**
 * Ekspor laporan (ringkasan + transaksi + produk + metode bayar) ke .xlsx.
 * @param {object} report hasil reportService.getLaporan / data terfilter
 * @param {{startDate?: string, endDate?: string}} [meta]
 */
export async function exportLaporanToXlsx(report = {}, meta = {}) {
  const XLSX = await loadXLSX();
  const workbook = XLSX.utils.book_new();

  const summary = report.summary || {};
  const transactions = report.data?.transactions || [];
  const topProducts = report.data?.topProducts || [];

  // Sheet 1 — Ringkasan.
  const summaryRows = [
    { 'Metrik': 'Periode Awal', 'Nilai': meta.startDate || 'Semua data' },
    { 'Metrik': 'Periode Akhir', 'Nilai': meta.endDate || 'Semua data' },
    { 'Metrik': 'Total Pendapatan', 'Nilai': Number(summary.totalRevenue) || 0 },
    { 'Metrik': 'Total Transaksi', 'Nilai': Number(summary.totalTransactions) || 0 },
    { 'Metrik': 'Rata-rata Transaksi', 'Nilai': Math.round(Number(summary.averageOrderValue) || 0) },
    { 'Metrik': 'Transaksi Void', 'Nilai': Number(summary.voidedTransactions) || 0 },
    { 'Metrik': 'Tanggal Unduh', 'Nilai': formatDateTimeId(new Date()) }
  ];
  addSheet(XLSX, workbook, 'Ringkasan', summaryRows);

  // Sheet 2 — Transaksi (ringkasan per transaksi).
  if (transactions.length) {
    addSheet(XLSX, workbook, 'Transaksi', buildTransactionSummaryRows(transactions));
  }

  // Sheet 3 — Detail Item.
  const itemRows = buildTransactionItemRows(transactions);
  if (itemRows.length) {
    addSheet(XLSX, workbook, 'Detail Item', itemRows);
  }

  // Sheet 4 — Produk Terlaris.
  if (topProducts.length) {
    const productRows = topProducts.map((p, i) => ({
      'No': i + 1,
      'Produk': p.name || 'Unknown',
      'Qty Terjual': Number(p.qty) || 0,
      'Pendapatan': Math.round(Number(p.revenue) || 0)
    }));
    addSheet(XLSX, workbook, 'Produk Terlaris', productRows);
  }

  // Sheet 5 — Rekap Metode Bayar.
  const byMethod = new Map();
  for (const t of transactions) {
    if (isVoided(t)) continue;
    const method = paymentLabel(t);
    const paid = Number(t.bayar ?? t.paid ?? t.total) || 0;
    byMethod.set(method, (byMethod.get(method) || 0) + paid);
  }
  if (byMethod.size) {
    const methodRows = [...byMethod.entries()].map(([method, total]) => ({
      'Metode Bayar': method,
      'Total': Math.round(total)
    }));
    addSheet(XLSX, workbook, 'Metode Bayar', methodRows);
  }

  const fileName = buildFileName(
    'laporan-transaksi',
    rangeSuffix(meta.startDate, meta.endDate)
  );
  triggerDownload(XLSX, workbook, fileName);
  return fileName;
}
