// Admin → Bantuan: guided tours ("missions") that walk through the admin page one highlighted part at a time,
// and a written guide with search. Both are in Indonesian only. A tour never saves, deletes or changes anything:
// while it runs, clicks outside the speech bubble are blocked except on the part it asks the admin to tap,
// and forms can't be submitted. Finished missions are remembered on this device (browser storage).
import { $, el } from "/common.js";

const DONE_KEY = "ks-admin-tours", WELCOME_KEY = "ks-admin-welcomed";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const doneSet = () => { try { return new Set(JSON.parse(store.get(DONE_KEY) || "[]")); } catch { return new Set(); } };
const markDone = (id) => { const s = doneSet(); s.add(id); store.set(DONE_KEY, JSON.stringify([...s])); };

const tabBtn = (tab) => document.querySelector(`.tabs button[data-tab="${tab}"]`);
const firstRow = (tbody) => document.querySelector(`#${tbody} tr:first-child .acts`) ? `#${tbody} tr:first-child` : null;
const html = (s) => { const t = document.createElement("template"); t.innerHTML = s; return t.content; };

// ---------- the missions ----------
// A step: tab to open first, target (a selector, or a function returning one; none = centred bubble),
// title and text (trusted HTML written here), do: the admin taps the target to continue,
// missing: added to the text when the target isn't on the page (e.g. no sellers yet), and before/after hooks.
const NO_ROWS_SELLER = "Belum ada penjual di daftar, jadi tombolnya belum terlihat. Setelah ada penjual, tombol ini ada di ujung kanan setiap baris.";
const NO_ROWS_PRODUCT = "Belum ada produk di daftar, jadi tombolnya belum terlihat. Tombol ini ada di ujung kanan setiap baris produk.";

const TOURS = [
  { id: "kenal", title: "Kenalan dengan halaman admin", time: "1 menit", steps: [
    { title: "Selamat datang! 👋", text: "Ini halaman admin Kampoeng Semanggi. Dari sini Anda mengatur penjual, produk, paket wisata, warga & mitra, dan kontak di website.<br><br>Tur ini hanya menunjukkan, <b>tidak mengubah apa pun</b>. Tekan <b>Lanjut</b> untuk mulai." },
    { target: "#stats", title: "Angka ringkas", text: "<b>Toko aktif</b> = penjual yang tidak ditangguhkan.<br><b>Produk terdaftar</b> = jumlah produk dari semua toko." },
    { target: ".tabs", title: "Bagian-bagian halaman", text: "Setiap tombol ini membuka satu bagian: <b>Penjual</b>, <b>Produk</b>, <b>Paket</b>, <b>Warga &amp; Mitra</b>, <b>Situs</b>, dan <b>Akun</b>." },
    { target: '.tabs button[data-tab="wisata"]', do: true, title: "Coba sendiri", text: "Ketuk tab <b>Paket</b> yang menyala." },
    { tab: "wisata", target: "#listingForm .desk-head", title: "Bagus! 🎉", text: "Ini bagian <b>Paket</b>: tempat menambah tur, pengalaman, dan homestay. Ada tur khusus untuk bagian ini di menu Bantuan." },
    { target: "#refreshBtn", title: "Muat ulang", text: "Mengambil data terbaru, misalnya setelah penjual baru saja menambah produk." },
    { target: "#helpBtn", title: "Bantuan", text: "Buka tur lain dan panduan tertulis kapan saja dari sini. Tanda centang ✓ menunjukkan tur yang sudah selesai." },
    { target: ".top .lang", title: "Bahasa halaman admin", text: "Mengganti bahasa halaman admin saja (Indonesia atau Inggris). Website umum tidak ikut berubah." },
    { target: "#logoutBtn", title: "Keluar", text: "Selalu tekan <b>Keluar</b> kalau memakai HP atau komputer orang lain." },
    { tab: "sellers", title: "Tur pertama selesai! ✓", text: "Lanjutkan dengan tur <b>Menambah penjual baru</b> di menu Bantuan." },
  ] },

  { id: "penjual", title: "Menambah penjual baru", time: "2 menit", steps: [
    { tab: "sellers", target: "#sellerForm .desk-head", title: "Formulir akun penjual", text: "Akun untuk penjual baru dibuat di sini. Anda hanya mengisi <b>nomor HP</b> dan <b>kata sandi awal</b>. Data toko diisi penjual sendiri." },
    { target: "#n-login", title: "Nomor HP (untuk masuk)", text: "Nomor HP penjual. Nomor ini dipakai penjual untuk masuk. Pakai nomor yang ada <b>WhatsApp</b>-nya, karena penjual bisa mengatur ulang kata sandi lewat WhatsApp." },
    { target: "#n-pass", title: "Kata sandi awal", text: "Minimal 8 karakter. Penjual bisa menggantinya sendiri setelah masuk." },
    { target: "#genPass", do: true, title: "Coba sendiri", text: "Ketuk <b>Buat otomatis</b> untuk membuat kata sandi acak. (Ini hanya contoh; kata sandinya dihapus lagi saat tur selesai.)" },
    { target: "#n-pass", title: "Kata sandi siap", text: "Kata sandi acak lebih aman daripada tanggal lahir atau nama." },
    { target: "#sellerSubmit", title: "Buat akun penjual", text: "Setelah diisi, tekan tombol ini. <b>Dalam tur ini tombol tidak ditekan.</b><br><br>Lalu muncul kotak berisi nomor dan kata sandi. <b>Kirim keduanya ke penjual saat itu juga</b>, misalnya lewat WhatsApp: kata sandi tidak akan ditampilkan lagi." },
    { target: "#view-sellers thead", title: "Daftar penjual", text: "Semua penjual tampil di sini: nama toko, kontak, lokasi toko, alamat rumah, jumlah produk, dan status.<br><br>Label <b>Belum isi data</b> berarti penjual belum melengkapi data tokonya. Bantu mereka masuk dan mengisinya." },
    { title: "Selesai! ✓", text: "Saat pertama kali masuk, penjual mengisi nama, toko, alamat, jam buka, cara ambil atau antar, lalu produknya.<br><br>Lanjutkan dengan tur <b>Membantu penjual</b>." },
  ], before: (s) => { s.pass = $("#n-pass").value; if ($("#sellerFormBody").hidden) { pageClick($("#sellerFormToggle")); s.toggled = true; } },
    end: (s) => { $("#n-pass").value = s.pass; if (s.toggled) $("#sellerFormToggle").click(); } },

  { id: "bantu", title: "Membantu penjual", time: "2 menit", steps: [
    { tab: "sellers", title: "Membantu penjual", text: "Tur ini menunjukkan tombol di setiap baris penjual: mengubah data, mengatur ulang kata sandi, menangguhkan, dan menghapus." },
    { target: () => firstRow("sellerRows") && "#sellerRows tr:first-child .acts button:nth-child(1)", missing: NO_ROWS_SELLER, title: "Ubah", text: "Membuka data toko di formulir atas. Perbaiki, lalu tekan <b>Simpan perubahan</b>. Tekan <b>Batal ubah</b> kalau tidak jadi." },
    { target: () => firstRow("sellerRows") && "#sellerRows tr:first-child .acts button:nth-child(2)", missing: NO_ROWS_SELLER, title: "Reset kata sandi", text: "Untuk penjual yang lupa kata sandi. Tekan <b>dua kali</b>: tombol berubah menjadi <b>Ketuk untuk reset</b>, lalu tekan lagi dalam 3 detik.<br><br>Kata sandi baru muncul di kotak di atas. Kirim ke penjual." },
    { target: () => firstRow("sellerRows") && "#sellerRows tr:first-child .acts button:nth-child(3)", missing: NO_ROWS_SELLER, title: "Tangguhkan / Aktifkan lagi", text: "<b>Tangguhkan</b> (tekan dua kali) menyembunyikan toko dan produknya dari pengunjung, dan penjual tidak bisa masuk. <b>Data tidak hilang.</b><br><br>Toko yang ditangguhkan punya tombol <b>Aktifkan lagi</b>." },
    { target: () => firstRow("sellerRows") && "#sellerRows tr:first-child .acts button:last-child", missing: NO_ROWS_SELLER, title: "Hapus toko ⚠️", text: "<b>Permanen.</b> Akun, semua produk, foto, dan poster toko ini hilang dan tidak bisa dikembalikan. Sebuah jendela meminta konfirmasi dulu.<br><br>Kalau ragu, pilih <b>Tangguhkan</b>." },
    { target: () => firstRow("sellerRows") && "#sellerRows tr:first-child td:nth-child(6)", missing: "Kolom ini ada di setiap baris penjual.", title: "Kolom Status", text: "<b>Aktif</b> atau <b>Ditangguhkan</b> (diatur admin).<br><b>Tutup sementara</b> diatur penjual sendiri, misalnya saat libur. Catatan penjual untuk pembeli tampil di bawahnya." },
    { title: "Selesai! ✓", text: "Ingat: penjual juga bisa mengatur ulang kata sandi sendiri: tekan <b>Lupa kata sandi?</b> di halaman masuk penjual, lalu masukkan kode dari WhatsApp." },
  ] },

  { id: "produk", title: "Produk dan poster", time: "1 menit", steps: [
    { tab: "products", target: "#view-products thead", title: "Semua produk", text: "Produk dari semua toko. Penjual menambah dan mengubah produknya sendiri; admin mengawasi." },
    { target: () => document.querySelector("#productRows tr:first-child .pill") ? "#productRows tr:first-child .pill" : null, missing: "Belum ada produk, jadi labelnya belum terlihat.", title: "Keadaan produk", text: "<b>Dijual</b> = tampil dan bisa dipesan.<br><b>Habis</b> = ditandai habis oleh penjual.<br><b>Disembunyikan</b> = tidak tampil di website." },
    { target: () => firstRow("productRows") && "#productRows tr:first-child .acts button:nth-child(1)", missing: NO_ROWS_PRODUCT, title: "Sembunyikan / Tampilkan", text: "Sembunyikan produk yang tidak pantas atau salah (foto, harga, nama). Beri tahu penjualnya. Tekan <b>Tampilkan</b> untuk memunculkannya lagi." },
    { target: () => firstRow("productRows") && "#productRows tr:first-child .acts button:nth-child(2)", missing: NO_ROWS_PRODUCT, title: "Hapus", text: "Tekan dua kali. Produk hilang <b>permanen</b>. Lebih aman pilih <b>Sembunyikan</b>." },
    { target: '#view-products h3[data-i18n="posters.adminTitle"]', title: "Poster & iklan penjual", text: "Poster yang dipasang penjual di halaman tokonya. Ketuk gambar untuk melihat ukuran penuh, nama toko untuk membuka tokonya, dan <b>Hapus</b> untuk poster yang tidak pantas." },
    { title: "Selesai! ✓", text: "Produk yang ditambahkan penjual langsung tampil. Tekan <b>Muat ulang</b> untuk melihat yang terbaru." },
  ] },

  { id: "paket", title: "Menambah tur, pengalaman, atau homestay", time: "3 menit", steps: [
    { tab: "wisata", target: "#listingForm .desk-head", title: "Formulir paket", text: "Satu formulir untuk tiga jenis paket. Kolomnya menyesuaikan dengan jenis yang dipilih." },
    { target: "#l-kind", title: "Jenis", text: "<b>Pengalaman</b> = satu kegiatan singkat, mis. memasak pecel semanggi.<br><b>Tur</b> = paket lengkap dengan pemandu yang menggabungkan beberapa pengalaman, biasanya dengan makan.<br><b>Homestay</b> = menginap di rumah warga.<br><br>Tips: buat <b>pengalaman dulu</b>, lalu tur." },
    { target: "#l-status", title: "Status", text: "<b>Tampil</b> = terlihat dan bisa dipesan.<br><b>Disembunyikan</b> = belum tampil (untuk draf).<br><b>Penuh</b> = tampil, pendaftaran ditutup.<br><b>Hanya di dalam tur</b> = pengalaman yang tidak dipesan sendiri." },
    { target: "#l-name", title: "Nama", text: "Tulis dalam bahasa Indonesia. Kolom bahasa Inggris di sebelahnya boleh dikosongkan: diterjemahkan otomatis saat disimpan." },
    { before: () => setKind("experience"), target: "#l-writer", title: "Bantu tulis deskripsi", text: "Khusus <b>pengalaman</b>. Jawab empat pertanyaan singkat, lalu tekan <b>Tulis deskripsi</b>. Hasilnya bisa diubah lagi." },
    { target: "#l-desc", title: "Deskripsi", text: "Ceritakan kegiatannya. Di bawahnya ada <b>Termasuk</b>: tulis satu hal per baris, mis. <i>Makan pecel semanggi</i>." },
    { target: "#l-price", title: "Harga", text: "Per orang untuk tur dan pengalaman, per malam untuk homestay.<br><b>Kosong</b> = \"Tanya harga\". <b>0</b> = \"Gratis\"." },
    { before: () => setKind("tour"), target: "#l-exps-box", title: "Pengalaman dalam tur", text: "Khusus <b>tur</b>. Centang pengalaman yang termasuk." },
    { target: "#l-autofill", title: "Isi otomatis dari pengalaman", text: "Menulis deskripsi, daftar <b>Termasuk</b>, total lama tur, dan titik kumpul dari pengalaman yang dicentang. Periksa hasilnya sebelum menyimpan." },
    { target: "#l-sched legend", title: "Jadwal", text: "<b>Bisa dipesan kapan saja</b>: atur berapa hari sebelumnya pengunjung harus memesan.<br><b>Tanggal tertentu</b>: tambahkan tanggal dan jam. Tanggal yang sudah lewat otomatis tidak ditampilkan." },
    { target: "#view-wisata .extra-photos", title: "Foto", text: "Maksimal 10 foto. Foto pertama menjadi foto utama." },
    { target: "#listingSubmit", title: "Simpan", text: "Menyimpan paket. <b>Dalam tur ini tombol tidak ditekan.</b>" },
    { target: "#view-wisata thead", title: "Daftar paket", text: "Semua paket tampil di sini. Tekan <b>Ubah</b> untuk mengubah, atau <b>Hapus</b> (dua kali) untuk menghapus." },
    { title: "Selesai! ✓", text: "Pesanan paket dikirim lewat WhatsApp ke <b>Nomor tur dan pengalaman</b> atau <b>Nomor homestay</b>. Isi nomornya di tab <b>Situs</b>." },
  ], before: (s) => { s.kind = $("#l-kind").value; }, end: (s) => setKind(s.kind) },

  { id: "warga", title: "Warga & Mitra", time: "2 menit", steps: [
    { tab: "about", target: "#aboutTexts h3", title: "Teks pembuka", text: "Teks di bagian atas halaman <b>Warga Kami</b> dan <b>Kerja Sama</b>, serta ajakan menjadi sponsor. Pisahkan paragraf dengan baris kosong, lalu tekan <b>Simpan teks</b>." },
    { target: "#ab-add-groups", title: "Kelompok warga", text: "Setiap kelompok (mis. penjual semanggi, pengrajin) tampil sebagai satu bagian di halaman <b>Warga Kami</b>." },
    { target: () => firstRow("ab-rows-groups") && "#ab-rows-groups tr:first-child .acts", missing: "Belum ada kelompok, jadi tombolnya belum terlihat.", title: "Urutan, ubah, hapus", text: "Tombol <b>↑</b> dan <b>↓</b> mengatur urutan di website. <b>Ubah</b> membuka formulir, <b>Hapus</b> (dua kali) menghapus." },
    { target: "#ab-add-groups", do: true, skipIf: () => !$("#aboutForm").hidden, title: "Coba sendiri", text: "Ketuk <b>Tambah kelompok</b>. Formulirnya hanya dibuka, tidak disimpan." },
    { target: "#aboutForm .desk-head", title: "Formulir kelompok", text: "Isi nama, ikon, dan teks. Kolom bahasa Inggris boleh dikosongkan." },
    { target: () => ($("#aboutForm").hidden || $("#aboutForm .ab-group").hidden ? null : "#aboutForm .ab-group"), missing: "Pilihan ini muncul di formulir kelompok.", title: "Ikon dan daftar penjual", text: "Pilih ikon untuk kelompok. Centang <b>Tampilkan daftar penjual</b> untuk kelompok penjual untuk kelompok penjual: daftar penjual di website tampil otomatis di bawah kelompok ini." },
    { target: "#aboutForm fieldset.loc", title: "Foto dan keterangan", text: "Tambah foto, beri keterangan, dan atur urutannya dengan <b>↑ ↓</b>. <b>Foto pertama tampil paling besar.</b> Foto baru diunggah saat Anda menekan <b>Simpan</b>." },
    { target: "#ab-add-partners", title: "Mitra kerja sama", text: "Sama seperti kelompok, untuk halaman <b>Kerja Sama</b>. Mitra punya kolom <b>Tahun</b>, mis. 2021–2022." },
    { title: "Selesai! ✓", text: "Formulir yang dibuka tur ditutup lagi tanpa menyimpan." },
  ], before: (s) => { s.formWasOpen = !$("#aboutForm").hidden; }, end: (s) => { if (!s.formWasOpen && !$("#aboutForm").hidden) $("#ab-close").click(); } },

  { id: "situs", title: "Pengaturan situs dan akun", time: "1 menit", steps: [
    { tab: "site", target: "#siteForm h3", title: "Pengaturan situs", text: "Kontak yang tampil di website. Kolom yang kosong tidak menampilkan tombol apa pun." },
    { target: "#site-ig", title: "Instagram", text: "Akun Instagram Kampoeng Semanggi. Tampil di bagian bawah setiap halaman." },
    { target: "#site-sponsor-name", title: "Kontak sponsor", text: "Nama atau jabatan, nomor, dan email untuk calon sponsor. Tampil di halaman <b>Kerja Sama</b>." },
    { target: "#site-tour-phone", title: "Nomor tur dan homestay", text: "Pesanan tur, pengalaman, dan homestay dikirim ke nomor ini lewat WhatsApp. <b>Pakai nomor yang ada WhatsApp-nya.</b>" },
    { target: '#siteForm button[type="submit"]', title: "Simpan pengaturan", text: "Tekan setelah mengubah. <b>Dalam tur ini tombol tidak ditekan.</b>" },
    { tab: "account", target: "#passwordForm", title: "Akun admin", text: "Ganti kata sandi admin di sini: isi kata sandi saat ini, lalu kata sandi baru dua kali (minimal 8 karakter). Jangan bagikan kata sandi admin di grup chat." },
    { tab: "sellers", title: "Semua dasar sudah dipelajari! ✓", text: "Lupa sesuatu? Buka <b>Bantuan</b> dan cari di panduan tertulis." },
  ] },
];

// Switches the package form between kinds so the tour can show kind-only fields. The form's own change
// handler shows and hides the right fields; the admin's chosen kind is put back when the tour ends.
function setKind(k) {
  const s = $("#l-kind");
  if (!k || s.value === k) return;
  s.value = k; s.dispatchEvent(new Event("change"));
}

// ---------- the written guide ----------
const GUIDE = [
  { id: "mulai", title: "Mulai di sini", body: `
    <p>Halaman admin dipakai pengurus Kampoeng Semanggi untuk mengatur isi website. Ada tiga jenis pengguna:</p>
    <ul>
      <li><b>Admin</b> (Anda): membuat akun penjual, mengawasi produk dan poster, mengisi paket wisata, Warga &amp; Mitra, dan kontak website.</li>
      <li><b>Penjual</b>: mengurus tokonya sendiri di halaman penjual: data toko, jam buka, produk, harga, foto, dan poster.</li>
      <li><b>Pengunjung</b>: melihat toko dan paket, lalu memesan lewat telepon atau WhatsApp. Website tidak menerima pembayaran; pembayaran diatur langsung antara pembeli dan penjual.</li>
    </ul>
    <h4>Bagian-bagian halaman admin</h4>
    <ul>
      <li><b>Penjual</b>: akun dan data toko setiap penjual.</li>
      <li><b>Produk</b>: semua produk dan poster dari semua toko.</li>
      <li><b>Paket</b>: tur, pengalaman, dan homestay.</li>
      <li><b>Warga &amp; Mitra</b>: isi halaman Warga Kami dan Kerja Sama.</li>
      <li><b>Situs</b>: Instagram, kontak sponsor, nomor tur dan homestay.</li>
      <li><b>Akun</b>: ganti kata sandi admin.</li>
    </ul>
    <p>Angka di atas tab: <b>Toko aktif</b> (penjual yang tidak ditangguhkan) dan <b>Produk terdaftar</b>.</p>
    <p><b>Muat ulang</b> mengambil data terbaru. <b>Keluar</b> (kanan atas) mengakhiri sesi.</p>
    <p class="help-tip">Anda tetap masuk selama 30 hari di perangkat yang sama. Selalu tekan <b>Keluar</b> kalau memakai HP atau komputer orang lain.</p>` },

  { id: "penjual", title: "Penjual: membuat dan mengubah akun", body: `
    <h4>Membuat akun penjual baru</h4>
    <ol>
      <li>Buka tab <b>Penjual</b>.</li>
      <li>Di formulir <b>Buat akun penjual</b>, isi <b>Nomor HP (untuk masuk)</b>. Pakai nomor penjual yang ada WhatsApp-nya.</li>
      <li>Isi <b>Kata sandi awal</b> (minimal 8 karakter), atau tekan <b>Buat otomatis</b>.</li>
      <li>Tekan <b>Buat akun penjual</b>.</li>
      <li>Kotak berisi nomor dan kata sandi muncul di atas formulir. <b>Kirim keduanya ke penjual saat itu juga</b>, misalnya lewat WhatsApp. Kata sandi ini tidak akan ditampilkan lagi.</li>
    </ol>
    <p>Penjual masuk lewat tombol <b>Untuk Penjual</b> di website (atau tautan <b>Masuk penjual</b> di bagian bawah halaman) dengan nomor HP dan kata sandi itu. Saat pertama kali masuk, penjual mengisi sendiri nama, nama toko, nomor kontak, alamat toko, jam buka, cara ambil atau antar, lalu menambah produk.</p>
    <h4>Membaca daftar penjual</h4>
    <ul>
      <li><b>Toko</b>: nama toko, tanggal bergabung, dan Instagram.</li>
      <li><b>Penjual &amp; kontak</b>: nama, nomor kontak untuk pembeli, dan nomor untuk masuk.</li>
      <li><b>Lokasi toko</b>: alamat dan tautan <b>Lihat di Google Maps</b>.</li>
      <li><b>Alamat rumah</b>: hanya terlihat oleh admin.</li>
      <li><b>Produk</b>: jumlah produk toko itu.</li>
      <li><b>Status</b>: lihat di bawah.</li>
    </ul>
    <p>Label <b>Belum isi data</b> berarti penjual belum melengkapi data tokonya. Bantu mereka masuk dan mengisinya, atau isi untuk mereka dengan <b>Ubah</b>.</p>
    <h4>Mengubah data penjual</h4>
    <ol>
      <li>Tekan <b>Ubah</b> di baris penjual.</li>
      <li>Formulir di atas berubah menjadi <b>Ubah</b> + nama toko dan berisi data toko.</li>
      <li>Perbaiki, lalu tekan <b>Simpan perubahan</b>. Tekan <b>Batal ubah</b> kalau tidak jadi.</li>
    </ol>
    <h4>Alamat rumah</h4>
    <p>Alamat rumah <b>tidak pernah tampil</b> di website. Kalau penjual mencentang <b>Juga jualan dari rumah</b>, pembeli diberi tahu bahwa alamat rumah dikirim lewat WhatsApp setelah mereka memesan.</p>
    <p class="help-tip"><b>Sembunyikan formulir</b> melipat formulir supaya daftar penjual lebih mudah dilihat. <b>Tampilkan formulir</b> membukanya lagi.</p>` },

  { id: "bantu", title: "Penjual: kata sandi, menangguhkan, menghapus", body: `
    <h4>Penjual lupa kata sandi</h4>
    <p><b>Cara 1, oleh penjual sendiri:</b> di halaman masuk penjual, tekan <b>Lupa kata sandi?</b>, isi nomor HP, lalu masukkan kode 6 angka yang dikirim lewat WhatsApp dan kata sandi baru. Kode berlaku 10 menit. Kalau fitur ini belum aktif, halaman itu meminta penjual menghubungi admin; pakai cara 2.</p>
    <p><b>Cara 2, oleh admin:</b></p>
    <ol>
      <li>Di tab <b>Penjual</b>, tekan <b>Reset kata sandi</b> di baris penjual.</li>
      <li>Tombol berubah menjadi <b>Ketuk untuk reset</b>. Tekan lagi dalam 3 detik.</li>
      <li>Kata sandi baru muncul di kotak di atas. Kirim ke penjual. Kata sandi lama tidak bisa dipakai lagi.</li>
    </ol>
    <p class="help-tip">Kenapa beberapa tombol harus ditekan dua kali? Supaya tidak terpencet tanpa sengaja. Kalau tidak ditekan lagi dalam 3 detik, tombol kembali seperti semula.</p>
    <h4>Menangguhkan toko</h4>
    <p><b>Tangguhkan</b> (tekan dua kali) menyembunyikan toko dan semua produknya dari pengunjung, dan penjual tidak bisa masuk. <b>Data tidak hilang.</b> Pakai ini kalau penjual berhenti berjualan, melanggar aturan, atau Anda ragu. Tekan <b>Aktifkan lagi</b> untuk memulihkan toko.</p>
    <h4>Tutup sementara dan Ditangguhkan, apa bedanya?</h4>
    <ul>
      <li><b>Tutup sementara</b>: diatur <b>penjual sendiri</b> di halaman penjual, misalnya saat libur Lebaran. Penjual wajib menulis catatan untuk pembeli, dan catatan itu tampil di tokonya.</li>
      <li><b>Ditangguhkan</b>: diatur <b>admin</b>. Toko hilang dari website dan penjual tidak bisa masuk.</li>
    </ul>
    <h4>Menghapus toko</h4>
    <div class="help-warn"><b>⚠️ Hapus toko bersifat permanen.</b> Akun penjual, semua produk, foto, dan poster toko itu terhapus dan <b>tidak bisa dikembalikan</b>. Sebuah jendela konfirmasi muncul; tekan <b>Hapus toko</b> di jendela itu hanya kalau Anda yakin. Kalau ragu, pilih <b>Tangguhkan</b>.</div>` },

  { id: "produk", title: "Produk dan poster", body: `
    <p>Penjual menambah dan mengubah produknya sendiri: nama, harga, satuan, kategori, deskripsi, dan foto. Di tab <b>Produk</b>, admin melihat produk dari semua toko sekaligus.</p>
    <h4>Keadaan produk</h4>
    <ul>
      <li><b>Dijual</b>: tampil dan bisa dipesan.</li>
      <li><b>Habis</b>: penjual menandainya habis.</li>
      <li><b>Disembunyikan</b>: tidak tampil di website.</li>
    </ul>
    <h4>Tombol</h4>
    <ul>
      <li><b>Sembunyikan</b>: untuk produk yang tidak pantas atau salah (foto, harga, nama). Beri tahu penjualnya supaya diperbaiki. <b>Tampilkan</b> memunculkannya lagi.</li>
      <li><b>Hapus</b>: tekan dua kali. Produk hilang permanen. Biasanya <b>Sembunyikan</b> lebih aman.</li>
    </ul>
    <h4>Poster &amp; iklan penjual</h4>
    <p>Penjual bisa memasang poster (maksimal 10 per toko) di halaman tokonya, misalnya promo atau menu. Di bagian <b>Poster &amp; iklan penjual</b>:</p>
    <ul>
      <li>Ketuk gambar untuk melihat ukuran penuh.</li>
      <li>Ketuk nama toko untuk membuka halaman toko itu.</li>
      <li><b>Hapus</b> (dua kali) untuk poster yang tidak pantas.</li>
    </ul>` },

  { id: "paket", title: "Paket: tur, pengalaman, homestay", body: `
    <h4>Tiga jenis paket</h4>
    <ul>
      <li><b>Pengalaman</b>: satu kegiatan singkat, mis. memasak pecel semanggi, melipat pincuk, atau menanam semanggi. Bisa dipesan sendiri, dan bisa dimasukkan ke dalam tur.</li>
      <li><b>Tur</b>: paket lengkap dengan pemandu yang menggabungkan beberapa pengalaman, biasanya dengan makan. Contoh: jalan ke kebun semanggi + memasak pecel + makan siang.</li>
      <li><b>Homestay</b>: menginap di rumah warga. Harga per malam.</li>
    </ul>
    <p class="help-tip">Urutan yang disarankan: <b>buat pengalaman dulu</b>, lalu buat tur dan centang pengalamannya.</p>
    <h4>Menambah paket</h4>
    <ol>
      <li>Buka tab <b>Paket</b>.</li>
      <li>Pilih <b>Jenis</b>. Kolom formulir menyesuaikan.</li>
      <li>Pilih <b>Status</b> (lihat di bawah).</li>
      <li>Isi <b>Nama</b>. Kolom bahasa Inggris boleh dikosongkan.</li>
      <li>Untuk <b>pengalaman</b>: buka <b>Bantu tulis deskripsi</b>, jawab empat pertanyaan singkat, lalu tekan <b>Tulis deskripsi</b>. Hasilnya bisa diubah lagi.</li>
      <li>Isi <b>Deskripsi</b> dan <b>Termasuk</b> (satu hal per baris). Untuk homestay, kolom ini menjadi <b>Fasilitas</b>.</li>
      <li>Isi <b>Harga</b>. <b>Kosong</b> = "Tanya harga". <b>0</b> = "Gratis".</li>
      <li>Untuk tur dan pengalaman: isi lama (jam) dan jumlah orang minimal/maksimal. Untuk homestay: jumlah tamu maksimal.</li>
      <li>Untuk <b>tur</b>: centang pengalaman di <b>Pengalaman dalam tur ini</b>, lalu tekan <b>Isi otomatis dari pengalaman</b>. Deskripsi, daftar Termasuk, total lama, dan titik kumpul diisi otomatis. Periksa hasilnya.</li>
      <li>Isi <b>Titik kumpul</b> (tur dan pengalaman) atau lokasi homestay.</li>
      <li>Atur <b>Jadwal</b> (lihat di bawah).</li>
      <li>Tambah <b>Foto</b> (maksimal 10). Foto pertama menjadi foto utama.</li>
      <li>Tekan <b>Simpan</b>.</li>
    </ol>
    <h4>Status</h4>
    <ul>
      <li><b>Tampil</b>: terlihat dan bisa dipesan.</li>
      <li><b>Disembunyikan (belum tampil)</b>: untuk draf yang belum siap.</li>
      <li><b>Penuh</b>: tetap tampil, tetapi pendaftaran ditutup.</li>
      <li><b>Hanya di dalam tur</b>: khusus pengalaman yang hanya bisa diikuti sebagai bagian dari tur.</li>
    </ul>
    <h4>Jadwal</h4>
    <ul>
      <li><b>Bisa dipesan kapan saja</b>: isi <b>Pesan paling lambat</b>, mis. 3 = pengunjung harus memesan minimal 3 hari sebelumnya.</li>
      <li><b>Tanggal tertentu</b>: pilih tanggal dan jam, lalu tekan <b>Tambah</b>. Ketuk tanggal (tanda ×) untuk menghapusnya. Tanggal yang sudah lewat otomatis tidak ditampilkan.</li>
    </ul>
    <h4>Mengubah dan menghapus</h4>
    <p>Di daftar paket, tekan <b>Ubah</b>: formulir terisi. Tekan <b>Simpan perubahan</b> atau <b>Batal ubah</b>. <b>Hapus</b> perlu ditekan dua kali.</p>
    <div class="help-warn">Saat mengubah paket, menekan × pada foto yang <b>sudah tersimpan</b> langsung menghapus foto itu, tanpa menunggu Simpan.</div>
    <h4>Pemesanan paket</h4>
    <p>Pengunjung memilih tanggal dan jumlah orang, lalu pesan dikirim lewat WhatsApp ke <b>Nomor tur dan pengalaman</b> atau <b>Nomor homestay</b> di tab <b>Situs</b>. Kalau nomornya kosong, tombol pesan tidak muncul.</p>` },

  { id: "warga", title: "Warga & Mitra", body: `
    <p>Tab ini mengisi halaman <b>Warga Kami</b> (kelompok warga) dan <b>Kerja Sama</b> (mitra).</p>
    <h4>Teks pembuka</h4>
    <p>Tiga teks: pembuka Warga Kami, pembuka Kerja Sama, dan ajakan menjadi sponsor. Pisahkan paragraf dengan baris kosong, lalu tekan <b>Simpan teks</b>.</p>
    <h4>Menambah kelompok atau mitra</h4>
    <ol>
      <li>Tekan <b>Tambah kelompok</b> atau <b>Tambah mitra</b>.</li>
      <li>Isi <b>Nama</b> dan <b>Teks</b>. Kolom bahasa Inggris boleh dikosongkan.</li>
      <li>Untuk kelompok: pilih <b>Ikon</b>. Centang <b>Tampilkan daftar penjual</b> untuk kelompok penjual: daftar penjual di website tampil otomatis di bawahnya.</li>
      <li>Untuk mitra: isi <b>Tahun</b>, mis. 2021–2022.</li>
      <li>Tambah foto dan beri keterangan untuk setiap foto. Atur urutannya dengan <b>↑ ↓</b>. <b>Foto pertama tampil paling besar.</b></li>
      <li>Tekan <b>Simpan</b>. Foto baru diunggah saat itu. <b>Tutup</b> menutup formulir tanpa menyimpan.</li>
    </ol>
    <p>Maksimal 20 foto per kelompok dan 30 foto per mitra.</p>
    <h4>Urutan, ubah, hapus</h4>
    <p>Tombol <b>↑ ↓</b> di daftar mengatur urutan di website. <b>Ubah</b> membuka formulir. <b>Hapus</b> perlu ditekan dua kali.</p>` },

  { id: "situs", title: "Pengaturan situs", body: `
    <ul>
      <li><b>Instagram Kampoeng Semanggi</b>: tampil di bagian bawah setiap halaman.</li>
      <li><b>Kontak sponsor</b>: nama atau jabatan (mis. Ketua RW 03), nomor, dan email. Tampil di halaman Kerja Sama untuk calon sponsor.</li>
      <li><b>Nomor tur dan pengalaman</b>: menerima pesanan tur dan pengalaman.</li>
      <li><b>Nomor homestay</b>: menerima pesanan homestay.</li>
    </ul>
    <p>Nomor dipakai untuk tombol <b>Telepon</b> dan <b>WhatsApp</b>, jadi <b>pakai nomor yang ada WhatsApp-nya</b>. Tulis seperti biasa, mis. 0812 3456 7890.</p>
    <p>Kolom yang kosong tidak menampilkan tombol; pengunjung melihat "segera hadir" atau tidak melihat apa pun. Tekan <b>Simpan pengaturan</b> setelah mengubah.</p>` },

  { id: "akun", title: "Akun admin dan keamanan", body: `
    <h4>Mengganti kata sandi admin</h4>
    <ol>
      <li>Buka tab <b>Akun</b>.</li>
      <li>Isi <b>Kata sandi saat ini</b>.</li>
      <li>Isi <b>Kata sandi baru</b> dua kali (minimal 8 karakter).</li>
      <li>Tekan <b>Ganti kata sandi</b>.</li>
    </ol>
    <h4>Tips keamanan</h4>
    <ul>
      <li>Jangan bagikan kata sandi admin di grup chat atau menulisnya di tempat umum.</li>
      <li>Pakai kata sandi yang panjang, bukan tanggal lahir atau nama.</li>
      <li>Tekan <b>Keluar</b> setelah memakai perangkat orang lain.</li>
      <li>Kalau terlalu sering salah memasukkan kata sandi, tunggu 15 menit sebelum mencoba lagi.</li>
      <li>Lupa kata sandi admin? Hubungi pengelola teknis website.</li>
    </ul>` },

  { id: "bahasa", title: "Bahasa Inggris dan bahasa lain", body: `
    <p>Cukup menulis dalam <b>bahasa Indonesia</b>. Kolom bahasa Inggris boleh dikosongkan: website menerjemahkannya otomatis saat Anda menyimpan.</p>
    <ul>
      <li>Setelah disimpan, kolom bahasa Inggris tetap kosong dan terjemahan otomatis tampil samar sebagai <b>Terjemahan otomatis: …</b>. Kalau teks Indonesia diubah, terjemahannya dibuat ulang.</li>
      <li>Kalau Anda mengisi kolom bahasa Inggris sendiri, teks Anda yang dipakai.</li>
      <li>Terjemahan otomatis bisa kurang tepat, terutama nama makanan dan tempat. Periksa, dan isi sendiri kalau perlu.</li>
      <li>Kalau muncul pesan <b>Terjemahan otomatis gagal</b>, pengunjung asing melihat teks Indonesia. Simpan lagi nanti.</li>
    </ul>
    <h4>16 bahasa</h4>
    <p>Pengunjung bisa memilih 16 bahasa. Tombol dan judul diterjemahkan ke setiap bahasa. Teks yang diisi admin tampil dalam bahasa Inggris untuk semua bahasa selain Indonesia.</p>
    <p class="help-tip">Halaman admin selalu dibuka dalam bahasa Indonesia. Tombol bahasa di sini hanya mengganti bahasa halaman admin, tidak mengubah website umum. Panduan ini hanya dalam bahasa Indonesia.</p>` },

  { id: "pesanan", title: "Cara pembeli memesan", body: `
    <p>Penting dipahami supaya Anda bisa menjelaskannya ke penjual.</p>
    <h4>Pembeli berbahasa Indonesia</h4>
    <p>Setiap produk punya tombol <b>Telepon</b> dan <b>WhatsApp</b>. WhatsApp terbuka dengan pesan yang sudah ditulis untuk penjual.</p>
    <h4>Pembeli berbahasa lain</h4>
    <ol>
      <li>Pembeli menekan <b>Pesan</b>.</li>
      <li>Panduan langkah demi langkah menanyakan produk dan jumlahnya, waktu ambil, permintaan khusus, catatan, dan nama.</li>
      <li>Pesan untuk penjual <b>selalu dalam bahasa Indonesia</b>. Pembeli melihat artinya dalam bahasanya sendiri.</li>
      <li>Catatan pembeli diterjemahkan otomatis. Catatan aslinya ikut dikirim, mis. <i>(Aslinya dalam bahasa Jepang: …)</i>.</li>
      <li>Pembeli menekan <b>Buka WhatsApp</b> lalu mengirim pesannya.</li>
    </ol>
    <p>Penjual membalas lewat WhatsApp. Pembayaran dan pengambilan diatur langsung antara penjual dan pembeli.</p>
    <p class="help-tip">Terjemahan catatan bisa keliru. Kalau ada yang aneh, sarankan penjual bertanya ulang ke pembeli, misalnya dengan fitur terjemahan di WhatsApp.</p>
    <h4>Toko tutup sementara</h4>
    <p>Pembeli melihat catatan penjual, mis. "Libur Lebaran, buka lagi 15 Oktober".</p>` },

  { id: "masalah", title: "Masalah umum dan jawabannya", body: `
    <dl class="help-qa">
      <dt>Penjual tidak bisa masuk</dt>
      <dd>Periksa statusnya di tab <b>Penjual</b>: toko yang <b>Ditangguhkan</b> tidak bisa masuk. Pastikan nomor HP-nya sama dengan "Masuk dengan HP …" di daftar. Kalau lupa kata sandi, tekan <b>Reset kata sandi</b>. Setelah terlalu sering salah, penjual harus menunggu 15 menit.</dd>
      <dt>Produk tidak tampil di website</dt>
      <dd>Di tab <b>Produk</b>, periksa apakah produk itu <b>Disembunyikan</b>. Periksa juga apakah tokonya <b>Ditangguhkan</b>.</dd>
      <dt>Perubahan belum terlihat</dt>
      <dd>Tekan <b>Muat ulang</b> di halaman admin, atau muat ulang halaman website di browser.</dd>
      <dt>Foto gagal diunggah</dt>
      <dd>Pakai foto biasa (JPG atau PNG); ukurannya diperkecil otomatis. Periksa batas jumlah foto (paket 10, kelompok 20, mitra 30) dan koneksi internet, lalu coba lagi.</dd>
      <dt>Tanggal tur hilang</dt>
      <dd>Tanggal yang sudah lewat otomatis tidak ditampilkan. Tambahkan tanggal baru di <b>Jadwal</b>.</dd>
      <dt>Tombol pesan paket tidak muncul</dt>
      <dd>Isi <b>Nomor tur dan pengalaman</b> dan <b>Nomor homestay</b> di tab <b>Situs</b>.</dd>
      <dt>Muncul "Sesi Anda berakhir"</dt>
      <dd>Masuk lagi dengan email dan kata sandi admin.</dd>
      <dt>Terjemahan bahasa Inggris aneh</dt>
      <dd>Isi kolom bahasa Inggris sendiri lalu simpan. Teks Anda tidak akan diganti.</dd>
      <dt>Terhapus tanpa sengaja</dt>
      <dd>Yang sudah dihapus tidak bisa dikembalikan. Karena itu tombol hapus selalu perlu dua kali tekan atau konfirmasi. Lain kali, pilih <b>Sembunyikan</b> atau <b>Tangguhkan</b> kalau ragu.</dd>
      <dt>Apakah tur panduan mengubah data?</dt>
      <dd>Tidak. Selama tur, tombol simpan dan hapus tidak bisa ditekan, dan formulir yang dibuka tur ditutup lagi.</dd>
    </dl>` },

  { id: "istilah", title: "Daftar istilah", body: `
    <dl class="help-qa">
      <dt>Toko</dt><dd>Halaman satu penjual di website, berisi produk, jam buka, dan kontak.</dd>
      <dt>Produk</dt><dd>Barang yang dijual penjual, mis. pecel semanggi per pincuk.</dd>
      <dt>Poster</dt><dd>Gambar promo atau menu yang dipasang penjual di halaman tokonya.</dd>
      <dt>Paket</dt><dd>Sebutan untuk tur, pengalaman, dan homestay.</dd>
      <dt>Pengalaman</dt><dd>Satu kegiatan singkat yang bisa dipesan sendiri atau menjadi bagian tur.</dd>
      <dt>Tur</dt><dd>Paket lengkap dengan pemandu yang menggabungkan beberapa pengalaman.</dd>
      <dt>Titik kumpul</dt><dd>Tempat pengunjung bertemu pemandu sebelum tur atau pengalaman dimulai.</dd>
      <dt>Ditangguhkan</dt><dd>Toko disembunyikan oleh admin; penjual tidak bisa masuk. Bisa diaktifkan lagi.</dd>
      <dt>Tutup sementara</dt><dd>Toko ditutup oleh penjual sendiri, dengan catatan untuk pembeli.</dd>
      <dt>Disembunyikan</dt><dd>Tidak tampil di website, tetapi datanya tetap ada.</dd>
      <dt>Penuh</dt><dd>Paket tampil, tetapi tidak menerima pendaftaran.</dd>
      <dt>Terjemahan otomatis</dt><dd>Teks bahasa Inggris yang dibuat website dari teks Indonesia.</dd>
      <dt>Muat ulang</dt><dd>Mengambil data terbaru dari website.</dd>
    </dl>` },
];

// Small "?" buttons beside headings that open the guide at the matching topic.
const HEAD_LINKS = [
  ["#sellerFormTitle", "penjual"], ['#view-products h3[data-i18n="posters.adminTitle"]', "produk"], ["#listingFormTitle", "paket"],
  ['[data-i18n="ab.textsTitle"]', "warga"], ['[data-i18n="ab.groupsTitle"]', "warga"], ['[data-i18n="ab.partnersTitle"]', "warga"],
  ['[data-i18n="site.title"]', "situs"], ['[data-i18n="admin.changePassword"]', "akun"],
];

// ---------- the Help panel ----------
let sheet = null;
function buildSheet() {
  const search = el("input", { type: "search", class: "help-search", placeholder: "Cari, mis. kata sandi, foto, tur…", "aria-label": "Cari di panduan" });
  const none = el("p", { class: "muted small", hidden: true, text: "Tidak ada topik yang cocok. Coba kata lain." });
  const topics = GUIDE.map((g) => {
    const d = el("details", { class: "help-topic", id: "help-" + g.id }, el("summary", { text: g.title }), el("div", { class: "help-body" }));
    d.lastChild.append(html(g.body));
    return d;
  });
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const d of topics) {
      const hit = !q || d.textContent.toLowerCase().includes(q);
      d.hidden = !hit; d.open = !!q && hit; shown += hit;
    }
    none.hidden = shown > 0;
  });
  const missions = el("ol", { class: "missions" });
  const progress = el("div", { class: "mission-progress" });
  sheet = el("dialog", { class: "help-sheet", "aria-labelledby": "helpTitle" },
    el("div", { class: "help-head" },
      el("h2", { id: "helpTitle", text: "Bantuan" }),
      el("button", { type: "button", class: "btn ghost small", "aria-label": "Tutup bantuan", onclick: () => sheet.close() }, "✕")),
    el("section", { class: "help-part" },
      el("h3", {}, "🎮 Tur panduan"),
      el("p", { class: "muted small", text: "Belajar sambil mencoba. Setiap tur menyorot satu bagian halaman dan menjelaskannya. Tur tidak menyimpan atau menghapus apa pun." }),
      progress, missions),
    el("section", { class: "help-part" },
      el("h3", {}, "📖 Panduan tertulis"),
      search, none, ...topics));
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
  sheet.renderMissions = () => {
    const done = doneSet(), n = TOURS.filter((x) => done.has(x.id)).length;
    progress.replaceChildren(
      el("div", { class: "small" }, el("strong", { text: `${n} dari ${TOURS.length} selesai` }), n === TOURS.length ? el("span", { class: "mission-badge", text: " 🏅 Semua tur selesai!" }) : null),
      el("div", { class: "mission-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(TOURS.length), "aria-valuenow": String(n) }, el("span", { style: `width:${(n / TOURS.length) * 100}%` })));
    missions.replaceChildren(...TOURS.map((tr) => {
      const ok = done.has(tr.id);
      return el("li", { class: ok ? "done" : "" },
        el("span", { class: "mission-mark", "aria-hidden": "true", text: ok ? "✓" : "" }),
        el("span", { class: "mission-name" }, el("strong", { text: tr.title }), el("span", { class: "muted small", text: (ok ? "Selesai · " : "") + tr.time })),
        el("button", { type: "button", class: "btn small" + (ok ? " ghost" : ""), onclick: () => { sheet.close(); startTour(tr); } }, ok ? "Ulangi" : "Mulai"));
    }));
  };
  document.body.append(sheet);
}
function openHelp(topic) {
  if (!sheet) buildSheet();
  sheet.renderMissions();
  sheet.showModal();
  const d = topic && sheet.querySelector("#help-" + topic);
  if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 0); }
  else sheet.scrollTop = 0;
}
$("#helpBtn").addEventListener("click", () => openHelp());

for (const [sel, topic] of HEAD_LINKS) {
  const h = document.querySelector(sel);
  if (!h) continue;
  const wrap = el("span", { class: "help-headwrap" });
  h.replaceWith(wrap);
  wrap.append(h, el("button", { type: "button", class: "help-q", title: "Bantuan tentang bagian ini", "aria-label": "Bantuan tentang bagian ini", onclick: () => openHelp(topic) }, "?"));
}

// ---------- the guided tour ----------
let run = null; // the tour that is running: { tour, i, state, spot, bubble, target, programmatic }

function startTour(tour) {
  if (run) endTour(false);
  const state = {};
  run = { tour, i: 0, state, spot: el("div", { class: "tour-spot", "aria-hidden": "true" }),
    dim: [0, 1, 2, 3].map(() => el("div", { class: "tour-dim", "aria-hidden": "true" })), bubble: el("div", { class: "tour-bubble", role: "dialog", tabindex: "-1", "aria-live": "polite" }) };
  document.body.append(...run.dim, run.spot, run.bubble);
  document.documentElement.classList.add("touring");
  tour.before?.(state);
  show(0, 1);
}

// Clicks the page itself makes (switching tabs, opening a form) pass the click guard.
function pageClick(node) { run.programmatic = true; try { node.click(); } finally { run.programmatic = false; } }

function resolveTarget(step) {
  const sel = typeof step.target === "function" ? step.target() : step.target;
  const node = sel && document.querySelector(sel);
  return node && node.getClientRects().length ? node : null;
}

function show(i, dir) {
  const steps = run.tour.steps;
  if (i >= steps.length) return endTour(true);
  const step = steps[i];
  if (step.skipIf?.()) return show(i + dir < 0 ? 0 : i + dir, dir);
  run.i = i;
  if (step.tab) { const b = tabBtn(step.tab); if (b && b.getAttribute("aria-selected") !== "true") pageClick(b); }
  step.before?.(run.state);
  const target = step.target ? resolveTarget(step) : null;
  run.target = target;
  const last = i === steps.length - 1;
  const text = step.text + (step.target && !target && step.missing ? `<br><br><span class="muted">${step.missing}</span>` : "");
  const doIt = step.do && target;
  run.bubble.replaceChildren(...[
    el("div", { class: "tour-count", text: `${run.tour.title} · ${i + 1} / ${steps.length}` }),
    el("h3", { text: step.title }),
    el("div", { class: "tour-text" }, html(text)),
    doIt ? el("p", { class: "tour-do", text: "👆 Ketuk bagian yang menyala untuk lanjut." }) : null,
    el("div", { class: "tour-actions" },
      el("button", { type: "button", class: "linkish tour-skip", onclick: () => endTour(false) }, "Lewati tur"),
      el("span", { style: "flex:1" }),
      i > 0 ? el("button", { type: "button", class: "btn ghost small", onclick: () => show(i - 1, -1) }, "Kembali") : null,
      doIt ? null : el("button", { type: "button", class: "btn small tour-next", onclick: () => show(i + 1, 1) }, last ? "Selesai ✓" : "Lanjut")),
  ].filter(Boolean));
  run.spot.classList.toggle("tour-do-spot", !!doIt);
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (target) target.scrollIntoView({ block: "center", behavior });
  else window.scrollTo({ top: 0, behavior });
  place();
  setTimeout(place, 400); // again after the smooth scroll settles
  (run.bubble.querySelector(".tour-next") || run.bubble).focus({ preventScroll: true });
}

// Puts the spotlight over the target and the bubble beside it: below if there's room, otherwise above.
// Without a target the bubble sits in the middle. On phones the bubble is pinned to the bottom by CSS.
function place() {
  if (!run) return;
  const { spot, bubble, target } = run;
  const pad = 6, vw = innerWidth, vh = innerHeight;
  if (!target) {
    Object.assign(spot.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
    dimAround({ left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2 });
    bubble.classList.add("tour-center");
    Object.assign(bubble.style, { left: "", top: "" });
    return;
  }
  bubble.classList.remove("tour-center");
  const b = target.getBoundingClientRect();
  const top0 = Math.max(b.top, 8), bottom0 = Math.min(b.bottom, vh - 8);
  const r = { left: b.left, width: b.width, top: top0, bottom: Math.max(bottom0, top0), height: Math.max(bottom0 - top0, 0) };
  Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
  dimAround({ left: r.left - pad, top: r.top - pad, right: r.left + r.width + pad, bottom: r.top + r.height + pad });
  if (vw < 640) { Object.assign(bubble.style, { left: "", top: "" }); return; }
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight, gap = 14;
  let top = r.bottom + pad + gap;
  if (top + bh > vh - 12) top = r.top - pad - gap - bh;
  if (top < 12) top = Math.max(12, Math.min(vh - bh - 12, r.top + 12));
  const left = Math.max(12, Math.min(vw - bw - 12, r.left));
  Object.assign(bubble.style, { left: left + "px", top: top + "px" });
}
// Four dark panels around the lit-up box (a giant box-shadow doesn't draw reliably on phones).
function dimAround(h) {
  const [above, below, left, right] = run.dim, px = (n) => Math.max(0, n) + "px";
  Object.assign(above.style, { left: "0px", top: "0px", width: "100vw", height: px(h.top) });
  Object.assign(below.style, { left: "0px", top: px(h.bottom), width: "100vw", height: "" , bottom: "0px" });
  Object.assign(left.style, { left: "0px", top: px(h.top), width: px(h.left), height: px(h.bottom - h.top) });
  Object.assign(right.style, { left: px(h.right), top: px(h.top), right: "0px", width: "", height: px(h.bottom - h.top) });
}
addEventListener("resize", place);
addEventListener("scroll", place, true);

function endTour(finished) {
  if (!run) return;
  const { tour, state, spot, bubble, dim } = run;
  run = null;
  spot.remove(); bubble.remove(); dim.forEach((d) => d.remove());
  document.documentElement.classList.remove("touring");
  try { tour.end?.(state); } catch {}
  if (finished) {
    markDone(tour.id);
    const all = doneSet().size >= TOURS.length;
    celebrate(all ? "🏅 Semua tur selesai! Anda siap mengelola website." : `✓ Tur "${tour.title}" selesai`);
  }
}

function celebrate(msg) {
  const n = el("div", { class: "tour-cheer", role: "status", text: msg });
  document.body.append(n);
  setTimeout(() => n.remove(), 3200);
}

// While a tour runs: only the bubble works, plus the highlighted part on "tap it yourself" steps.
// Nothing can be submitted, and Escape ends the tour.
function guard(e) {
  if (!run || run.programmatic) return;
  if (run.bubble.contains(e.target)) return;
  const step = run.tour.steps[run.i];
  if (step.do && run.target && run.target.contains(e.target)) {
    if (e.type === "click") {
      const i = run.i;
      setTimeout(() => { if (run && run.i === i) show(i + 1, 1); }, 60);
    }
    return;
  }
  e.preventDefault(); e.stopPropagation();
}
for (const type of ["click", "pointerdown", "mousedown", "touchstart", "dblclick", "contextmenu"]) document.addEventListener(type, guard, { capture: true, passive: false });
document.addEventListener("submit", (e) => { if (run) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener("keydown", (e) => {
  if (!run) return;
  if (e.key === "Escape") { e.preventDefault(); return endTour(false); }
  if (!run.bubble.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener("focusin", (e) => { if (run && !run.bubble.contains(e.target)) e.target.blur?.(); }, true);

// ---------- first sign-in on this device ----------
// Offered once when the admin page first appears after signing in.
function offerWelcome() {
  if (store.get(WELCOME_KEY)) return;
  store.set(WELCOME_KEY, "1");
  const d = el("dialog", { class: "confirm", "aria-labelledby": "welcomeTitle" },
    el("h2", { id: "welcomeTitle", text: "Selamat datang di halaman admin! 👋" }),
    el("p", { text: "Mau tur singkat? Dalam satu menit Anda dikenalkan dengan bagian-bagian halaman ini. Tur tidak mengubah apa pun, dan bisa dibuka lagi kapan saja lewat tombol Bantuan." }),
    el("div", { class: "confirm-actions" },
      el("button", { type: "button", class: "btn ghost", onclick: () => d.close() }, "Nanti saja"),
      el("button", { type: "button", class: "btn", onclick: () => { d.close(); startTour(TOURS[0]); } }, "Mulai tur")));
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
}
const desk = $("#deskView");
const watchDesk = () => { if (!desk.hidden) setTimeout(offerWelcome, 400); else if (run) endTour(false); };
new MutationObserver(watchDesk).observe(desk, { attributes: true, attributeFilter: ["hidden"] });
watchDesk();
