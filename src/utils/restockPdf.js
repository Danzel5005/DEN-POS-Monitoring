const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

export function printRestockSummary({ type, items, createdAt = new Date() }) {
  const popup = window.open("", "_blank", "width=800,height=650");
  if (!popup) return false;

  const rows = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(item.unit || "pcs")}</td>
    </tr>`).join("");

  popup.document.write(`<!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Ringkasan Isi Stok</title>
        <style>
          body { color: #18221b; font: 14px Arial, sans-serif; margin: 36px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          p { color: #5c675f; margin: 0 0 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border-bottom: 1px solid #d9e0da; padding: 10px 8px; text-align: left; }
          th { background: #f1f5f1; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <h1>Ringkasan Isi Stok</h1>
        <p>Jenis: ${escapeHtml(type)} · Dibuat: ${escapeHtml(new Date(createdAt).toLocaleString("id-ID"))}</p>
        <table>
          <thead><tr><th>Nama item</th><th>Jumlah ditambahkan</th><th>Satuan</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`);
  popup.document.close();
  return true;
}