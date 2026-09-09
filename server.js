/* ════════════════════════════════════════════
   SERVER PHOTO BOOTH — TARKEEB
   Frame dulu → foto timpa di atas kotak hijau
   Kalibrasi: LUBANG (piksel) — frame2.png 1200×3600
   ════════════════════════════════════════════ */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

// Frame yang dipakai
const FRAME_PATH = path.join(__dirname, 'public', 'img', 'frame2.png');

// ⭐ Resolusi penuh frame2.png
const LEBAR_STRIP  = 1200;
const TINGGI_STRIP = 3600;

// Posisi kotak hijau (piksel) — nilai awal ×2 dari kalibrasi 600×1800.
// ⚠️ Belum terverifikasi! Jalankan script deteksi hijau di Console browser,
//    lalu GANTI nilai di bawah dengan hasil deteksi agar presisi.
const LUBANG = {
  x: 54,
  lebar: 1094,
  tinggi: 840,
  y: [106, 1074, 2006]
};

// Margin px — foto digambar sedikit melebihi kotak hijau agar
// tidak ada sisa hijau tipis di pinggir. Naikkan ke 6 jika perlu.
const MARGIN = 0;

// ═══ MIDDLEWARE ═══
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/hasil', express.static(path.join(__dirname, 'hasil')));

const DIR_SEMENTARA = path.join(__dirname, 'sementara');
const DIR_HASIL     = path.join(__dirname, 'hasil');
fs.mkdirSync(DIR_SEMENTARA, { recursive: true });
fs.mkdirSync(DIR_HASIL,     { recursive: true });

// ═══ UPLOAD SATU FOTO ═══
app.post('/upload-foto', (req, res) => {
  try {
    const { foto, sesi, nomor } = req.body;
    if (!foto || !sesi || !nomor) {
      return res.status(400).json({ ok: false, error: 'Data tidak lengkap' });
    }
    const data = foto.replace(/^data:image\/jpeg;base64,/, '');
    const dir  = path.join(DIR_SEMENTARA, sesi);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'foto-' + nomor + '.jpg'), data, 'base64');
    console.log('✅ Foto ' + nomor + ' diterima (sesi ' + sesi + ')');
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Upload gagal:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══ RAKIT STRIP: FRAME DULU → FOTO DI ATASNYA ═══
app.post('/buat-strip', (req, res) => {
  const { sesi } = req.body;
  if (!sesi) return res.status(400).json({ ok: false, error: 'Sesi tidak ada' });

  const { createCanvas, loadImage } = require('canvas');

  (async () => {
    const dir = path.join(DIR_SEMENTARA, sesi);

    const frame = await loadImage(FRAME_PATH);
    const fotos = [];
    for (let i = 1; i <= 3; i++) {
      fotos.push(await loadImage(path.join(dir, 'foto-' + i + '.jpg')));
    }

    const LEBAR = LEBAR_STRIP, TINGGI = TINGGI_STRIP;
    const canvas = createCanvas(LEBAR, TINGGI);
    const ctx = canvas.getContext('2d');

    // ── LANGKAH 1: FRAME (menutupi seluruh canvas) ──
    ctx.drawImage(frame, 0, 0, LEBAR, TINGGI);

    // ── LANGKAH 2: FOTO TIMPA DI ATAS KOTAK HIJAU ──
    for (let i = 0; i < 3; i++) {
      const foto = fotos[i];

      const slotX = LUBANG.x - MARGIN;
      const slotY = LUBANG.y[i] - MARGIN;
      const slotW = LUBANG.lebar + MARGIN * 2;
      const slotH = LUBANG.tinggi + MARGIN * 2;

      // Crop "cover" — foto pas penuh di lubang, tidak gepeng
      const skala = Math.max(slotW / foto.width, slotH / foto.height);
      const cw = slotW / skala, ch = slotH / skala;
      const cx = (foto.width - cw) / 2, cy = (foto.height - ch) / 2;

      ctx.drawImage(foto, cx, cy, cw, ch, slotX, slotY, slotW, slotH);
    }

    const namaFile = 'strip-' + sesi + '.png';
    fs.writeFileSync(path.join(DIR_HASIL, namaFile), canvas.toBuffer('image/png'));
    console.log('✅ Strip dibuat: ' + namaFile + ' (' + LEBAR + 'x' + TINGGI + ')');
    res.json({ ok: true, urlStrip: '/hasil/' + namaFile });
  })().catch(err => {
    console.error('❌ Gagal rakit strip:', err);
    res.status(500).json({ ok: false, error: err.message });
  });
});

app.listen(PORT, () => console.log('✅ Booth berjalan di http://localhost:' + PORT));
