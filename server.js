/**
 * GreenAction — National Environmental Innovation & Sustainability Platform
 * Created & Developed By: Dika X Dev
 * Server: Express + JSON file DB. Port 9100.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 9100;
const HOST = process.env.HOST || '0.0.0.0';

// ====== UTIL: JSON DB ======
const DATA_DIR = path.join(__dirname, 'data');
function getDB(name, fallback) {
  const f = path.join(DATA_DIR, name);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; }
}
function saveDB(name, data) {
  const f = path.join(DATA_DIR, name);
  fs.writeFileSync(f + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(f + '.tmp', f);
}

// ====== AUTH UTILS (scrypt hash, no plaintext) ======
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}
const sessions = {}; // token -> { userId, role, exp }
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function authUser(req) {
  const tk = (req.headers.authorization || '').replace('Bearer ', '');
  const s = sessions[tk];
  if (!s || s.exp < Date.now()) return null;
  return s;
}
function requireAuth(req, res, next) {
  const s = authUser(req);
  if (!s) return res.status(401).json({ success: false, message: 'Silakan login dulu' });
  req.session = s;
  next();
}
function requireAdmin(req, res, next) {
  const s = authUser(req);
  if (!s) return res.status(401).json({ success: false, message: 'Silakan login dulu' });
  if (s.role !== 'admin') return res.status(403).json({ success: false, message: 'Akses admin diperlukan' });
  req.session = s;
  next();
}
// Simple rate limiting (per-IP, per-endpoint group)
const rateMap = {};
function rateLimit(group, max, windowMs) {
  return (req, res, next) => {
    const key = group + ':' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    const now = Date.now();
    rateMap[key] = (rateMap[key] || []).filter(t => now - t < windowMs);
    if (rateMap[key].length >= max) return res.status(429).json({ success: false, message: 'Terlalu banyak permintaan, coba lagi nanti' });
    rateMap[key].push(now);
    next();
  };
}

app.use(express.json({ limit: '2mb' })); // upload batas 2MB base64
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1d' }));

// ====== SEED DATA (demo, dilabeli demo) ======
function seed() {
  if (!fs.existsSync(path.join(DATA_DIR, 'seeded.lock'))) {
    const users = [
      { id: 'U001', nama: 'Dika', email: 'admin@greenaction.id', password: hashPassword('admin123'), role: 'admin', bio: 'Project Creator & Lead Developer GreenAction', lokasi: 'Indonesia', avatar: '', poin: 1250, kontribusi: 48, dibuat: '2026-10-01' },
      { id: 'U002', nama: 'Sari Wulandari', email: 'sari@demo.id', password: hashPassword('demo123'), role: 'user', bio: 'Aktivis lingkungan muda, fokus pengelolaan sampah', lokasi: 'Yogyakarta', avatar: '', poin: 870, kontribusi: 32, dibuat: '2026-10-03' },
      { id: 'U003', nama: 'Budi Santoso', email: 'budi@demo.id', password: hashPassword('demo123'), role: 'user', bio: 'Relawan penanaman pohon sejak 2023', lokasi: 'Bandung', avatar: '', poin: 640, kontribusi: 25, dibuat: '2026-10-05' },
      { id: 'U004', nama: 'Maya Putri', email: 'maya@demo.id', password: hashPassword('demo123'), role: 'user', bio: 'Penggiat konservasi laut & beach cleanup', lokasi: 'Bali', avatar: '', poin: 520, kontribusi: 19, dibuat: '2026-10-08' },
    ];
    const campaigns = [
      { id: 'CMP-001', judul: 'Reboisasi Hutan Kalimantan', kategori: 'Reforestation', deskripsi: 'Penanaman 10.000 bibit pohon endemic untuk memulihkan kawasan hutan yang terdegradasi di Kalimantan Tengah. Program bekerja sama dengan kelompok tani lokal dan pemuda desa.', foto: '/img/campaigns/reforestation.jpg', lokasi: 'Kalimantan Tengah', target: 10000, progress: 6420, relawan: 218, status: 'AKTIF', tenggat: '2027-03-31', organizer: 'GreenAction x Kelompok Tani Sejahtera' },
      { id: 'CMP-002', judul: 'Laut Bebas Plastik 2027', kategori: 'Ocean Conservation', deskripsi: 'Kampanye pengurangan sampah plastik di pesisir Bali dan Lombok melalui beach cleanup rutin bulanan serta edukasi warung pantai.', foto: '/img/campaigns/ocean.jpg', lokasi: 'Bali & Lombok', target: 5000, progress: 3810, relawan: 342, status: 'AKTIF', tenggat: '2027-06-30', organizer: 'Komunitas Lestari Laut' },
      { id: 'CMP-003', judul: 'Bank Sampah Digital Desa', kategori: 'Waste Management', deskripsi: 'Pembangunan 20 unit bank sampah digital di desa-desa Jawa Tengah dengan pencatatan timbangan otomatis dan tabungan sampah warga.', foto: '/img/campaigns/waste.jpg', lokasi: 'Jawa Tengah', target: 20, progress: 12, relawan: 96, status: 'AKTIF', tenggat: '2027-01-31', organizer: 'Yayasan Sampah Berdaya' },
      { id: 'CMP-004', judul: 'Panel Surya Sekolah Adat', kategori: 'Clean Energy', deskripsi: 'Pemasangan panel surya 5kWp di 8 sekolah adat terpencil agar pembelajaran digital tidak terputus.', foto: '/img/campaigns/cleanenergy.jpg', lokasi: 'Papua', target: 8, progress: 5, relawan: 54, status: 'AKTIF', tenggat: '2027-09-30', organizer: 'Energi untuk Negeri' },
      { id: 'CMP-005', judul: 'Koridor Satwa Jawa Barat', kategori: 'Biodiversity', deskripsi: 'Restorasi koridor satwa antar hutan lindung di Jawa Barat dengan penanaman pohon pakan dan pemantauan kamera jebak.', foto: '/img/campaigns/biodiversity.jpg', lokasi: 'Jawa Barat', target: 3000, progress: 940, relawan: 77, status: 'AKTIF', tenggat: '2027-12-31', organizer: 'Forest Guardians ID' },
      { id: 'CMP-006', judul: 'Sumur Resapan Kota', kategori: 'Water Conservation', deskripsi: 'Pembangunan 100 sumur resapan di kawasan padat Jakarta dan Bekasi untuk mengurangi genangan dan mengisi air tanah.', foto: '/img/campaigns/water.jpg', lokasi: 'Jakarta & Bekasi', target: 100, progress: 31, relawan: 128, status: 'AKTIF', tenggat: '2027-08-31', organizer: 'Air untuk Semua' },
    ];
    const activities = [
      { id: 'ACT-001', judul: 'Penanaman Pohon Musim Hujan', jenis: 'Tree Planting', deskripsi: 'Penanaman 500 bibit matoa & kemiri di lereng kritis. Peserta membawa sarung tangan sendiri, alat disediakan.', foto: '/img/activities/planting.jpg', lokasi: 'Sleman, Yogyakarta', tanggal: '2026-11-16', kuota: 80, terisi: 63, status: 'BUKA', komunitas: 'Tunas Hijau Jogja', poin: 50 },
      { id: 'ACT-002', judul: 'Bersih Sungai Code', jenis: 'River Cleanup', deskripsi: 'Pembersihan sampah sepanjang 2 km bantaran Sungai Code. Sortir sampah dilakukan di titik akhir bersama bank sampah.', foto: '/img/activities/cleanup.jpg', lokasi: 'Kota Yogyakarta', tanggal: '2026-11-09', kuota: 120, terisi: 87, status: 'BUKA', komunitas: 'Sungai Sehat ID', poin: 40 },
      { id: 'ACT-003', judul: 'Beach Cleanup Kuta', jenis: 'Beach Cleanup', deskripsi: 'Pembersihan pantai 3 km + edukasi pengurangan plastik ke pengunjung pantai.', foto: '/img/activities/beach.jpg', lokasi: 'Badung, Bali', tanggal: '2026-11-23', kuota: 150, terisi: 141, status: 'HAMPIR PENUH', komunitas: 'Lestari Laut Bali', poin: 45 },
      { id: 'ACT-004', judul: 'Kelas Composting Rumah Tangga', jenis: 'Education', deskripsi: 'Workshop kompos dari sampah organik dapur untuk 60 keluarga peserta. Setiap peserta membawa sampah organik sendiri.', foto: '/img/activities/education.jpg', lokasi: 'Bandung', tanggal: '2026-11-30', kuota: 60, terisi: 38, status: 'BUKA', komunitas: 'Taman Kompos Bandung', poin: 35 },
      { id: 'ACT-005', judul: 'Dapur Hijau Komunitas', jenis: 'Community Gardening', deskripsi: 'Membangun kebun komunitas Pekarangan Pangan Lestari di lahan kering kelurahan. Bibit sayur disediakan.', foto: '/img/activities/garden.jpg', lokasi: 'Semarang', tanggal: '2026-12-07', kuota: 50, terisi: 22, status: 'BUKA', komunitas: 'Pekarangan Semarang', poin: 40 },
    ];
    const communities = [
      { id: 'KOM-001', nama: 'Tunas Hijau Jogja', deskripsi: 'Komunitas kepemudaan lingkungan Yogyakarta. Fokus reboisasi & river cleanup. 5 tahun aktif.', foto: '/img/community/team1.jpg', anggota: 412, kegiatan: 47, lokasi: 'Yogyakarta', terverifikasi: true },
      { id: 'KOM-002', nama: 'Lestari Laut Bali', deskripsi: 'Komunitas konservasi laut Bali. Beach cleanup mingguan & adopsi terumbu karang.', foto: '/img/community/team2.jpg', anggota: 356, kegiatan: 62, lokasi: 'Bali', terverifikasi: true },
      { id: 'KOM-003', nama: 'Sampah Berdaya Bandung', deskripsi: 'Penggiat bank sampah & daur ulang kreatif di Bandung Raya.', foto: '/img/community/team3.jpg', anggota: 289, kegiatan: 35, lokasi: 'Bandung', terverifikasi: true },
    ];
    const challenges = [
      { id: 'CHL-001', judul: 'Kurangi Plastik Sekali Pakai', periode: 'Mingguan', tingkat: 'Sedang', deskripsi: '7 hari tanpa kantong plastik & sedotan sekali pakai. Unggah foto tumbler/belahmu sebagai bukti.', poin: 100, ikon: 'ban' },
      { id: 'CHL-002', judul: 'Hemat Air', periode: 'Mingguan', tingkat: 'Mudah', deskripsi: 'Kurangi konsumsi air mandi 20% selama 7 hari. Catat penggunaan di kartu tantangan.', poin: 60, ikon: 'tint' },
      { id: 'CHL-003', judul: 'Tanam Pohon', periode: 'Bulanan', tingkat: 'Sedang', deskripsi: 'Tanam minimal 1 pohon dan rawat selama 30 hari. Unggah foto progres mingguan.', poin: 250, ikon: 'seedling' },
      { id: 'CHL-004', judul: 'Pilah Sampah Rumah', periode: 'Harian', tingkat: 'Mudah', deskripsi: 'Pilah sampah organik & anorganik 3 hari berturut. Foto hasil pilahan sebagai bukti.', poin: 40, ikon: 'recycle' },
      { id: 'CHL-005', judul: 'Transportasi Berkelanjutan', periode: 'Mingguan', tingkat: 'Sulit', deskripsi: 'Sepeda/jalan kaki 3x seminggu untuk jarak < 5 km.', poin: 150, ikon: 'bicycle' },
      { id: 'CHL-006', judul: 'Community Cleanup', periode: 'Bulanan', tingkat: 'Sulit', deskripsi: 'Ikuti minimal 1 kegiatan cleanup komunitas bulan ini.', poin: 200, ikon: 'users' },
    ];
    const articles = [
      { id: 'ART-001', judul: 'Kenapa Pilah Sampah dari Rumah Itu Penting', kategori: 'Edukasi Sampah', ringkas: 'Sampah terpilah sejak rumah menaikkan nilai daur ulang hingga 3 kali lipat. Ini langkah praktisnya.', isi: 'Menurut data SIPSN KLHK, timbulan sampah nasional mencapai lebih dari 30 juta ton per tahun dan dominan berupa sampah organik yang belum terolah. Pilah sederhana di rumah — organik, anorganik, dan residu — mempermudah bank sampah dan meningkatkan nilai ekonomi sampah anorganik. Mulailah dari dua wadah di dapur, kosongkan botol plastik sebelum dibuang, dan pisahkan bahan berbahaya (baterai, lampu) untuk pengumpulan khusus.', sumber: 'SIPSN KLHK (sipsn.menlhk.go.id)', tanggal: '2026-10-12', foto: '/img/activities/recycling.jpg' },
      { id: 'ART-002', judul: 'Manfaat Pohon Kota bagi Suhu Perkotaan', kategori: 'Hijau Kota', ringkas: 'Satu pohon dewasa setara pendingin ruangan 10 AC sepanjang siang hari. Bagaimana kanopi pohon mendinginkan kota.', isi: 'Kanopi pohon menurunkan suhu permukaan melalui bayangan dan evapotranspirasi. Riset urban climate menunjukkan kawasan bertanaman lebat bisa lebih dingin 2–8°C dibanding kawasan padat beton pada siang hari (fenomena urban heat island). Pohon juga menyerap polutan udara dan memperlambat limpasan hujan. Karena itu program sumur resapan + penanaman pohon jalan perlu berjalan bersama.', sumber: 'US EPA — Heat Island Effect', tanggal: '2026-10-20', foto: '/img/campaigns/biodiversity.jpg' },
      { id: 'ART-003', judul: 'Mengenal Bank Sampah dan Cara Kerjanya', kategori: 'Ekonomi Sirkular', ringkas: 'Bank sampah bukan sekadar tempat setor — ia adalah mesin ekonomi sirkular skala desa.', isi: 'Bank sampah bekerja seperti bank konvensional: warga menyetor sampah terpilah yang bernilai (plastik, kertas, logam), ditimbang dan dicatat, lalu dikonversi menjadi tabungan uang. Sampah dijual ke pengepul atau didaur ulang unit usaha bank sampah. Model ini terbukti menaikkan pengumpulan sampah anorganik di berbagai daerah dan memberi tambahan penghasilan warga.', sumber: 'KLHK — Pedoman Bank Sampah', tanggal: '2026-10-28', foto: '/img/campaigns/waste.jpg' },
      { id: 'ART-004', judul: 'Tips Berhemat Energi di Rumah', kategori: 'Energi', ringkas: 'Listrik = emisi. Pangkas tagihan dan jejak karbon dengan 6 kebiasaan sederhana ini.', isi: 'Sektor ketenagalistrikan menyumbang porsi besar emisi nasional. Cara hemat: gunakan lampu LED, cabut charger tak dipakai, atur AC 24–25°C, cuci dengan muatan penuh, manfaatkan cahaya alami, dan pertimbangkan panel surya rooftop bila memungkinkan. Perubahan kecil per rumah, dampak besar skala kota.', sumber: 'IEA — Energy Efficiency Tips', tanggal: '2026-11-02', foto: '/img/hero/solar.jpg' },
    ];
    const reports = [
      { id: 'RPT-001', judul: 'Sampah menumpuk di bantalan kali', kategori: 'Sampah Menumpuk', deskripsi: 'Sampah plastik menumpuk di bantalan kali dekat jembatan, bau menyengat dan mengganggu warga.', lokasi: 'Yogyakarta', tanggal: '2026-10-30', status: 'Verified', pelapor: 'U002', foto: '' },
      { id: 'RPT-002', judul: 'Air sungai keruh kehitaman', kategori: 'Pencemaran Air', deskripsi: 'Terdapat cairan kehitaman mengalir ke sungai dari selokan pabrik di hulu.', lokasi: 'Bandung', tanggal: '2026-11-01', status: 'Under Review', pelapor: 'U003', foto: '' },
      { id: 'RPT-003', judul: 'Penebangan liar di tepi hutan', kategori: 'Penebangan Pohon', deskripsi: 'Ditemukan 5 pohon ditebak di kawasan hutan lindung dekat jalur pendakian.', lokasi: 'Jawa Barat', tanggal: '2026-10-25', status: 'In Progress', pelapor: 'U004', foto: '' },
    ];
    const mapPoints = [
      { id: 'MP-01', nama: 'Bank Sampah Gemilang', kategori: 'Bank Sampah', lat: -7.7956, lng: 110.3695, alamat: 'Jl. Kaliurang KM 5, Sleman' },
      { id: 'MP-02', nama: 'Pusat Daur Ulang Cikarang', kategori: 'Pusat Daur Ulang', lat: -6.2915, lng: 107.1523, alamat: 'Kawasan Industri Cikarang' },
      { id: 'MP-03', nama: 'Taman Kota Hijau', kategori: 'Ruang Hijau Publik', lat: -6.1754, lng: 106.8272, alamat: 'Monas, Jakarta Pusat' },
      { id: 'MP-04', nama: 'Lokasi Penanaman Mangrove', kategori: 'Lokasi Penanaman', lat: -6.0954, lng: 106.8319, alamat: 'Muara Angke, Jakarta' },
      { id: 'MP-05', nama: 'Beach Cleanup Point Kuta', kategori: 'Kegiatan Lingkungan', lat: -8.7184, lng: 115.1686, alamat: 'Pantai Kuta, Bali' },
      { id: 'MP-06', nama: 'Laporan: Sampah Bantaran Kali', kategori: 'Laporan Lingkungan', lat: -7.8032, lng: 110.3648, alamat: 'Sungai Code, Yogyakarta', reportId: 'RPT-001' },
    ];
    const stats = { trees: 6420, waste: 3810, volunteers: 923, activities: 275 };
    saveDB('users.json', users); saveDB('campaigns.json', campaigns); saveDB('activities.json', activities);
    saveDB('communities.json', communities); saveDB('challenges.json', challenges); saveDB('articles.json', articles);
    saveDB('reports.json', reports); saveDB('mappoints.json', mapPoints); saveDB('stats.json', stats);
    saveDB('joinreqs.json', []); saveDB('saveditems.json', {}); saveDB('achievements.json', []);
    fs.writeFileSync(path.join(DATA_DIR, 'seeded.lock'), 'seeded');
  }
}
seed();

// ====== API ======
const api = express.Router();
app.use('/api', api);

// --- auth ---
api.post('/auth/register', rateLimit('auth', 10, 60_000), (req, res) => {
  const { nama, email, password, lokasi } = req.body;
  if (!nama || !email || !password) return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi' });
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password minimal 8 karakter' });
  const users = getDB('users.json', []);
  if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
  const u = { id: 'U' + String(Date.now()).slice(-6), nama, email: String(email).toLowerCase(), password: hashPassword(password), role: 'user', bio: '', lokasi: lokasi || '', avatar: '', poin: 0, kontribusi: 0, dibuat: new Date().toISOString().slice(0, 10) };
  users.push(u); saveDB('users.json', users);
  const tk = makeToken(); sessions[tk] = { userId: u.id, role: u.role, exp: Date.now() + 7 * 864e5 };
  res.json({ success: true, token: tk, user: { id: u.id, nama: u.nama, email: u.email, role: u.role, poin: u.poin } });
});
api.post('/auth/login', rateLimit('auth', 15, 60_000), (req, res) => {
  const { email, password } = req.body;
  const users = getDB('users.json', []);
  const u = users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u || !verifyPassword(String(password || ''), u.password)) return res.status(401).json({ success: false, message: 'Email atau password salah' });
  const tk = makeToken(); sessions[tk] = { userId: u.id, role: u.role, exp: Date.now() + 7 * 864e5 };
  res.json({ success: true, token: tk, user: { id: u.id, nama: u.nama, email: u.email, role: u.role, poin: u.poin } });
});
api.post('/auth/logout', (req, res) => {
  const tk = (req.headers.authorization || '').replace('Bearer ', '');
  delete sessions[tk];
  res.json({ success: true });
});
api.get('/auth/me', requireAuth, (req, res) => {
  const users = getDB('users.json', []);
  const u = users.find(x => x.id === req.session.userId);
  if (!u) return res.status(404).json({ success: false });
  const { password, ...safe } = u;
  res.json({ success: true, user: safe });
});

// --- public data ---
api.get('/campaigns', (req, res) => {
  let items = getDB('campaigns.json', []);
  const { kategori, q, sort } = req.query;
  if (kategori && kategori !== 'Semua') items = items.filter(c => c.kategori === kategori);
  if (q) items = items.filter(c => (c.judul + c.deskripsi).toLowerCase().includes(String(q).toLowerCase()));
  if (sort === 'progress') items.sort((a, b) => (b.progress / b.target) - (a.progress / a.target));
  if (sort === 'relawan') items.sort((a, b) => b.relawan - a.relawan);
  res.json({ success: true, items, demo: true });
});
api.get('/campaigns/:id', (req, res) => {
  const c = getDB('campaigns.json', []).find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ success: false, message: 'Kampanye tidak ditemukan' });
  res.json({ success: true, item: c, demo: true });
});
api.get('/activities', (req, res) => res.json({ success: true, items: getDB('activities.json', []), demo: true }));
api.get('/activities/:id', (req, res) => {
  const a = getDB('activities.json', []).find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ success: false });
  res.json({ success: true, item: a, demo: true });
});
api.get('/communities', (req, res) => res.json({ success: true, items: getDB('communities.json', []), demo: true }));
api.get('/communities/:id', (req, res) => {
  const c = getDB('communities.json', []).find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ success: false });
  res.json({ success: true, item: c, demo: true });
});
api.get('/challenges', (req, res) => res.json({ success: true, items: getDB('challenges.json', []), demo: true }));
api.get('/articles', (req, res) => res.json({ success: true, items: getDB('articles.json', []) }));
api.get('/articles/:id', (req, res) => {
  const a = getDB('articles.json', []).find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ success: false });
  res.json({ success: true, item: a });
});
api.get('/mappoints', (req, res) => res.json({ success: true, items: getDB('mappoints.json', []), demo: true }));
api.get('/stats', (req, res) => res.json({ success: true, stats: getDB('stats.json', {}), demo: true }));
api.get('/leaderboard', (req, res) => {
  const users = getDB('users.json', []).map(u => ({ id: u.id, nama: u.nama, lokasi: u.lokasi, poin: u.poin, kontribusi: u.kontribusi }));
  users.sort((a, b) => b.poin - a.poin);
  res.json({ success: true, items: users, demo: true });
});
api.get('/reports', (req, res) => {
  const users = getDB('users.json', []);
  const items = getDB('reports.json', []).map(r => ({ ...r, pelaporNama: (users.find(u => u.id === r.pelapor) || {}).nama || 'Anonim' }));
  res.json({ success: true, items });
});

// --- join / partisipasi ---
api.post('/join', requireAuth, rateLimit('join', 20, 60_000), (req, res) => {
  const { type, id } = req.body;
  if (!['campaign', 'activity'].includes(type)) return res.status(400).json({ success: false });
  const reqs = getDB('joinreqs.json', []);
  const key = req.session.userId + ':' + type + ':' + id;
  if (reqs.find(r => r.key === key)) return res.status(409).json({ success: false, message: 'Kamu sudah mendaftar di item ini' });
  reqs.push({ key, userId: req.session.userId, type, id, status: 'Pending', dibuat: new Date().toISOString() });
  saveDB('joinreqs.json', reqs);
  res.json({ success: true, status: 'Pending' });
});
api.get('/my/joins', requireAuth, (req, res) => {
  const reqs = getDB('joinreqs.json', []).filter(r => r.userId === req.session.userId);
  res.json({ success: true, items: reqs });
});
api.post('/my/cancel/:key', requireAuth, (req, res) => {
  const reqs = getDB('joinreqs.json', []);
  const r = reqs.find(x => x.key === req.params.key && x.userId === req.session.userId);
  if (!r) return res.status(404).json({ success: false });
  r.status = 'Cancelled'; saveDB('joinreqs.json', reqs);
  res.json({ success: true });
});

// --- challenges progress ---
api.post('/challenges/:id/progress', requireAuth, (req, res) => {
  const ch = getDB('challenges.json', []).find(c => c.id === req.params.id);
  if (!ch) return res.status(404).json({ success: false });
  const all = getDB('achievements.json', []);
  const key = req.session.userId + ':' + ch.id;
  let rec = all.find(a => a.key === key);
  if (!rec) { rec = { key, userId: req.session.userId, challengeId: ch.id, progress: 0, streak: 0, selesai: false }; all.push(rec); }
  if (!rec.selesai) {
    rec.progress += 1;
    rec.streak += 1;
    if (rec.progress >= 7) { rec.selesai = true; rec.tanggalSelesai = new Date().toISOString(); }
  }
  saveDB('achievements.json', all);
  res.json({ success: true, progress: rec.progress, streak: rec.streak, selesai: rec.selesai });
});
api.get('/my/challenges', requireAuth, (req, res) => {
  const all = getDB('achievements.json', []).filter(a => a.userId === req.session.userId);
  res.json({ success: true, items: all });
});

// --- reports ---
api.post('/reports', requireAuth, rateLimit('report', 5, 60_000), (req, res) => {
  const { judul, kategori, deskripsi, lokasi, tanggal, foto } = req.body;
  if (!judul || !kategori || !deskripsi || !lokasi) return res.status(400).json({ success: false, message: 'Lengkapi semua field wajib' });
  if (foto && foto.length > 2_600_000) return res.status(413).json({ success: false, message: 'Foto terlalu besar (maks ~2MB)' });
  const reports = getDB('reports.json', []);
  const r = { id: 'RPT-' + String(Date.now()).slice(-6), judul, kategori, deskripsi, lokasi, tanggal: tanggal || new Date().toISOString().slice(0, 10), status: 'Submitted', pelapor: req.session.userId, foto: foto || '' };
  reports.push(r); saveDB('reports.json', reports);
  res.json({ success: true, item: r });
});
api.get('/my/reports', requireAuth, (req, res) => {
  res.json({ success: true, items: getDB('reports.json', []).filter(r => r.pelapor === req.session.userId) });
});

// --- saved/bookmark ---
api.post('/saved/toggle', requireAuth, (req, res) => {
  const { type, id } = req.body;
  const saved = getDB('saveditems.json', {});
  const arr = saved[req.session.userId] || [];
  const key = type + ':' + id;
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
  saved[req.session.userId] = arr; saveDB('saveditems.json', saved);
  res.json({ success: true, saved: i < 0 });
});
api.get('/my/saved', requireAuth, (req, res) => {
  const saved = getDB('saveditems.json', {});
  res.json({ success: true, keys: saved[req.session.userId] || [] });
});

// --- admin ---
api.get('/admin/overview', requireAdmin, (req, res) => {
  res.json({
    success: true,
    users: getDB('users.json', []).length,
    campaigns: getDB('campaigns.json', []).length,
    activities: getDB('activities.json', []).length,
    reports: getDB('reports.json', []).length,
    pendingJoins: getDB('joinreqs.json', []).filter(r => r.status === 'Pending').length,
    pendingReports: getDB('reports.json', []).filter(r => r.status === 'Submitted' || r.status === 'Under Review').length,
  });
});
api.post('/admin/campaigns', requireAdmin, (req, res) => {
  const { judul, kategori, deskripsi, lokasi, target, tenggat, foto, organizer } = req.body;
  if (!judul || !kategori || !deskripsi || !target) return res.status(400).json({ success: false, message: 'Lengkapi field wajib' });
  const items = getDB('campaigns.json', []);
  items.push({ id: 'CMP-' + String(Date.now()).slice(-6), judul, kategori, deskripsi, lokasi: lokasi || '', target: Number(target) || 1, progress: 0, relawan: 0, status: 'AKTIF', tenggat: tenggat || '', foto: foto || '/img/campaigns/reforestation.jpg', organizer: organizer || 'GreenAction' });
  saveDB('campaigns.json', items);
  res.json({ success: true });
});
api.delete('/admin/campaigns/:id', requireAdmin, (req, res) => {
  const items = getDB('campaigns.json', []).filter(c => c.id !== req.params.id);
  saveDB('campaigns.json', items);
  res.json({ success: true });
});
api.delete('/admin/activities/:id', requireAdmin, (req, res) => {
  saveDB('activities.json', getDB('activities.json', []).filter(a => a.id !== req.params.id));
  res.json({ success: true });
});
api.delete('/admin/users/:id', requireAdmin, (req, res) => {
  saveDB('users.json', getDB('users.json', []).filter(u => u.id !== req.params.id));
  res.json({ success: true });
});
api.get('/admin/joins', requireAdmin, (req, res) => {
  res.json({ success: true, items: getDB('joinreqs.json', []) });
});
api.post('/admin/joins/:key', requireAdmin, (req, res) => {
  const { status } = req.body; // Approved / Rejected
  const reqs = getDB('joinreqs.json', []);
  const r = reqs.find(x => x.key === req.params.key);
  if (!r || !['Approved', 'Rejected'].includes(status)) return res.status(400).json({ success: false });
  r.status = status; saveDB('joinreqs.json', reqs);
  if (status === 'Approved') {
    // bump stats terkait
    const stats = getDB('stats.json', {});
    if (r.type === 'campaign') {
      const cs = getDB('campaigns.json', []); const c = cs.find(x => x.id === r.id);
      if (c) { c.relawan += 1; saveDB('campaigns.json', cs); }
      stats.volunteers = (stats.volunteers || 0) + 1;
    } else {
      const as_ = getDB('activities.json', []); const a = as_.find(x => x.id === r.id);
      if (a) { a.terisi = Math.min(a.terisi + 1, a.kuota); saveDB('activities.json', as_); }
      stats.volunteers = (stats.volunteers || 0) + 1;
    }
    // poin user
    const users = getDB('users.json', []); const u = users.find(x => x.id === r.userId);
    if (u) { u.poin += 20; u.kontribusi += 1; saveDB('users.json', users); }
    saveDB('stats.json', stats);
  }
  res.json({ success: true });
});
api.post('/admin/reports/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['Submitted', 'Under Review', 'Verified', 'In Progress', 'Resolved', 'Rejected'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  const reports = getDB('reports.json', []);
  const r = reports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ success: false });
  r.status = status; saveDB('reports.json', reports);
  res.json({ success: true });
});

// --- clean URLs + profile + admin aggregate ---
api.get('/me', requireAuth, (req, res) => {
  const users = getDB('users.json', []);
  const u = users.find(x => x.id === req.session.userId);
  if (!u) return res.status(404).json({ success: false });
  res.json({ success: true, poin: { poin: u.poin || 0, kegiatan: getDB('joinreqs.json', []).filter(r => r.userId === u.id && r.status === 'Approved').length, laporan: getDB('reports.json', []).filter(r => r.pelapor === u.id).length }, profil: { kota: u.kota || u.lokasi || '', provinsi: u.provinsi || '' } });
});
api.post('/me/profile', requireAuth, (req, res) => {
  const users = getDB('users.json', []);
  const u = users.find(x => x.id === req.session.userId);
  if (!u) return res.status(404).json({ success: false });
  if (req.body.kota) u.kota = String(req.body.kota).slice(0, 60);
  if (req.body.provinsi) u.provinsi = String(req.body.provinsi).slice(0, 40);
  saveDB('users.json', users);
  res.json({ success: true });
});
api.get('/admin/data', requireAdmin, (req, res) => {
  const reports = getDB('reports.json', []);
  const byStatus = ['Submitted', 'Under Review', 'Verified', 'In Progress', 'Resolved', 'Rejected'].map(st => reports.filter(r => r.status === st).length);
  const users = getDB('users.json', []);
  const joins = getDB('joinreqs.json', []).map(j => ({ ...j, title: (j.type === 'campaign' ? getDB('campaigns.json', []).find(c => c.id === j.id) : getDB('activities.json', []).find(a => a.id === j.id))?.judul || j.id, userName: (users.find(u => u.id === j.userId) || {}).nama || '—' }));
  res.json({ success: true, stats: { users: users.length, reports: reports.length, pending: reports.filter(r => r.status === 'Submitted' || r.status === 'Under Review').length, joins: joins.filter(j => j.status === 'Pending').length }, reports, byStatus, joins, users: users.map(({ password, ...u }) => u) });
});
['kampanye','kegiatan','komunitas','green-map','tantangan','lapor','dampak','edukasi','papan-peringkat','tentang','masuk','daftar','dashboard','profil','admin','artikel'].forEach(p => {
  app.get('/' + p, (req, res) => res.sendFile(path.join(__dirname, 'public', p + '.html')));
});
// kampanye detail /kampanye/:id → kampanye-detail.html
['kampanye','kegiatan','komunitas','artikel'].forEach(p => {
  app.get('/' + p + '/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', p + '-detail.html')));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, HOST, () => console.log(`[GreenAction] berjalan di http://${HOST}:${PORT}`));
