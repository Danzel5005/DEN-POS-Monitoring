# DENPOS Monitoring Frontend

React-based web application for monitoring point-of-sale transactions, viewed at https://kasir-masak.my.id/. Built with Supabase as the data source and deployed via Vercel.

## Features

- Transaction History (Riwayat) - View all synced POS transactions with filters by date range and search
- Reports (Laporan) - Dashboard with revenue summary, sales charts, and payment method breakdowns
- Device Management (Devices) - Pair and manage POS devices, revoke access, and monitor device status
- Store Overview (Account) - View store information and membership details
- Data Synchronization (Sync Data) - Manually trigger data sync from POS systems
- Excel Export - Download transaction history and reports in .xlsx format with optional filtering

## Tech Stack

- React 18
- Vite (build tool)
- Tailwind CSS (styling framework)
- Supabase (database and authentication)
- React Router (navigation)
- Recharts (data visualization)
- SheetJS / xlsx (Excel export)
- react-icons (icon library)
- date-fns (date formatting)

## Installation

### Prerequisites

- Node.js 16+ and npm installed
- Git installed

### Steps

1. Clone the repository

```bash
git clone <repository-url>
cd monitoring-frontend
```

2. Install dependencies

```bash
npm install
```

3. Create environment configuration files

Copy `.env.example` to `.env.local` (if available), then configure:

```
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Start development server

```bash
npm run dev
```

The app will open at http://localhost:5173 by default.

## Build for Production

Build optimized production assets:

```bash
npm run build
```

Output is placed in the `dist/` directory.

Preview production build locally:

```bash
npm run preview
```

## Usage Guide

### Transaction History (Riwayat)

1. Navigate to Riwayat tab
2. Use Filter & Cari card to:
   - Set start date ("Dari Tanggal")
   - Set end date ("Sampai Tanggal")
   - Search by transaction ID, payment method, or customer name
3. Click "Download Excel" to export filtered transactions to .xlsx
4. Click individual transactions to view detailed items and payment info

### Reports (Laporan)

1. Navigate to Laporan tab
2. Set desired date range in Filter & Cari card
3. Click "Terapkan Filter" to apply and load report data
4. View charts showing top-selling products and payment method distribution
5. Scroll down to see top products table with quantities and revenue
6. Click "Download Excel" to generate comprehensive report including:
   - Summary metrics
   - All transactions in period
   - Detailed item breakdown
   - Top products ranking
   - Payment method recap

### Device Management

1. Navigate to Devices tab
2. Click "Pasang Perangkat Baru" and enter pairing code from your POS device
3. View connected devices with last-seen timestamps
4. Revoke inactive devices using the Revoke button
5. Reactivate revoked devices when needed

## Project Structure

```
monitoring-frontend/
├── src/
│   ├── components/          # React UI components
│   │   ├── AccountView.jsx
│   │   ├── AuthScreen.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DevicesView.jsx
│   │   ├── LaporanView.jsx
│   │   ├── RiwayatView.jsx
│   │   └── SyncDataView.jsx
│   ├── services/            # API and data layer
│   │   ├── authService.js
│   │   ├── supabaseClient.js
│   │   └── syncService.js
│   ├── utils/               # Utility functions
│   │   ├── excelExport.js   # Excel generation helpers
│   │   └── formatters.js    # Date and currency formatters
│   ├── App.jsx              # Main app component
│   ├── index.css            # Global styles
│   └── main.jsx             # Entry point
├── dist/                    # Production build output
├── package.json
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind settings
├── postcss.config.js        # PostCSS setup
├── vercel.json              # Vercel deployment config
├── EXCEL-DOWNLOAD-FEATURE.md
└── README.md                # This file
```

## Environment Variables

Create a `.env.local` file in the project root with:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Replace values with actual credentials from your Supabase dashboard.

## Deployment

The project is configured for Vercel deployment. The `vercel.json` file contains routing and build settings.

To deploy:

```bash
npx vercel --prod
```

Or connect the repository to Vercel's dashboard for automatic deployments on push.

## Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build
- `npm run preview` - Preview production build locally

## Browser Compatibility

Supported browsers include modern versions of:
- Chrome
- Firefox
- Safari
- Edge

Requires ES modules support and localStorage for session management.

## License

Proprietary software for DENPOS internal use only.
