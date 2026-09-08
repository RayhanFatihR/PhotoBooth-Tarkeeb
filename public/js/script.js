// ==================================================
// script.js — Photo Booth TARKEEB + Frame PNG
// Frame sebagai latar, foto DI ATASNYA 
// ==================================================

// ⚠️ GANTI dengan yang IP laptop!
var BASE_URL = 'http://10.10.4.154:3000';

// Jumlah foto per sesi
var JUMLAH_FOTO = 3;

// Posisi kotak foto di atas frame (koordinat strip 600px)
// HASIL KALIBRASI — ganti dengan angka dari kalibrasi.html
var LUBANG = { x: 28, lebar: 545, tinggi: 421, y: [53, 537, 1001] };

// Elemen DOM
var video = document.getElementById('video');
var canvas = document.getElementById('canvas');
var canvasStrip = document.getElementById('canvasStrip');
var context = canvas.getContext('2d');
var contextStrip = canvasStrip.getContext('2d');
var btnAmbil = document.getElementById('btnAmbil');
var btnUlang = document.getElementById('btnUlang');
var hasil = document.getElementById('hasil');
var hasilFoto = document.getElementById('hasilFoto');
var countdownEl = document.getElementById('countdown');
var videoOverlay = document.getElementById('videoOverlay');
var statusEl = document.getElementById('status');
var flash = document.getElementById('flash');
var qrcodeDiv = document.getElementById('qrcode');
var idFotoEl = document.getElementById('idFoto');

// Ukuran strip — sesuaikan dengan hasil kalibrasi
var LEBAR_STRIP = 600;
var TINGGI_STRIP = 1800;   // ⚠️ ganti dengan angka TINGGI_STRIP dari kalibrasi

canvas.width = 1280;
canvas.height = 720;
canvasStrip.width = LEBAR_STRIP;
canvasStrip.height = TINGGI_STRIP;

var stream = null;
var arrayFoto = [];
var frameImg = null;

// ==================================================
// HELPER: MUAT GAMBAR
// ==================================================
function muatGambar(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject(new Error('Gagal memuat: ' + src)); };
    img.src = src;
  });
}

// ==================================================
// MUAT FRAME PNG
// ==================================================
muatGambar('img/frame.png').then(function(img) {
  frameImg = img;
  console.log('Frame OK');
}).catch(function() {
  alert('frame.png tidak ditemukan di public/img/');
});

// ==================================================
// KAMERA
// ==================================================
function mulaiKamera() {
  navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
    .then(function(s) {
      stream = s;
      video.srcObject = stream;
      console.log('Kamera OK');

      // Tunggu video benar-benar tampil, baru gambar panduan
      video.addEventListener('loadeddata', buatPanduanPreview);
      // Cadangan: cek lagi setelah 1 detik (antisipasi layout lambat)
      setTimeout(buatPanduanPreview, 1000);
    })
    .catch(function(err) {
      alert('Kamera gagal: ' + err.message);
    });
}


// ==================================================
// GARIS BANTU IN-FRAME 
// Area di dalam kotak = area yang akan masuk ke frame
// ==================================================
function buatPanduanPreview() {
  var guide = document.getElementById('guide');
  if (!guide) return;

  // Pakai getBoundingClientRect — lebih akurat dari clientWidth
  var rect = video.getBoundingClientRect();
  var tampilLebar = rect.width;
  var tampilTinggi = rect.height;

  // Jika video belum ter-layout, coba lagi sebentar lagi
  if (!tampilLebar || !tampilTinggi) {
    setTimeout(buatPanduanPreview, 300);
    return;
  }

  // Rasio kotak frame (sama dengan rasio crop di hasil akhir)
  var rasioKotak = LUBANG.lebar / LUBANG.tinggi;

  var hPanduan = tampilTinggi;
  var wPanduan = Math.round(hPanduan * rasioKotak);

  if (wPanduan > tampilLebar) {
    wPanduan = tampilLebar;
    hPanduan = Math.round(tampilLebar / rasioKotak);
  }

  var xPanduan = Math.round((tampilLebar - wPanduan) / 2);
  var yPanduan = Math.round((tampilTinggi - hPanduan) / 2);

  guide.innerHTML =
    '<div class="kotakPanduan" style="' +
    'left:' + xPanduan + 'px; top:' + yPanduan + 'px; ' +
    'width:' + wPanduan + 'px; height:' + hPanduan + 'px;">' +
    '<span class="labelPanduan">Posisikan wajah di dalam kotak ini</span>' +
    '</div>';
}


window.addEventListener('resize', buatPanduanPreview);

// ==================================================
// COUNTDOWN
// ==================================================
function countdown(detik) {
  return new Promise(function(resolve) {
    var hitung = detik;
    videoOverlay.style.display = 'flex';
    countdownEl.textContent = hitung;
    var timer = setInterval(function() {
      hitung--;
      if (hitung > 0) {
        countdownEl.textContent = hitung;
      } else {
        clearInterval(timer);
        countdownEl.textContent = '📸';
        setTimeout(function() { resolve(); }, 400);
      }
    }, 1000);
  });
}

function tunggu(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function efekFlash() {
  flash.style.display = 'block';
  setTimeout(function() {
    flash.style.display = 'none';
  }, 150);
}

// ==================================================
// SESI FOTO (3x)
// ==================================================
function mulaiSesiFoto() {
  btnAmbil.disabled = true;
  arrayFoto = [];

  var i = 0;
  function ambilSatu() {
    statusEl.textContent = 'Foto ' + (i + 1) + ' dari ' + JUMLAH_FOTO;
    countdown(5).then(function() {
      arrayFoto.push(potretKamera());
      efekFlash();
      i++;
      if (i < JUMLAH_FOTO) {
        tunggu(500).then(ambilSatu);
      } else {
        selesai();
      }
    });
  }
  ambilSatu();
}

// ==================================================
// POTRET SATU FOTO (mirrored)
// ==================================================
function potretKamera() {
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  return canvas.toDataURL('image/jpeg', 0.92);
}

// ==================================================
// CROP TENGAH — foto mengisi kotak PENUH tanpa distorsi
// Sisi yang lebih panjang terpotong otomatis, rasio asli tetap
// ==================================================
function gambarCropTengah(ctx, imgObj, x, y, w, h) {
  var rasioKotak  = w / h;
  var rasioKamera = imgObj.width / imgObj.height;
  var sWidth, sHeight, sx, sy;

  if (rasioKamera > rasioKotak) {
    // Foto lebih LEBAR dari kotak → potong kiri-kanan
    sHeight = imgObj.height;
    sWidth  = sHeight * rasioKotak;
    sx = (imgObj.width - sWidth) / 2;
    sy = 0;
  } else {
    // Foto lebih TINGGI dari kotak → potong atas-bawah
    sWidth  = imgObj.width;
    sHeight = sWidth / rasioKotak;
    sx = 0;
    sy = (imgObj.height - sHeight) / 2;
  }

  ctx.drawImage(imgObj, sx, sy, sWidth, sHeight, x, y, w, h);
}

// ==================================================
// SELESAI — susun strip, tampilkan hasil, kirim ke server
// ==================================================
function selesai() {
  statusEl.textContent = 'Menyusun photo strip...';
  videoOverlay.style.display = 'none';

  var idFoto = 'PB-' + Date.now().toString(36).toUpperCase();

  gabungkanStrip()
    .then(function(stripURL) {
      // Tampilkan hasil DULU — pasti terlihat meski upload gagal
      tampilkanHasil(stripURL, idFoto);
      statusEl.textContent = '';
      // Lalu kirim ke server (untuk QR download)
      return kirimKeServer(stripURL, idFoto);
    })
    .catch(function(err) {
      statusEl.textContent = '';
      alert('ERROR saat menyusun strip:\n\n' + err.message);
      resetBooth();
    });
}

// ==================================================
// GABUNGKAN STRIP — frame latar + foto di atasnya (crop tengah)
// ==================================================
function gabungkanStrip() {
  return new Promise(function(resolve, reject) {
    if (!frameImg) {
      reject(new Error('Frame belum termuat. Refresh halaman lalu tunggu "Frame OK" di Console.'));
      return;
    }

    contextStrip.clearRect(0, 0, LEBAR_STRIP, TINGGI_STRIP);

    var loaded = 0;
    var imgs = [];
    var sudahGagal = false;

    arrayFoto.forEach(function(url, idx) {
      muatGambar(url).then(function(img) {
        if (sudahGagal) return;
        imgs[idx] = img;
        loaded++;
        if (loaded === JUMLAH_FOTO) {
          try {
            // 1. Frame sebagai latar penuh
            contextStrip.drawImage(frameImg, 0, 0, LEBAR_STRIP, TINGGI_STRIP);

            // 2. Foto DI ATAS frame — crop tengah, TANPA stretch
            for (var i = 0; i < JUMLAH_FOTO; i++) {
              gambarCropTengah(
                contextStrip,
                imgs[i],
                LUBANG.x, LUBANG.y[i], LUBANG.lebar, LUBANG.tinggi
              );
            }

            resolve(canvasStrip.toDataURL('image/jpeg', 0.92));
          } catch (e) {
            reject(e);
          }
        }
      }).catch(function(err) {
        sudahGagal = true;
        reject(err);
      });
    });
  });
}

// ==================================================
// KIRIM KE SERVER
// ==================================================
function kirimKeServer(dataURL, idFoto) {
  return fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataURL, id: idFoto })
  })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) {
          throw new Error('Server menolak (kode ' + res.status + '). ' + (data.error || ''));
        }
      });
    })
    .catch(function(err) {
      // Foto tetap tampil, hanya QR yang bermasalah
      alert(
        'Foto BERHASIL dibuat, tetapi gagal dikirim ke server:\n\n' +
        err.message +
        '\n\nQR tidak akan berfungsi.\n\n' +
        "Solusi: di server.js pastikan ada:\n" +
        "app.use(express.json({ limit: '15mb' }));\n" +
        'lalu restart server.'
      );
    });
}

// ==================================================
// TAMPILKAN HASIL + QR
// ==================================================
function tampilkanHasil(dataURL, idFoto) {
  video.style.display = 'none';
  videoOverlay.style.display = 'none';
  hasil.style.display = 'block';
  btnAmbil.style.display = 'none';
  btnUlang.style.display = 'inline-flex';

  hasilFoto.src = dataURL;
  idFotoEl.textContent = 'Kode Foto: ' + idFoto;
  qrcodeDiv.innerHTML = '';

  new QRCode(qrcodeDiv, {
    text: BASE_URL + '/download.html?id=' + idFoto,
    width: 200,
    height: 200,
    colorDark: '#1a1a2e',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

// ==================================================
// RESET — foto lagi
// ==================================================
function resetBooth() {
  hasil.style.display = 'none';
  video.style.display = 'block';
  videoOverlay.style.display = 'none';
  btnAmbil.style.display = 'inline-flex';
  btnAmbil.disabled = false;
  btnUlang.style.display = 'none';
  buatPanduanPreview();
}

// ==================================================
// EVENT LISTENERS + MULAI
// ==================================================
btnAmbil.addEventListener('click', mulaiSesiFoto);
btnUlang.addEventListener('click', resetBooth);
mulaiKamera();
