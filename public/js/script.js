/* ════════════════════════════════════════════
   PHOTO BOOTH PAMERAN — TARKEEB
   3 foto otomatis • frame kustom • upload + QR
   ════════════════════════════════════════════ */

// ═══ KONFIGURASI ═══
var BASE_URL = 'http://10.221.3.222:3000';   // ← IP laptop — dipakai HANYA untuk link QR
var JUMLAH_FOTO = 3;
var DURASI_COUNTDOWN = 3;                    // detik per foto

// Posisi area foto di dalam frame (dari kalibrasi.html)
// Harus SAMA dengan AREA di server.js!
var AREA_FOTO = { x: 4.5, y: 3.3, w: 91.2, h: 93.4 };


// ═══ ELEMEN DOM ═══
var video            = document.getElementById('video');
var videoContainer   = document.getElementById('videoContainer');
var countdownOverlay = document.getElementById('countdownOverlay');
var flashOverlay     = document.getElementById('flashOverlay');
var btnMulai         = document.getElementById('btnMulai');
var btnFotoLagi      = document.getElementById('btnFotoLagi');
var panelPreview     = document.getElementById('panelPreview');
var panelHasil       = document.getElementById('panelHasil');
var imgHasil         = document.getElementById('imgHasil');
var qrBox            = document.getElementById('qrBox');
var linkDownload     = document.getElementById('linkDownload');
var dots             = [ document.getElementById('dot1'),
                         document.getElementById('dot2'),
                         document.getElementById('dot3') ];

var stream = null;
var sedangSesi = false;
var namaSesi = Date.now() + '-' + Math.random().toString(36).slice(2, 7);

// ═══ KAMERA — auto pilih Iriun/HP, fallback ke laptop ═══
function mulaiKamera() {
  navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
      var videoInputs = devices.filter(function(d) { return d.kind === 'videoinput'; });

      console.log('Kamera terdeteksi:');
      videoInputs.forEach(function(d, i) {
        console.log(i + ': ' + (d.label || '(tanpa nama)'));
      });

      var pilihan = null;
      var kataHP     = /iriun|droidcam|camo|epoccam|canon|eos|phone/i;
      var kataLaptop = /integrated|built-in|laptop|hd webcam|hd camera/i;

      // 1) Prioritas kamera HP/eksternal
      for (var i = 0; i < videoInputs.length; i++) {
        if (kataHP.test(videoInputs[i].label)) { pilihan = videoInputs[i].deviceId; break; }
      }
      // 2) Fallback: kamera yang bukan laptop
      if (!pilihan) {
        for (var j = 0; j < videoInputs.length; j++) {
          if (!kataLaptop.test(videoInputs[j].label)) { pilihan = videoInputs[j].deviceId; break; }
        }
      }
      // 3) Fallback terakhir
      if (!pilihan && videoInputs.length > 1) {
        pilihan = videoInputs[videoInputs.length - 1].deviceId;
      }

      var constraints = {
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } }
      };
      if (pilihan) constraints.video.deviceId = { exact: pilihan };

      return navigator.mediaDevices.getUserMedia(constraints);
    })
    .then(function(s) {
      stream = s;
      video.srcObject = stream;
      console.log('✅ Kamera aktif');
      setTimeout(posisiPanduan, 800);
    })
    .catch(function(err) {
      alert('Kamera gagal diakses: ' + err.message);
      console.error(err);
    });
}

// ═══ POSISI KOTAK PANDUAN — sinkron dengan AREA_FOTO ═══
function posisiPanduan() {
  if (!stream) return;

  var vw = videoContainer.clientWidth;
  var vh = videoContainer.clientHeight;

  var track = stream.getVideoTracks()[0];
  var settings = track.getSettings();
  var vidW = settings.width  || 1280;
  var vidH = settings.height || 720;

  var scale   = Math.max(vw / vidW, vh / vidH);
  var tampilW = vidW * scale;
  var tampilH = vidH * scale;
  var offX    = (tampilW - vw) / 2;
  var offY    = (tampilH - vh) / 2;

  var kx = AREA_FOTO.x / 100, ky = AREA_FOTO.y / 100;
  var kw = AREA_FOTO.w / 100, kh = AREA_FOTO.h / 100;

  var kotak = document.querySelector('.kotakPanduan');
  var label = document.querySelector('.labelPanduan');
  if (!kotak) return;

  // Video di-mirror → kotak dicerminkan pada sumbu x
  kotak.style.left   = (vw - (tampilW * (kx + kw)) + offX) + 'px';
  kotak.style.top    = (tampilH * ky - offY) + 'px';
  kotak.style.width  = (tampilW * kw) + 'px';
  kotak.style.height = (tampilH * kh) + 'px';

  if (label) {
    label.style.left = (vw - (tampilW * (kx + kw / 2)) + offX) + 'px';
  }
}
window.addEventListener('resize', posisiPanduan);

// ═══ SESI FOTO ═══
btnMulai.addEventListener('click', mulaiSesi);
btnFotoLagi.addEventListener('click', mulaiSesi);

function mulaiSesi() {
  if (sedangSesi) return;
  sedangSesi = true;

  panelPreview.style.display = '';
  panelHasil.style.display = 'none';
  resetDots();

  btnMulai.disabled = true;
  btnMulai.style.display = 'none';

  ambilFotoKe(1);
}

function resetDots() {
  dots.forEach(function(d) { d.className = 'dot'; });
}

function ambilFotoKe(nomor) {
  dots[nomor - 1].className = 'dot sedang';

  var hitung = DURASI_COUNTDOWN;
  countdownOverlay.textContent = hitung;
  countdownOverlay.classList.add('aktif');

  var timer = setInterval(function() {
    hitung--;
    if (hitung > 0) {
      countdownOverlay.textContent = hitung;
    } else {
      clearInterval(timer);
      countdownOverlay.classList.remove('aktif');
      countdownOverlay.textContent = '';

      flashOverlay.classList.add('aktif');
      setTimeout(function() { flashOverlay.classList.remove('aktif'); }, 150);

      var foto = tangkapFoto();
      kirimFoto(nomor, foto);
    }
  }, 1000);
}

function tangkapFoto() {
  var W = 1280, H = 960;

  // Ukuran ASLI video (Iriun bisa 16:9 atau portrait!)
  var vidW = video.videoWidth  || 1280;
  var vidH = video.videoHeight || 720;

  console.log('Resolusi video:', vidW, 'x', vidH);  // debug — lihat di Console

  // Cover crop — persis seperti preview (object-fit: cover)
  var scale   = Math.max(W / vidW, H / vidH);
  var tampilW = vidW * scale, tampilH = vidH * scale;
  var offX    = (tampilW - W) / 2, offY = (tampilH - H) / 2;

  // Gambar ke canvas dengan mirror, TANPA melar proporsi
  var sumber = document.createElement('canvas');
  sumber.width = W; sumber.height = H;
  var sctx = sumber.getContext('2d');
  sctx.translate(W, 0);
  sctx.scale(-1, 1);
  sctx.drawImage(video, -offX, -offY, tampilW, tampilH);

  // Crop area foto (persen dari canvas W×H)
  var kiri   = W * AREA_FOTO.x / 100;
  var atas   = H * AREA_FOTO.y / 100;
  var lebar  = W * AREA_FOTO.w / 100;
  var tinggi = H * AREA_FOTO.h / 100;

  var crop = document.createElement('canvas');
  crop.width  = 640;
  crop.height = Math.round(640 * tinggi / lebar);
  var cctx = crop.getContext('2d');
  cctx.drawImage(sumber, kiri, atas, lebar, tinggi, 0, 0, crop.width, crop.height);

  return crop.toDataURL('image/jpeg', 0.9);
}


function kirimFoto(nomor, dataURL) {
  fetch('/upload-foto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foto: dataURL, sesi: namaSesi, nomor: nomor })
  })
  .then(function(res) {
    if (!res.ok) throw new Error('Server balas ' + res.status);
    return res.json();
  })
  .then(function() {
    dots[nomor - 1].className = 'dot selesai';
    if (nomor < JUMLAH_FOTO) {
      setTimeout(function() { ambilFotoKe(nomor + 1); }, 800);
    } else {
      setTimeout(selesaiSesi, 600);
    }
  })
  .catch(function(err) {
    console.error('Gagal upload foto:', err);
    alert('Gagal mengirim foto ke server: ' + err.message);
    sedangSesi = false;
    btnMulai.disabled = false;
    btnMulai.style.display = '';
  });
}

// ═══ SELESI — rakit strip, QR, sembunyikan panel kiri ═══
function selesaiSesi() {
  sedangSesi = false;

  // Panel kiri disembunyikan — hasil tampil sendiri, center
  panelPreview.style.display = 'none';
  panelHasil.style.display = '';

  fetch('/buat-strip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sesi: namaSesi })
  })
  .then(function(res) {
    if (!res.ok) throw new Error('Server balas ' + res.status);
    return res.json();
  })
  .then(function(data) {
    var urlStrip = BASE_URL + data.urlStrip;   // IP dipakai di sini — untuk QR

    imgHasil.src = urlStrip;

    qrBox.innerHTML = '';
    new QRCode(qrBox, {
      text: urlStrip,
      width: 180,
      height: 180
    });
    linkDownload.textContent = urlStrip;

    // Sesi baru untuk "Foto Lagi"
    namaSesi = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  })
  .catch(function(err) {
    console.error('Gagal membuat strip:', err);
    alert('Gagal membuat photo strip: ' + err.message);
    panelPreview.style.display = '';
    panelHasil.style.display = 'none';
    btnMulai.disabled = false;
    btnMulai.style.display = '';
  });
}

// ═══ MULAI ═══
mulaiKamera();
