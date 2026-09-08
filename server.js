// ==========================================
// server.js — Backend Photo Booth
// ==========================================
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Folder upload foto
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
    console.log('📁 Folder "uploads" dibuat otomatis.');
}

// Middleware
app.use(express.json({ limit: '15mb' })); // Terima base64 foto besar
app.use(express.static('public'));        // Sajikan file frontend
app.use('/uploads', express.static(UPLOAD_DIR)); // Sajikan foto

// ==========================================
// API: Simpan foto dari booth
// ==========================================
app.post('/api/upload', (req, res) => {
    try {
        const { image, id } = req.body;

        if (!image || !id) {
            return res.status(400).json({ error: 'Data foto tidak lengkap!' });
        }

        // Validasi ID agar aman (huruf, angka, dash saja)
        if (!/^[A-Za-z0-9\-]+$/.test(id)) {
            return res.status(400).json({ error: 'ID foto tidak valid!' });
        }

        // Buang prefix "data:image/jpeg;base64,"
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const filePath = path.join(UPLOAD_DIR, `${id}.jpg`);

        fs.writeFileSync(filePath, base64Data, 'base64');

        console.log(`✅ Foto tersimpan: ${id}.jpg`);
        res.json({ success: true, downloadUrl: `/download.html?id=${id}` });
    } catch (err) {
        console.error('❌ Gagal simpan foto:', err);
        res.status(500).json({ error: 'Gagal menyimpan foto' });
    }
});

// ==========================================
// API: Cek foto tersedia (dipakai halaman download)
// ==========================================
app.get('/api/photo/:id', (req, res) => {
    const id = req.params.id;

    if (!/^[A-Za-z0-9\-]+$/.test(id)) {
        return res.status(400).json({ error: 'ID tidak valid' });
    }

    const filePath = path.join(UPLOAD_DIR, `${id}.jpg`);

    if (fs.existsSync(filePath)) {
        res.json({ exists: true, imageUrl: `/uploads/${id}.jpg` });
    } else {
        res.status(404).json({ exists: false, error: 'Foto tidak ditemukan' });
    }
});

// Jalankan server
app.listen(PORT, '0.0.0.0', () => {
    console.log('=====================================');
    console.log('📸 PHOTO BOOTH SERVER BERJALAN!');
    console.log(`👉 Lokal:  http://localhost:${PORT}`);
    console.log('👉 Untuk HP, gunakan IP laptop di WiFi yang sama:');
    console.log(`   contoh: http://192.168.1.10:${PORT}`);
    console.log('   (cek IP dengan perintah: ipconfig)');
    console.log('=====================================');
});
