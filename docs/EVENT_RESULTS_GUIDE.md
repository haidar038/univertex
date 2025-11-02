# 📊 Panduan Event Results Page

Halaman untuk melihat hasil pemilihan dengan visualisasi lengkap, statistik, dan fitur export.

---

## 🎯 Fitur Utama

1. **Vote Count Visualization** - Tampilan perolehan suara dengan chart interaktif
2. **Statistics Dashboard** - Statistik lengkap partisipasi pemilihan
3. **Winner Announcement** - Pengumuman pemenang dengan highlight khusus
4. **Bar Chart** - Grafik batang perolehan suara per kandidat
5. **Pie Chart** - Grafik lingkaran distribusi suara
6. **Export to CSV** - Download data hasil pemilihan dalam format CSV
7. **Export to PDF** - Print/save hasil pemilihan sebagai PDF
8. **Detailed Table** - Tabel detail dengan progress bar per kandidat

---

## 📍 Lokasi & Akses

### Cara Mengakses

1. Login sebagai **Admin**
2. Navigasi ke **Admin → Events**
3. Klik salah satu event untuk membuka detail
4. Klik tab **"Hasil Pemilihan"** (icon bar chart)

### Komponen

- **Lokasi**: `src/components/admin/events/EventResultsView.tsx`
- **Integrasi**: `src/pages/admin/EventDetail.tsx` (Tab ke-3)
- **Library**: Recharts untuk visualisasi

---

## 📈 Statistik yang Ditampilkan

### 1. Total Suara Masuk
- Jumlah total suara yang tercatat
- Icon: Vote
- Warna: Default

### 2. Pemilih Terdaftar
- Total DPT (Daftar Pemilih Tetap)
- Dihitung dari event_voter_groups
- Icon: Users
- Warna: Default

### 3. Tingkat Partisipasi
- Persentase partisipasi pemilih
- Formula: (Total Suara / Total DPT) × 100%
- Icon: TrendingUp
- Warna: Default

---

## 🏆 Winner Announcement

### Kriteria Pemenang
- Kandidat dengan **suara terbuka** (ranking #1)
- Hanya muncul jika ada suara yang masuk (totalVotes > 0)

### Tampilan
- **Background**: Gradient kuning/orange
- **Icon**: Trophy (🏆)
- **Info**: Nama, NIM, jumlah suara, persentase
- **Badge**: Perolehan suara dalam badge khusus

### Contoh
```
🎉 PEMENANG PEMILIHAN
John Doe
123456 - 150 suara (65.2%)
```

---

## 📊 Visualisasi Data

### 1. Bar Chart (Grafik Batang)

**Fungsi**: Menampilkan perbandingan perolehan suara antar kandidat

**Features**:
- X-Axis: Nama kandidat (rotasi -45° untuk readability)
- Y-Axis: Jumlah suara
- Grid: Dashed grid untuk kemudahan membaca
- Tooltip: Hover untuk detail
- Warna: Green (#10b981)

**Library**: Recharts BarChart

### 2. Pie Chart (Grafik Lingkaran)

**Fungsi**: Menampilkan distribusi persentase suara

**Features**:
- Label: Nama kandidat + persentase
- Colors: Array of 6 colors (green, blue, orange, red, purple, pink)
- Tooltip: Hover untuk detail
- Responsive: Auto-adjust size

**Library**: Recharts PieChart

---

## 📄 Export Features

### Export to CSV

**Fungsi**: Download hasil pemilihan dalam format CSV

**Format CSV**:
```csv
No,Nama Kandidat,NIM,Jumlah Suara,Persentase
1,John Doe,123456,150,65.22%
2,Jane Smith,123457,80,34.78%
```

**Features**:
- Auto-generate filename: `hasil_pemilihan_[EventTitle].csv`
- Encoding: UTF-8
- Separator: Comma (,)
- Header included

**Button**: "Export CSV" dengan icon FileText

### Export to PDF

**Fungsi**: Print/save hasil pemilihan sebagai PDF

**Metode**: Window.print() dengan HTML customized

**Content**:
1. Header dengan judul event
2. Status event
3. Statistik (3 cards)
4. Winner announcement (jika ada)
5. Tabel detail perolehan suara
6. Footer dengan tanggal generate

**Features**:
- Auto-trigger print dialog
- Professional layout
- Print-optimized CSS
- Date stamp

**Button**: "Export PDF" dengan icon Download

---

## 🎨 Komponen UI

### Statistics Cards

3 cards dalam grid layout (responsive):
- Card 1: Total Suara Masuk
- Card 2: Pemilih Terdaftar
- Card 3: Tingkat Partisipasi

### Winner Card

Conditional render (hanya jika ada pemenang):
- Gradient background (yellow-orange)
- Trophy icon (large)
- Candidate info prominent
- Badge dengan vote count

### Charts Section

Grid 2 kolom (responsive menjadi 1 kolom di mobile):
- Left: Bar Chart
- Right: Pie Chart

### Results Table

Table dengan features:
- Ranking column dengan trophy icon untuk #1
- Progress bar visual untuk persentase
- Hover effect
- Responsive horizontal scroll

---

## 🔧 Technical Details

### Data Fetching

**Query Flow**:
1. Fetch candidates dari event
2. Count votes per candidate (parallel)
3. Calculate percentages
4. Fetch total eligible voters from DPT
5. Calculate participation rate
6. Determine winner (highest votes)

**Performance**:
- Parallel queries dengan Promise.all
- Single fetch untuk classes
- Optimized count queries

### State Management

```typescript
interface CandidateResult {
  id: string;
  name: string;
  student_id: string;
  votes: number;
  percentage: number;
  photo_url?: string;
}

interface VotingStats {
  totalVotes: number;
  totalEligibleVoters: number;
  participationRate: number;
  winner: CandidateResult | null;
}
```

### Responsive Design

- Mobile: Single column layout
- Tablet: 2 column grid untuk charts
- Desktop: Full grid dengan 3 stats cards

---

## 📱 User Experience

### Loading State

```
"Memuat hasil pemilihan..."
```

Centered loading text saat fetch data.

### Empty State

Jika belum ada kandidat atau suara:

```
⚠️ Belum Ada Data
Belum ada kandidat atau belum ada suara yang masuk untuk pemilihan ini.
```

### Success State

Tampilan lengkap dengan:
- Export buttons di header
- 3 statistics cards
- Winner announcement (if applicable)
- 2 charts (bar & pie)
- Detail table

---

## 🎯 Use Cases

### Use Case 1: Monitoring Hasil Real-time

**Skenario**: Admin ingin memantau hasil sementara saat pemilihan berlangsung

**Flow**:
1. Admin buka tab "Hasil Pemilihan"
2. Sistem fetch data terbaru
3. Chart dan stats ter-update
4. Admin dapat lihat kandidat mana yang unggul
5. Refresh manual untuk update terbaru

### Use Case 2: Publikasi Hasil Akhir

**Skenario**: Pemilihan selesai, admin ingin export hasil untuk publikasi

**Flow**:
1. Admin pastikan event status = "closed"
2. Buka tab "Hasil Pemilihan"
3. Verifikasi data sudah benar
4. Klik "Export PDF"
5. Print/save as PDF
6. Share PDF ke stakeholders

### Use Case 3: Analisis Data Pemilihan

**Skenario**: Admin ingin analisa data pemilihan lebih detail

**Flow**:
1. Admin buka tab "Hasil Pemilihan"
2. Lihat visualisasi untuk quick insights
3. Klik "Export CSV"
4. Buka CSV di Excel/Sheets
5. Lakukan analisa lanjutan (pivot, formula, etc)

### Use Case 4: Verifikasi Pemenang

**Skenario**: Panitia ingin officially mengumumkan pemenang

**Flow**:
1. Admin buka tab "Hasil Pemilihan"
2. Cek winner announcement card (highlight kuning)
3. Verifikasi nama, NIM, jumlah suara
4. Screenshot atau export PDF untuk dokumentasi
5. Umumkan ke publik

---

## 🔐 Security & Privacy

### Data Access

- Hanya **Admin** yang dapat melihat hasil pemilihan
- Route protected via admin role check
- No public API untuk hasil (kecuali event status = closed)

### Vote Privacy

- Results hanya aggregate count
- Tidak ada tracking voter individual
- Anonimitas terjaga

### Export Security

- CSV/PDF generate client-side (no server storage)
- File auto-download (tidak tersimpan di server)
- Filename include event title untuk identifikasi

---

## 🎨 Customization Options

### Chart Colors

Edit array COLORS di component:
```typescript
const COLORS = [
  '#10b981', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899'  // Pink
];
```

### Winner Card Theme

Customize gradient di Winner Card:
```tsx
className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200"
```

### Export Filename

Edit di exportToCSV function:
```typescript
link.download = `hasil_pemilihan_${eventTitle.replace(/\s+/g, '_')}.csv`;
```

---

## 🐛 Troubleshooting

### Chart tidak muncul

**Masalah**: Chart kosong atau tidak render

**Penyebab**:
- Data belum loaded
- Recharts tidak terimport
- Container size issues

**Solusi**:
```bash
# Pastikan recharts terinstall
npm install recharts

# Cek import di component
import { BarChart, Bar, ... } from 'recharts';

# Pastikan ResponsiveContainer digunakan
<ResponsiveContainer width="100%" height={300}>
```

### Export CSV tidak trigger download

**Masalah**: Klik Export CSV tidak download file

**Penyebab**:
- Browser block popup
- Blob URL issue
- Permission error

**Solusi**:
- Allow popups untuk site
- Cek browser console untuk error
- Test di browser lain

### Export PDF blank page

**Masalah**: PDF kosong saat export

**Penyebab**:
- Popup blocker
- window.open() failed
- Print CSS issue

**Solusi**:
- Allow popups
- Check browser popup settings
- Test print preview manually

### Statistik tidak akurat

**Masalah**: Angka tidak match dengan data asli

**Penyebab**:
- Query error
- DPT tidak diset
- Cache issue

**Solusi**:
```typescript
// Pastikan query DPT benar
const { data: voterGroupsData } = await supabase
  .from('event_voter_groups')
  .select('class_id')
  .eq('event_id', eventId);

// Count profiles dengan filter
const { count } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .in('class_id', classIds);
```

### Winner tidak muncul padahal ada votes

**Masalah**: Winner card tidak tampil

**Penyebab**:
- totalVotes = 0
- All candidates tied dengan 0 votes
- Conditional render issue

**Solusi**:
```typescript
// Cek conditional
{stats.winner && stats.totalVotes > 0 && (
  <WinnerCard />
)}

// Pastikan sorting benar
candidateResults.sort((a, b) => b.votes - a.votes);
```

---

## 📊 Data Flow Diagram

```
EventDetail (page)
    │
    ├─→ Tab: Results
    │     │
    │     └─→ EventResultsView (component)
    │           │
    │           ├─→ Fetch Candidates
    │           ├─→ Count Votes (parallel)
    │           ├─→ Fetch DPT
    │           ├─→ Calculate Stats
    │           │
    │           └─→ Render:
    │                 ├─→ Statistics Cards
    │                 ├─→ Winner Announcement
    │                 ├─→ Bar Chart
    │                 ├─→ Pie Chart
    │                 └─→ Results Table
    │
    └─→ Export Functions:
          ├─→ exportToCSV()
          └─→ exportToPDF()
```

---

## 🚀 Future Enhancements

Fitur yang bisa ditambahkan di masa depan:

1. **Real-time Updates**
   - Supabase Realtime subscription
   - Auto-refresh saat ada vote baru
   - Live animation

2. **Advanced Analytics**
   - Vote trend over time (line chart)
   - Demographic breakdown
   - Voter turnout by class

3. **Export Options**
   - Export as PNG/JPG (chart images)
   - Excel (.xlsx) export
   - Share to social media

4. **Comparison View**
   - Compare multiple events
   - Historical data analysis
   - Year-over-year trends

5. **Email Reports**
   - Auto-email hasil ke stakeholders
   - Schedule periodic reports
   - Custom recipients

---

## 📞 Support

Jika ada pertanyaan atau issues terkait Event Results:
1. Cek dokumentasi ini terlebih dahulu
2. Review kode komponen `EventResultsView.tsx`
3. Test dengan data sample
4. Contact IT Admin jika masalah berlanjut

---

**Last Updated**: 2025-11-01
**Author**: Claude Code Assistant
**Version**: 1.0.0
