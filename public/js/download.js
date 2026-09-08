// ==========================================
// download.js — Logika Halaman Hasil (HP)
// ==========================================

const kodeFotoEl    = document.getElementById('kodeFoto');
const loadingEl     = document.getElementById('loading');
const kontenEl      = document.getElementById('konten');
const errorEl       = document.getElementById('error');
const previewFotoEl = document.getElementById('previewFoto');
const btnDownloadEl = document.getElementById('btnDownload');

// Ambil parameter "?id=..." dari URL
const params = new URLSearchParams(window.location.search);
const idFoto = params.get('id');

// Jika tidak ada ID di URL, langsung tampilkan error
if (!idFoto) {
    tampilkanError();
} else {
    kodeFotoEl.textContent = idFoto;
    cariFoto(idFoto);
}

// ===== Cek foto di server =====
async function cariFoto(id) {
    try {
        const response = await fetch('/api/photo/' + id);
        const data = await response.json();

        if (response.ok && data.exists) {
            tampilkanFoto(data.imageUrl);
        } else {
            tampilkanError();
        }
    } catch (err) {
        console.error(err);
        tampilkanError();
    }
}

// ===== Tampilkan foto + tombol download =====
function tampilkanFoto(url) {
    loadingEl.style.display = 'none';
    kontenEl.style.display = 'block';

    previewFotoEl.src = url;
    btnDownloadEl.href = url;
    btnDownloadEl.setAttribute('download', 'PhotoBooth-' + idFoto + '.jpg');
}

// ===== Tampilkan pesan error =====
function tampilkanError() {
    loadingEl.style.display = 'none';
    kontenEl.style.display = 'none';
    errorEl.style.display = 'block';
}
