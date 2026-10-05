// Seller page → Bantuan / Help: guided tours ("missions") and a written guide for sellers, in Indonesian and
// English (they follow the page's ID/EN switch). The Help panel and tour engine are in help-tour.js.
import { $ } from "/common.js";
import { setupHelp, pageClick } from "/help-tour.js";

const field = (id) => () => $(id)?.closest(".field");
const locBox = (id) => () => $(id)?.closest("fieldset")?.querySelector("legend");
const firstItem = (n) => () => $("#myProducts .item:first-child .acts") && `#myProducts .item:first-child .acts button:nth-child(${n})`;
const NO_PRODUCTS = {
  id: "Anda belum punya produk, jadi tombolnya belum terlihat. Setelah menambah produk, tombol ini ada di samping setiap produk.",
  en: "You don't have any products yet, so the button isn't showing. Once you add a product, this button sits next to each one.",
};

// ---------- the missions ----------
const TOURS = [
  { id: "kenal", title: { id: "Kenalan dengan halaman toko", en: "Getting to know your shop page" }, time: { id: "1 menit", en: "1 minute" }, steps: [
    { title: { id: "Selamat datang! 👋", en: "Welcome! 👋" },
      text: { id: "Ini halaman toko Anda di website Kampoeng Semanggi. Dari sini Anda mengurus produk, jam buka, poster, dan data toko.<br><br>Tur ini hanya menunjukkan, <b>tidak mengubah apa pun</b>. Tekan <b>Lanjut</b> untuk mulai.",
        en: "This is your shop page on the Kampoeng Semanggi website. Here you manage your products, opening hours, posters and shop details.<br><br>This tour only shows you around and <b>doesn't change anything</b>. Press <b>Next</b> to start." } },
    { target: "#stallTitle", title: { id: "Nama toko Anda", en: "Your shop name" },
      text: { id: "Nama ini yang dilihat pembeli. Kalau Anda tidak mengisi nama toko, nama Anda yang tampil.", en: "This is the name buyers see. If you didn't fill in a shop name, your own name shows." } },
    { target: "#statusPill", title: { id: "Status toko", en: "Shop status" },
      text: { id: "<b>Tampil di katalog</b> = pembeli bisa melihat dan memesan.<br><b>Tutup sementara</b> = Anda sedang menutup toko (ada tur khusus untuk ini).",
        en: "<b>Live in catalog</b> = buyers can see and order.<br><b>Temporarily closed</b> = you've closed the shop for a while (there's a tour for this)." } },
    { target: "#deskView > p.muted", title: { id: "Cara pembeli memesan", en: "How buyers order" },
      text: { id: "Pembeli menelepon atau mengirim WhatsApp ke <b>nomor kontak</b> Anda. Website tidak menerima pembayaran: harga, pembayaran, dan pengambilan Anda atur langsung dengan pembeli.",
        en: "Buyers call or WhatsApp your <b>contact number</b>. The website doesn't take payments: you agree the price, payment and pickup directly with the buyer." } },
    { target: "#myShopLink", title: { id: "Lihat halaman toko saya", en: "See my shop page" },
      text: { id: "Membuka halaman toko Anda seperti yang dilihat pembeli. Bagus untuk memeriksa hasilnya.", en: "Opens your shop page as buyers see it. Handy for checking how it looks." } },
    { target: ".top .lang", title: { id: "Bahasa", en: "Language" },
      text: { id: "Mengganti bahasa halaman ini (Indonesia atau Inggris). Panduan ini ikut berganti bahasa.", en: "Switches this page between Indonesian and English. This guide switches too." } },
    { target: "#helpBtn", title: { id: "Bantuan", en: "Help" },
      text: { id: "Buka tur lain dan panduan tertulis kapan saja dari sini. Tanda ✓ menunjukkan tur yang sudah selesai.", en: "Open the other tours and the written guide any time from here. A ✓ marks the tours you've finished." } },
    { target: "#logoutBtn", title: { id: "Keluar", en: "Sign out" },
      text: { id: "Tekan <b>Keluar</b> kalau memakai HP atau komputer orang lain.", en: "Press <b>Sign out</b> when you're using someone else's phone or computer." } },
    { title: { id: "Tur pertama selesai! ✓", en: "First tour done! ✓" },
      text: { id: "Lanjutkan dengan tur <b>Menambah produk</b> di menu Bantuan.", en: "Next, try the <b>Adding a product</b> tour in the Help menu." } },
  ] },

  { id: "produk", title: { id: "Menambah produk", en: "Adding a product" }, time: { id: "2 menit", en: "2 minutes" }, steps: [
    { target: "#productFormTitle", title: { id: "Formulir produk", en: "The product form" },
      text: { id: "Setiap barang yang Anda jual ditambahkan di sini, satu per satu.", en: "Each thing you sell is added here, one at a time." } },
    { target: "#productForm .drop", title: { id: "Foto", en: "Photo" },
      text: { id: "Satu foto per produk. Foto yang terang dan dekat membuat pembeli tertarik. Ukurannya diperkecil otomatis.", en: "One photo per product. A bright, close-up photo draws buyers in. It's made smaller automatically." } },
    { target: field("#p-name"), title: { id: "Nama produk", en: "Product name" },
      text: { id: "Nama yang jelas, mis. <i>Pecel semanggi</i> atau <i>Kerupuk puli</i>.", en: "A clear name, e.g. <i>Pecel semanggi</i> or <i>Kerupuk puli</i>." } },
    { target: "#productForm .row2", title: { id: "Harga dan satuan", en: "Price and unit" },
      text: { id: "<b>Harga (Rp)</b>: tulis angka saja, mis. 15000.<br><b>Dijual per</b>: satuannya, mis. <i>pincuk</i>, <i>bungkus</i>, <i>kg</i>.",
        en: "<b>Price (Rp)</b>: numbers only, e.g. 15000.<br><b>Sold per</b>: the unit, e.g. <i>pincuk</i>, <i>pack</i>, <i>kg</i>." } },
    { target: field("#p-pieces"), title: { id: "Isi (opsional)", en: "Pieces (optional)" },
      text: { id: "Berapa buah untuk harga itu, mis. 65 untuk Rp 160.000 per 65 buah. Pembeli bisa membandingkan harga per buah.",
        en: "How many pieces for that price, e.g. 65 for Rp 160,000 per 65 pieces. Buyers can compare the price per piece." } },
    { target: field("#p-category"), title: { id: "Kategori", en: "Category" },
      text: { id: "Pecel, Camilan, Minuman, Oleh-oleh, atau Lainnya. Pembeli bisa menyaring katalog berdasarkan kategori.", en: "Pecel, Snacks, Drinks, Gifts to take home or Other. Buyers can filter the catalog by category." } },
    { target: field("#p-desc"), title: { id: "Deskripsi", en: "Description" },
      text: { id: "Ceritakan singkat: isinya apa, rasanya, ukurannya. Mis. <i>Dengan kerupuk puli dan bumbu ekstra.</i>", en: "A short line: what's in it, the taste, the size. E.g. <i>With puli crackers and extra sauce.</i>" } },
    { target: "#saveProductBtn", title: { id: "Tambahkan ke toko", en: "Add to my shop" },
      text: { id: "Setelah diisi, tekan tombol ini. Produk langsung tampil dan bisa dipesan. <b>Dalam tur ini tombol tidak ditekan.</b>",
        en: "Once it's filled in, press this. The product shows straight away and can be ordered. <b>In this tour the button isn't pressed.</b>" } },
    { title: { id: "Selesai! ✓", en: "Done! ✓" },
      text: { id: "Lanjutkan dengan tur <b>Mengurus produk</b>: mengubah, menandai habis, dan menghapus.", en: "Next, try <b>Managing your products</b>: editing, marking sold out and removing." } },
  ] },

  { id: "kelola", title: { id: "Mengurus produk", en: "Managing your products" }, time: { id: "1 menit", en: "1 minute" }, steps: [
    { target: ".panel.mine h3", title: { id: "Produk Anda", en: "Your products" },
      text: { id: "Semua produk Anda tampil di sini, dengan harga dan keadaannya.", en: "All your products are listed here, with their price and status." } },
    { target: firstItem(1), missing: NO_PRODUCTS, title: { id: "Ubah", en: "Edit" },
      text: { id: "Membuka produk di formulir atas. Ubah harga, foto, atau deskripsinya, lalu tekan <b>Simpan perubahan</b>. Tekan <b>Batal ubah</b> kalau tidak jadi.",
        en: "Opens the product in the form above. Change the price, photo or description, then press <b>Save changes</b>. Press <b>Cancel edit</b> if you change your mind." } },
    { target: firstItem(2), missing: NO_PRODUCTS, title: { id: "Tandai habis / Jual lagi", en: "Sold out / Back on sale" },
      text: { id: "Sedang habis? Tekan <b>Tandai habis</b>: produk tetap tampil dengan tanda habis. Kalau ada lagi, tekan <b>Jual lagi</b>. Lebih baik daripada menghapus.",
        en: "Run out? Press <b>Sold out</b>: the product stays on show, marked as sold out. When it's back, press <b>Back on sale</b>. Better than removing it." } },
    { target: firstItem(3), missing: NO_PRODUCTS, title: { id: "Hapus ⚠️", en: "Remove ⚠️" },
      text: { id: "Menghapus produk dan fotonya <b>untuk selamanya</b>. Sebuah jendela meminta konfirmasi dulu. Kalau hanya habis sementara, pakai <b>Tandai habis</b>.",
        en: "Deletes the product and its photo <b>for good</b>. A window asks you to confirm first. If it's only out of stock for now, use <b>Sold out</b>." } },
    { title: { id: "Disembunyikan admin", en: "Hidden by admin" },
      text: { id: "Kalau sebuah produk berlabel <b>Disembunyikan admin</b>, admin menyembunyikannya, misalnya karena foto atau harganya salah. Perbaiki dengan <b>Ubah</b>, lalu hubungi admin.<br><br>Tur selesai! ✓",
        en: "If a product is labelled <b>Hidden by admin</b>, the admin has hidden it, for example because the photo or price was wrong. Fix it with <b>Edit</b>, then contact the admin.<br><br>Tour done! ✓" } },
  ] },

  { id: "tutup", title: { id: "Menutup toko sementara", en: "Closing your shop for a while" }, time: { id: "1 menit", en: "1 minute" }, steps: [
    { target: "#pauseForm h3", title: { id: "Status toko", en: "Shop status" },
      text: { id: "Libur, sakit, atau bahan habis? Tutup toko sementara di sini. Produk Anda tetap tersimpan.", en: "On holiday, unwell or out of ingredients? Close your shop for a while here. Your products stay saved." } },
    { target: "#pauseState", title: { id: "Keadaan sekarang", en: "Right now" },
      text: { id: "Menunjukkan apakah toko Anda sedang buka atau tutup sementara.", en: "Shows whether your shop is open or temporarily closed." } },
    { target: "#pauseNoteField", missing: { id: "Toko Anda sedang tutup, jadi kolom catatan tidak tampil. Tekan <b>Buka lagi</b> untuk membuka toko.", en: "Your shop is closed now, so the note box isn't showing. Press <b>Reopen shop</b> to open again." },
      title: { id: "Catatan untuk pembeli", en: "Note for buyers" },
      text: { id: "Wajib diisi saat menutup toko. Pembeli melihat catatan ini, mis. <i>Libur Lebaran, buka lagi 15 Okt</i>.", en: "Required when closing. Buyers see this note, e.g. <i>Closed for Lebaran, back on 15 Oct</i>." } },
    { target: "#pauseBtn", title: { id: "Tutup sementara / Buka lagi", en: "Close temporarily / Reopen shop" },
      text: { id: "Tekan untuk menutup toko. Kalau sudah buka lagi, tombol yang sama menjadi <b>Buka lagi</b>. <b>Dalam tur ini tombol tidak ditekan.</b>",
        en: "Press to close the shop. When you're ready, the same button becomes <b>Reopen shop</b>. <b>In this tour the button isn't pressed.</b>" } },
    { title: { id: "Selesai! ✓", en: "Done! ✓" },
      text: { id: "Ingat membuka toko lagi setelah libur, supaya pembeli bisa memesan.", en: "Remember to reopen after your break, so buyers can order again." } },
  ] },

  { id: "data", title: { id: "Data toko", en: "Shop details" }, time: { id: "3 menit", en: "3 minutes" }, steps: [
    { target: "#profileForm h3", title: { id: "Data toko", en: "Shop details" },
      text: { id: "Nama, kontak, jam buka, dan alamat toko Anda. Semua bisa diubah kapan saja.", en: "Your name, contact, opening hours and shop address. You can change them any time." } },
    { target: field("#s-stall"), title: { id: "Nama dan nama toko", en: "Name and shop name" },
      text: { id: "<b>Nama Anda</b> wajib diisi. <b>Nama toko</b> boleh dikosongkan: nama Anda yang tampil.", en: "<b>Your name</b> is required. <b>Shop name</b> can stay empty: your own name shows instead." } },
    { target: field("#s-phone"), title: { id: "Nomor kontak", en: "Contact number" },
      text: { id: "Pembeli menelepon dan mengirim WhatsApp ke nomor ini. <b>Pakai nomor yang ada WhatsApp-nya.</b>", en: "Buyers call and WhatsApp this number. <b>Use a number that has WhatsApp.</b>" } },
    { target: field("#s-ig"), title: { id: "Instagram (opsional)", en: "Instagram (optional)" },
      text: { id: "Isi nama akun, mis. @semanggibusri. Pembeli melihat tombol Instagram di toko Anda.", en: "Your account name, e.g. @semanggibusri. Buyers see an Instagram button on your shop." } },
    { target: () => $("#s-fromhome")?.closest("label"), title: { id: "Juga jualan dari rumah", en: "Also sells from home" },
      text: { id: "Centang kalau pembeli juga bisa mengambil di rumah Anda. Alamat rumah <b>tidak pernah tampil</b> di website: kirim alamat lewat WhatsApp saat pembeli menghubungi.",
        en: "Tick this if buyers can also collect from your home. Your home address <b>never shows</b> on the website: send it on WhatsApp when a buyer gets in touch." } },
    { target: "fieldset.hours-edit legend", title: { id: "Jam buka", en: "Opening hours" },
      text: { id: "Centang hari buka dan isi jam buka dan tutup (waktu Surabaya). Pembeli melihat apakah toko sedang buka.", en: "Tick the days you're open and fill in the opening and closing times (Surabaya time). Buyers see whether you're open right now." } },
    { target: "fieldset.hours-edit > div:last-child button", title: { id: "Pakai jam Senin untuk semua hari", en: "Use Monday's hours for all days" },
      text: { id: "Isi Senin dulu, lalu tekan tombol ini: semua hari ikut sama. Ubah hari yang berbeda sesudahnya.", en: "Fill in Monday first, then press this: every day gets the same hours. Change any days that differ afterwards." } },
    { target: "fieldset.ahead-edit legend", title: { id: "Pesan sebelumnya", en: "Order ahead" },
      text: { id: "Pilih paling lambat berapa lama sebelumnya pembeli harus memesan, dari <b>1 jam</b> sampai <b>sebulan</b>. Pembeli melihatnya, mis. <i>Pesan minimal 3 jam sebelumnya</i>, dan jam ambil di formulir pesanan ikut menyesuaikan. Pilih <b>Bisa langsung</b> kalau tidak perlu pesan dulu.",
        en: "Choose how long ahead buyers must order, from <b>1 hour</b> to <b>a month</b>. Buyers see it, e.g. <i>Order at least 3 hours ahead</i>, and the pickup times in the order form follow it. Choose <b>Any time</b> if there's no need to order ahead." } },
    { target: "fieldset.deliv-edit legend", title: { id: "Ambil sendiri atau diantar", en: "Pickup or delivery" },
      text: { id: "<b>Ambil sendiri saja</b>: pembeli datang ke toko.<br><b>Bisa diantar / dikirim</b>: pilih negara dan provinsi tujuan. Pembeli lalu bisa meminta diantar, dan Anda membicarakan ongkos kirim lewat WhatsApp.",
        en: "<b>Pickup only</b>: buyers come to your shop.<br><b>Delivers / ships</b>: choose the countries and provinces you deliver to. Buyers can then ask for delivery, and you agree the delivery cost on WhatsApp." } },
    { target: locBox("#s-shop-addr"), title: { id: "Lokasi toko", en: "Shop location" },
      text: { id: "Tulis alamat dan tambahkan <b>titik peta</b>: tempel tautan Google Maps, atau tekan <b>Pakai lokasi saya sekarang</b> saat Anda berada di toko. Pembeli melihat peta dan petunjuk arah.",
        en: "Write the address and add a <b>map pin</b>: paste a Google Maps link, or press <b>Use my current location</b> while you're at the shop. Buyers see a map and directions." } },
    { target: locBox("#s-home-addr"), title: { id: "Lokasi rumah", en: "Home location" },
      text: { id: "Hanya Anda dan admin yang bisa melihatnya.", en: "Only you and the admin can see this." } },
    { target: '#profileForm > button[type="submit"]', title: { id: "Simpan data", en: "Save details" },
      text: { id: "Tekan setelah mengubah apa pun di bagian ini. <b>Dalam tur ini tombol tidak ditekan.</b>", en: "Press after changing anything in this section. <b>In this tour the button isn't pressed.</b>" } },
    { title: { id: "Selesai! ✓", en: "Done! ✓" },
      text: { id: "Data yang lengkap membuat pembeli lebih percaya dan mudah menemukan toko Anda.", en: "Complete details help buyers trust you and find your shop." } },
  ] },

  { id: "poster", title: { id: "Poster dan statistik", en: "Posters and statistics" }, time: { id: "2 menit", en: "2 minutes" }, steps: [
    { target: "#posterForm h3", title: { id: "Poster & iklan", en: "Posters & ads" },
      text: { id: "Pasang poster promo, menu, atau pengumuman. Poster tampil di halaman toko Anda. Maksimal 10 poster.", en: "Put up promo posters, menus or announcements. They show on your shop page. Up to 10 posters." } },
    { target: "#posterForm .drop", title: { id: "Gambar poster", en: "Poster image" },
      text: { id: "Pilih gambar dari HP Anda. Gambar dengan tulisan besar paling mudah dibaca.", en: "Pick an image from your phone. Images with big text are easiest to read." } },
    { target: field("#po-caption"), title: { id: "Keterangan (opsional)", en: "Caption (optional)" },
      text: { id: "Mis. <i>Promo Lebaran: diskon 10%</i>.", en: "E.g. <i>Lebaran promo: 10% off</i>." } },
    { target: "#posterBtn", title: { id: "Pasang poster", en: "Put up poster" },
      text: { id: "Memasang poster di halaman toko. Poster yang sudah dipasang tampil di bawahnya dan bisa dihapus. <b>Dalam tur ini tombol tidak ditekan.</b>",
        en: "Puts the poster on your shop page. Posters you've put up appear below and can be removed. <b>In this tour the button isn't pressed.</b>" } },
    { target: "#statsPanel .desk-head h3", title: { id: "Statistik toko", en: "Shop statistics" },
      text: { id: "Berapa pembeli yang melihat, menghubungi, atau membagikan produk Anda lewat website. Setiap pembeli dihitung sekali per hari.",
        en: "How many buyers viewed, contacted or shared your products through the website. Each buyer counts once a day." } },
    { target: '#statsRange button[data-range="month"]', do: true, title: { id: "Coba sendiri", en: "Try it yourself" },
      text: { id: "Ketuk <b>30 hari terakhir</b> untuk melihat angka sebulan.", en: "Tap <b>Last 30 days</b> to see the month's numbers." } },
    { target: "#statTiles", title: { id: "Bagus! 🎉", en: "Nice! 🎉" },
      text: { id: "<b>Dilihat</b> = membuka produk Anda.<br><b>Dihubungi</b> = menekan Telepon, WhatsApp, atau Pesan.<br><b>Dibagikan</b> = membagikan produk ke orang lain.",
        en: "<b>Viewed</b> = opened your product.<br><b>Contacted</b> = pressed Call, WhatsApp or Order.<br><b>Shared</b> = shared your product with someone." } },
    { target: "#statsPanel thead", title: { id: "Per produk", en: "Per product" },
      text: { id: "Angka untuk setiap produk. Produk yang banyak dilihat tapi jarang dihubungi mungkin perlu foto atau harga yang lebih jelas.",
        en: "Numbers for each product. A product that's viewed a lot but rarely contacted may need a clearer photo or price." } },
    { title: { id: "Selesai! ✓", en: "Done! ✓" },
      text: { id: "Lihat statistik setiap minggu untuk tahu produk mana yang paling diminati.", en: "Check your statistics each week to see which products buyers like most." } },
  ], end: () => pageClick($('#statsRange button[data-range="week"]')) },

  { id: "akun", title: { id: "Kata sandi dan keamanan", en: "Password and security" }, time: { id: "1 menit", en: "1 minute" }, steps: [
    { target: "#passwordForm h3", title: { id: "Ganti kata sandi", en: "Change password" },
      text: { id: "Isi kata sandi saat ini, lalu kata sandi baru dua kali (minimal 8 karakter), dan tekan <b>Ganti kata sandi</b>.",
        en: "Enter your current password, then the new one twice (at least 8 characters), and press <b>Change password</b>." } },
    { title: { id: "Lupa kata sandi?", en: "Forgot your password?" },
      text: { id: "Di halaman masuk, tekan <b>Lupa kata sandi?</b>. Kode 6 angka dikirim ke WhatsApp Anda. Kalau tidak berhasil, minta admin mengatur ulang kata sandi Anda.",
        en: "On the sign-in page, press <b>Forgot your password?</b>. A 6-digit code is sent to your WhatsApp. If that doesn't work, ask the admin to reset your password." } },
    { target: "#logoutBtn", title: { id: "Tetap aman", en: "Stay safe" },
      text: { id: "Jangan berikan kata sandi ke orang lain, dan tekan <b>Keluar</b> setelah memakai HP orang lain.", en: "Don't share your password, and press <b>Sign out</b> after using someone else's phone." } },
    { title: { id: "Semua tur selesai! ✓", en: "All the basics covered! ✓" },
      text: { id: "Lupa sesuatu? Buka <b>Bantuan</b> dan cari di panduan tertulis.", en: "Forgot something? Open <b>Help</b> and search the written guide." } },
  ] },
];

// ---------- the written guide ----------
const GUIDE = [
  { id: "masuk", title: { id: "Masuk dan lupa kata sandi", en: "Signing in and forgotten passwords" }, body: {
    id: `
    <h4>Masuk</h4>
    <ol>
      <li>Buka website Kampoeng Semanggi, lalu tekan <b>Untuk Penjual</b> (atau <b>Masuk penjual</b> di bagian bawah halaman).</li>
      <li>Isi <b>Nomor HP</b> yang didaftarkan admin. Boleh ditulis 0812…, +62 812…, atau dengan spasi.</li>
      <li>Isi <b>Kata sandi</b>, lalu tekan <b>Masuk</b>.</li>
    </ol>
    <p>Belum punya akun? Akun penjual dibuat oleh admin Kampoeng Semanggi. Hubungi admin untuk mendapat nomor masuk dan kata sandi awal.</p>
    <h4>Lupa kata sandi</h4>
    <ol>
      <li>Di halaman masuk, tekan <b>Lupa kata sandi?</b></li>
      <li>Isi nomor HP Anda dan tekan <b>Kirim kode</b>. Kode 6 angka dikirim ke WhatsApp Anda.</li>
      <li>Masukkan kode itu dan kata sandi baru (dua kali). Kode berlaku 10 menit.</li>
    </ol>
    <p class="help-tip">Kode tidak datang? Tunggu satu menit lalu kirim ulang. Kalau tetap tidak bisa, minta admin mengatur ulang kata sandi Anda.</p>
    <p>Setelah terlalu sering salah memasukkan kata sandi, tunggu 15 menit sebelum mencoba lagi.</p>`,
    en: `
    <h4>Signing in</h4>
    <ol>
      <li>Open the Kampoeng Semanggi website and press <b>For Sellers</b> (or <b>Seller sign-in</b> at the bottom of the page).</li>
      <li>Enter the <b>phone number</b> the admin registered. You can write it as 0812…, +62 812…, or with spaces.</li>
      <li>Enter your <b>password</b> and press <b>Sign in</b>.</li>
    </ol>
    <p>No account yet? Seller accounts are made by the Kampoeng Semanggi admin. Ask the admin for your sign-in number and starting password.</p>
    <h4>Forgotten password</h4>
    <ol>
      <li>On the sign-in page, press <b>Forgot your password?</b></li>
      <li>Enter your phone number and press <b>Send code</b>. A 6-digit code arrives on your WhatsApp.</li>
      <li>Enter the code and a new password (twice). The code lasts 10 minutes.</li>
    </ol>
    <p class="help-tip">No code? Wait a minute and send again. If it still doesn't work, ask the admin to reset your password.</p>
    <p>After too many wrong passwords, wait 15 minutes before trying again.</p>` } },

  { id: "pertama", title: { id: "Pertama kali masuk", en: "Your first sign-in" }, body: {
    id: `
    <p>Saat pertama kali masuk, Anda diminta mengisi <b>data toko</b> dulu. Toko Anda baru tampil di website setelah data ini disimpan.</p>
    <ol>
      <li>Isi <b>Nama Anda</b>, <b>Nama toko</b> (opsional), dan <b>Nomor kontak</b> untuk pembeli.</li>
      <li>Isi <b>Lokasi toko</b> (alamat dan titik peta). Kalau Anda hanya jualan dari rumah, centang <b>Juga jualan dari rumah</b>.</li>
      <li>Isi <b>Lokasi rumah</b>. Ini tidak pernah tampil di website.</li>
      <li>Tekan <b>Simpan dan mulai berjualan</b>.</li>
      <li>Tambahkan produk pertama Anda.</li>
    </ol>
    <p class="help-tip">Ganti kata sandi awal dari admin dengan kata sandi Anda sendiri di bagian <b>Ganti kata sandi</b>.</p>`,
    en: `
    <p>The first time you sign in, you fill in your <b>shop details</b> first. Your shop only appears on the website once they're saved.</p>
    <ol>
      <li>Fill in <b>Your name</b>, <b>Shop name</b> (optional) and the <b>Contact number</b> for buyers.</li>
      <li>Fill in your <b>Shop location</b> (address and map pin). If you only sell from home, tick <b>Also sells from home</b>.</li>
      <li>Fill in your <b>Home location</b>. It never shows on the website.</li>
      <li>Press <b>Save and start selling</b>.</li>
      <li>Add your first product.</li>
    </ol>
    <p class="help-tip">Swap the admin's starting password for your own under <b>Change password</b>.</p>` } },

  { id: "produk", title: { id: "Menambah dan mengubah produk", en: "Adding and editing products" }, body: {
    id: `
    <h4>Menambah produk</h4>
    <ol>
      <li>Di <b>Tambah produk</b>, pilih <b>Foto</b> dari HP Anda.</li>
      <li>Isi <b>Nama produk</b> dan <b>Harga (Rp)</b>, angka saja (mis. 15000).</li>
      <li>Isi <b>Dijual per</b>, mis. pincuk, bungkus, porsi, kg.</li>
      <li>Kalau satu harga berisi banyak buah, isi <b>Isi</b> (mis. 65). Pembeli bisa membandingkan harga per buah.</li>
      <li>Pilih <b>Kategori</b> dan tulis <b>Deskripsi</b> singkat.</li>
      <li>Tekan <b>Tambahkan ke toko</b>. Produk langsung tampil.</li>
    </ol>
    <h4>Tips foto yang bagus</h4>
    <ul>
      <li>Foto di tempat terang, sebaiknya cahaya siang.</li>
      <li>Foto dari dekat; makanan memenuhi layar.</li>
      <li>Latar bersih, mis. piring atau daun pisang.</li>
      <li>Satu produk per foto.</li>
    </ul>
    <h4>Mengubah produk</h4>
    <p>Di <b>Produk Anda</b>, tekan <b>Ubah</b>. Produk terbuka di formulir atas. Ubah yang perlu, lalu tekan <b>Simpan perubahan</b>, atau <b>Batal ubah</b>.</p>`,
    en: `
    <h4>Adding a product</h4>
    <ol>
      <li>Under <b>Add a product</b>, choose a <b>Photo</b> from your phone.</li>
      <li>Fill in the <b>Product name</b> and <b>Price (Rp)</b>, numbers only (e.g. 15000).</li>
      <li>Fill in <b>Sold per</b>, e.g. pincuk, pack, portion, kg.</li>
      <li>If one price buys many pieces, fill in <b>Pieces</b> (e.g. 65). Buyers can compare the price per piece.</li>
      <li>Choose a <b>Category</b> and write a short <b>Description</b>.</li>
      <li>Press <b>Add to my shop</b>. The product shows straight away.</li>
    </ol>
    <h4>Tips for a good photo</h4>
    <ul>
      <li>Take it somewhere bright, ideally in daylight.</li>
      <li>Get close; let the food fill the screen.</li>
      <li>Use a clean background, e.g. a plate or banana leaf.</li>
      <li>One product per photo.</li>
    </ul>
    <h4>Editing a product</h4>
    <p>Under <b>Your products</b>, press <b>Edit</b>. The product opens in the form above. Change what you need, then press <b>Save changes</b>, or <b>Cancel edit</b>.</p>` } },

  { id: "habis", title: { id: "Habis, hapus, dan disembunyikan admin", en: "Sold out, removing, and hidden by admin" }, body: {
    id: `
    <ul>
      <li><b>Tandai habis</b>: produk tetap tampil dengan tanda habis. Tekan <b>Jual lagi</b> kalau sudah ada.</li>
      <li><b>Hapus</b>: produk dan fotonya hilang. Sebuah jendela meminta konfirmasi dulu.</li>
      <li><b>Disembunyikan admin</b>: admin menyembunyikan produk ini, misalnya karena foto atau harganya salah. Perbaiki dengan <b>Ubah</b>, lalu hubungi admin.</li>
    </ul>
    <div class="help-warn"><b>⚠️ Produk yang dihapus tidak bisa dikembalikan.</b> Kalau hanya habis sementara, pakai <b>Tandai habis</b>.</div>`,
    en: `
    <ul>
      <li><b>Sold out</b>: the product stays on show, marked as sold out. Press <b>Back on sale</b> when you have it again.</li>
      <li><b>Remove</b>: the product and its photo are deleted. A window asks you to confirm first.</li>
      <li><b>Hidden by admin</b>: the admin has hidden this product, for example because the photo or price was wrong. Fix it with <b>Edit</b>, then contact the admin.</li>
    </ul>
    <div class="help-warn"><b>⚠️ A removed product can't be brought back.</b> If it's only out of stock for now, use <b>Sold out</b>.</div>` } },

  { id: "tutup", title: { id: "Menutup toko sementara", en: "Closing your shop for a while" }, body: {
    id: `
    <ol>
      <li>Di <b>Status toko</b>, tulis <b>Catatan untuk pembeli</b>, mis. <i>Libur Lebaran, buka lagi 15 Okt</i>. Wajib diisi.</li>
      <li>Tekan <b>Tutup sementara</b>.</li>
      <li>Label di atas berubah menjadi <b>Tutup sementara</b>, dan pembeli melihat catatan Anda.</li>
      <li>Kalau sudah buka lagi, tekan <b>Buka lagi</b>.</li>
    </ol>
    <h4>Tutup sementara dan Ditangguhkan, apa bedanya?</h4>
    <ul>
      <li><b>Tutup sementara</b>: Anda sendiri yang menutup dan membuka toko kapan saja.</li>
      <li><b>Ditangguhkan</b>: admin menyembunyikan toko dan Anda tidak bisa masuk. Hubungi admin kalau ini terjadi.</li>
    </ul>`,
    en: `
    <ol>
      <li>Under <b>Shop status</b>, write a <b>Note for buyers</b>, e.g. <i>Closed for Lebaran, back on 15 Oct</i>. It's required.</li>
      <li>Press <b>Close temporarily</b>.</li>
      <li>The label at the top changes to <b>Temporarily closed</b>, and buyers see your note.</li>
      <li>When you're open again, press <b>Reopen shop</b>.</li>
    </ol>
    <h4>Temporarily closed vs. suspended</h4>
    <ul>
      <li><b>Temporarily closed</b>: you close and reopen the shop yourself, any time.</li>
      <li><b>Suspended</b>: the admin has hidden the shop and you can't sign in. Contact the admin if this happens.</li>
    </ul>` } },

  { id: "data", title: { id: "Data toko: jam buka, antar, alamat", en: "Shop details: hours, delivery, addresses" }, body: {
    id: `
    <ul>
      <li><b>Nama toko</b> boleh kosong; nama Anda yang tampil.</li>
      <li><b>Nomor kontak</b>: pembeli menelepon dan mengirim WhatsApp ke nomor ini. Pakai nomor yang ada WhatsApp-nya.</li>
      <li><b>Instagram</b>: pembeli melihat tombol Instagram di toko Anda.</li>
    </ul>
    <h4>Jam buka</h4>
    <ol>
      <li>Centang hari buka, lalu isi jam buka dan tutup (waktu Surabaya, WIB).</li>
      <li>Hari yang jamnya sama? Isi Senin, lalu tekan <b>Pakai jam Senin untuk semua hari</b>.</li>
      <li>Biarkan semua kosong kalau tidak ingin menampilkan jam buka.</li>
    </ol>
    <p>Pembeli melihat apakah toko sedang buka, mis. <i>Buka · tutup jam 15.00</i>.</p>
    <h4>Pesan sebelumnya</h4>
    <p>Di <b>Pembeli harus pesan paling lambat</b>, pilih berapa lama sebelumnya pembeli harus memesan (mis. <i>3 jam sebelumnya</i> atau <i>H-1</i>). Pembeli melihatnya di toko Anda, dan jam ambil di formulir pesanan ikut menyesuaikan. Pilih <b>Bisa langsung</b> kalau tidak perlu pesan dulu.</p>
    <h4>Ambil sendiri atau diantar</h4>
    <ul>
      <li><b>Ambil sendiri saja</b>: pembeli datang ke toko.</li>
      <li><b>Bisa diantar / dikirim</b>: pilih negara tujuan; kalau Indonesia, pilih provinsinya (ada <b>Pilih semua</b> dan kotak cari). Pembeli bisa memilih <b>Minta diantar</b>, dan pesannya meminta Anda menyebutkan ongkos kirim.</li>
    </ul>
    <h4>Lokasi toko dan rumah</h4>
    <ul>
      <li>Tulis alamat, lalu tambahkan <b>Titik peta</b>: di Google Maps, cari tempatnya, salin tautan dari bilah alamat, dan tempel. Atau tekan <b>Pakai lokasi saya sekarang</b> saat Anda berada di toko.</li>
      <li><b>Lokasi rumah</b> hanya terlihat oleh Anda dan admin.</li>
    </ul>
    <p>Tekan <b>Simpan data</b> setelah mengubah apa pun.</p>`,
    en: `
    <ul>
      <li><b>Shop name</b> can stay empty; your own name shows.</li>
      <li><b>Contact number</b>: buyers call and WhatsApp this number. Use one that has WhatsApp.</li>
      <li><b>Instagram</b>: buyers see an Instagram button on your shop.</li>
    </ul>
    <h4>Opening hours</h4>
    <ol>
      <li>Tick the days you're open, then fill in the opening and closing times (Surabaya time, WIB).</li>
      <li>Same hours most days? Fill in Monday, then press <b>Use Monday's hours for all days</b>.</li>
      <li>Leave them all empty if you don't want to show opening hours.</li>
    </ol>
    <p>Buyers see whether you're open now, e.g. <i>Open · closes at 15:00</i>.</p>
    <h4>Order ahead</h4>
    <p>Under <b>Buyers must order at least</b>, choose how long ahead buyers must order (e.g. <i>3 hours ahead</i> or <i>1 day ahead</i>). Buyers see it on your shop, and the pickup times in the order form follow it. Choose <b>Any time</b> if there's no need to order ahead.</p>
    <h4>Pickup or delivery</h4>
    <ul>
      <li><b>Pickup only</b>: buyers come to your shop.</li>
      <li><b>Delivers / ships</b>: choose the countries you deliver to; for Indonesia, choose the provinces (there's <b>Select all</b> and a search box). Buyers can then choose <b>Ask for delivery</b>, and their message asks you for the delivery cost.</li>
    </ul>
    <h4>Shop and home location</h4>
    <ul>
      <li>Write the address, then add a <b>Map pin</b>: find the place in Google Maps, copy the link from the address bar and paste it. Or press <b>Use my current location</b> while you're at the shop.</li>
      <li>Your <b>Home location</b> is only seen by you and the admin.</li>
    </ul>
    <p>Press <b>Save details</b> after changing anything.</p>` } },

  { id: "poster", title: { id: "Poster dan iklan", en: "Posters and ads" }, body: {
    id: `
    <ol>
      <li>Di <b>Poster &amp; iklan</b>, pilih <b>Gambar poster</b>.</li>
      <li>Tambahkan <b>Keterangan</b> kalau mau, mis. <i>Promo Lebaran: diskon 10%</i>.</li>
      <li>Tekan <b>Pasang poster</b>.</li>
    </ol>
    <p>Poster tampil di halaman toko Anda (maksimal 10). Tekan <b>Lihat halaman toko saya</b> untuk melihatnya. Poster yang sudah dipasang tampil di bawah formulir dan bisa dihapus.</p>`,
    en: `
    <ol>
      <li>Under <b>Posters &amp; ads</b>, choose a <b>Poster image</b>.</li>
      <li>Add a <b>Caption</b> if you like, e.g. <i>Lebaran promo: 10% off</i>.</li>
      <li>Press <b>Put up poster</b>.</li>
    </ol>
    <p>Posters show on your shop page (up to 10). Press <b>See my shop page</b> to view them. Posters you've put up are listed under the form and can be removed.</p>` } },

  { id: "statistik", title: { id: "Membaca statistik", en: "Reading your statistics" }, body: {
    id: `
    <ul>
      <li><b>Dilihat</b>: pembeli membuka produk Anda.</li>
      <li><b>Dihubungi</b>: pembeli menekan Telepon, WhatsApp, atau Pesan.</li>
      <li><b>Dibagikan</b>: pembeli membagikan produk Anda.</li>
    </ul>
    <p>Pilih <b>7 hari terakhir</b> atau <b>30 hari terakhir</b>. Setiap pembeli dihitung sekali per hari. Produk yang sering dihubungi bisa mendapat label <b>Lagi hits</b> di katalog.</p>
    <p class="help-tip">Banyak dilihat tapi jarang dihubungi? Coba foto yang lebih terang, harga yang jelas, atau deskripsi yang lebih menarik.</p>`,
    en: `
    <ul>
      <li><b>Viewed</b>: a buyer opened your product.</li>
      <li><b>Contacted</b>: a buyer pressed Call, WhatsApp or Order.</li>
      <li><b>Shared</b>: a buyer shared your product.</li>
    </ul>
    <p>Choose <b>Last 7 days</b> or <b>Last 30 days</b>. Each buyer counts once a day. Products buyers contact often can get a <b>Trending now</b> badge in the catalog.</p>
    <p class="help-tip">Viewed a lot but rarely contacted? Try a brighter photo, a clearer price or a more tempting description.</p>` } },

  { id: "pesanan", title: { id: "Cara pembeli memesan dan membalas", en: "How buyers order, and replying" }, body: {
    id: `
    <h4>Pembeli berbahasa Indonesia</h4>
    <p>Mereka menekan <b>Telepon</b> atau <b>WhatsApp</b> di produk Anda. WhatsApp terbuka dengan pesan yang sudah ditulis, mis. <i>Halo, saya mau pesan…</i></p>
    <h4>Pembeli dari luar negeri</h4>
    <ol>
      <li>Mereka menekan <b>Pesan</b> dan menjawab beberapa pertanyaan: produk dan jumlah, ambil sendiri atau diantar, waktu, permintaan khusus, dan nama.</li>
      <li>Anda menerima pesan WhatsApp <b>dalam bahasa Indonesia</b>.</li>
      <li>Catatan pembeli diterjemahkan otomatis. Catatan aslinya ikut dikirim, mis. <i>(Aslinya dalam bahasa Jepang: …)</i>.</li>
    </ol>
    <p class="help-tip">Terjemahan bisa keliru. Kalau ada yang aneh, tanyakan lagi ke pembeli. WhatsApp punya fitur terjemahan, atau pakai Google Translate.</p>
    <h4>Pesanan diantar</h4>
    <p>Kalau Anda memilih <b>Bisa diantar / dikirim</b>, pembeli bisa menulis alamat dan waktunya. Pesannya meminta Anda menyebutkan <b>ongkos kirim</b>. Sepakati ongkos dan waktunya lewat WhatsApp.</p>
    <h4>Membalas pesanan</h4>
    <ul>
      <li>Balas secepatnya: pembeli biasanya memesan dari beberapa toko.</li>
      <li>Konfirmasi pesanan, total harga, dan waktu ambil atau antar.</li>
      <li>Pembayaran diatur langsung antara Anda dan pembeli; website tidak menerima pembayaran.</li>
      <li>Kalau pembeli mengambil di rumah, kirim alamat rumah lewat WhatsApp.</li>
      <li>Pembeli menyebutkan nama pesanan; cocokkan nama itu saat mereka datang.</li>
    </ul>`,
    en: `
    <h4>Indonesian-speaking buyers</h4>
    <p>They press <b>Call</b> or <b>WhatsApp</b> on your product. WhatsApp opens with a message already written, e.g. <i>Halo, saya mau pesan…</i> ("Hello, I'd like to order…").</p>
    <h4>Buyers from abroad</h4>
    <ol>
      <li>They press <b>Order</b> and answer a few questions: products and amounts, pickup or delivery, time, special requests and their name.</li>
      <li>You receive the WhatsApp message <b>in Indonesian</b>.</li>
      <li>The buyer's note is translated automatically. The original note comes along too, e.g. <i>(Aslinya dalam bahasa Jepang: …)</i>, meaning "originally in Japanese".</li>
    </ol>
    <p class="help-tip">Translations can be wrong. If something seems odd, ask the buyer again. WhatsApp has a translate feature, or use Google Translate.</p>
    <h4>Delivery orders</h4>
    <p>If you chose <b>Delivers / ships</b>, buyers can write where and when. Their message asks you for the <b>delivery cost</b>. Agree the cost and time on WhatsApp.</p>
    <h4>Replying to orders</h4>
    <ul>
      <li>Reply quickly: buyers often message several shops.</li>
      <li>Confirm the order, the total price and the pickup or delivery time.</li>
      <li>Payment is arranged directly between you and the buyer; the website doesn't take payments.</li>
      <li>If the buyer collects from your home, send your home address on WhatsApp.</li>
      <li>Buyers give a name for the order; check it when they arrive.</li>
    </ul>` } },

  { id: "akun", title: { id: "Kata sandi dan keamanan", en: "Password and security" }, body: {
    id: `
    <ol>
      <li>Di <b>Ganti kata sandi</b>, isi <b>Kata sandi saat ini</b>.</li>
      <li>Isi <b>Kata sandi baru</b> dua kali (minimal 8 karakter).</li>
      <li>Tekan <b>Ganti kata sandi</b>.</li>
    </ol>
    <ul>
      <li>Jangan berikan kata sandi ke siapa pun. Admin tidak akan memintanya.</li>
      <li>Pakai kata sandi yang panjang, bukan tanggal lahir.</li>
      <li>Tekan <b>Keluar</b> setelah memakai HP orang lain.</li>
      <li>Anda tetap masuk selama 30 hari di HP yang sama.</li>
    </ul>`,
    en: `
    <ol>
      <li>Under <b>Change password</b>, enter your <b>Current password</b>.</li>
      <li>Enter the <b>New password</b> twice (at least 8 characters).</li>
      <li>Press <b>Change password</b>.</li>
    </ol>
    <ul>
      <li>Never share your password. The admin will never ask for it.</li>
      <li>Use a long password, not your birthday.</li>
      <li>Press <b>Sign out</b> after using someone else's phone.</li>
      <li>You stay signed in for 30 days on the same phone.</li>
    </ul>` } },

  { id: "masalah", title: { id: "Masalah umum dan jawabannya", en: "Common problems and answers" }, body: {
    id: `
    <dl class="help-qa">
      <dt>Tidak bisa masuk</dt>
      <dd>Periksa nomor HP dan kata sandi. Pakai <b>Lupa kata sandi?</b>, atau minta admin mengatur ulang. Kalau muncul "Akun ini ditangguhkan", hubungi admin.</dd>
      <dt>Toko saya tidak tampil di website</dt>
      <dd>Pastikan data toko sudah disimpan dan toko tidak sedang <b>Tutup sementara</b>.</dd>
      <dt>Produk saya tidak tampil</dt>
      <dd>Periksa apakah berlabel <b>Disembunyikan admin</b>. Muat ulang halaman website di browser.</dd>
      <dt>Foto gagal diunggah</dt>
      <dd>Pakai foto biasa (JPG atau PNG) dan periksa koneksi internet, lalu coba lagi.</dd>
      <dt>Titik peta tidak bisa dibaca</dt>
      <dd>Tautan pendek dari tombol Bagikan tidak bisa dipakai. Buka tautannya, lalu salin alamat lengkap dari bilah alamat browser. Atau tekan <b>Pakai lokasi saya sekarang</b> saat berada di toko.</dd>
      <dt>Muncul "Sesi Anda berakhir"</dt>
      <dd>Masuk lagi dengan nomor HP dan kata sandi Anda.</dd>
      <dt>Pembeli bilang toko saya tutup, padahal buka</dt>
      <dd>Periksa <b>Jam buka</b> di Data toko dan status toko di atas halaman.</dd>
      <dt>Apakah tur panduan mengubah data saya?</dt>
      <dd>Tidak. Selama tur, tombol simpan dan hapus tidak bisa ditekan.</dd>
    </dl>`,
    en: `
    <dl class="help-qa">
      <dt>I can't sign in</dt>
      <dd>Check your phone number and password. Use <b>Forgot your password?</b>, or ask the admin to reset it. If you see "This account is suspended", contact the admin.</dd>
      <dt>My shop isn't on the website</dt>
      <dd>Make sure your shop details are saved and the shop isn't <b>Temporarily closed</b>.</dd>
      <dt>My product isn't showing</dt>
      <dd>Check whether it's labelled <b>Hidden by admin</b>. Reload the website in your browser.</dd>
      <dt>The photo won't upload</dt>
      <dd>Use an ordinary photo (JPG or PNG), check your internet connection, and try again.</dd>
      <dt>The map pin isn't accepted</dt>
      <dd>Short links from the Share button don't work. Open the link, then copy the full address from the browser's address bar. Or press <b>Use my current location</b> while you're at the shop.</dd>
      <dt>"You've been signed out"</dt>
      <dd>Sign in again with your phone number and password.</dd>
      <dt>Buyers say my shop is closed when it's open</dt>
      <dd>Check your <b>Opening hours</b> in Shop details and the shop status at the top of the page.</dd>
      <dt>Does the guided tour change my data?</dt>
      <dd>No. During a tour, save and delete buttons can't be pressed.</dd>
    </dl>` } },

  { id: "istilah", title: { id: "Daftar istilah", en: "Glossary" }, body: {
    id: `
    <dl class="help-qa">
      <dt>Katalog</dt><dd>Daftar semua produk dari semua toko di website.</dd>
      <dt>Halaman toko</dt><dd>Halaman khusus toko Anda: produk, jam buka, peta, poster, dan kontak.</dd>
      <dt>Tandai habis</dt><dd>Produk tetap tampil, tetapi pembeli tahu sedang habis.</dd>
      <dt>Tutup sementara</dt><dd>Anda menutup toko sendiri, dengan catatan untuk pembeli.</dd>
      <dt>Ditangguhkan</dt><dd>Admin menyembunyikan toko; Anda tidak bisa masuk.</dd>
      <dt>Disembunyikan admin</dt><dd>Satu produk disembunyikan oleh admin.</dd>
      <dt>Titik peta</dt><dd>Letak toko di Google Maps, supaya pembeli bisa menemukan jalan.</dd>
      <dt>Pesan sebelumnya</dt><dd>Berapa lama sebelumnya pembeli harus memesan, mis. 3 jam atau H-1.</dd>
    </dl>`,
    en: `
    <dl class="help-qa">
      <dt>Catalog</dt><dd>The list of every product from every shop on the website.</dd>
      <dt>Shop page</dt><dd>Your own page: products, opening hours, map, posters and contact.</dd>
      <dt>Sold out</dt><dd>The product stays on show, but buyers know it's run out.</dd>
      <dt>Temporarily closed</dt><dd>You've closed the shop yourself, with a note for buyers.</dd>
      <dt>Suspended</dt><dd>The admin has hidden the shop; you can't sign in.</dd>
      <dt>Hidden by admin</dt><dd>One product hidden by the admin.</dd>
      <dt>Map pin</dt><dd>Your shop's spot on Google Maps, so buyers can find their way.</dd>
      <dt>Order ahead</dt><dd>How long ahead buyers must order, e.g. 3 hours or 1 day.</dd>
    </dl>` } },
];

// Small "?" buttons beside headings that open the guide at the matching topic.
const HEAD_LINKS = [
  ['[data-i18n="pause.title"]', "tutup"], ['[data-i18n="sstats.title"]', "statistik"], ["#productFormTitle", "produk"],
  ['[data-i18n="mine.title"]', "habis"], ['[data-i18n="posters.sellerTitle"]', "poster"], ['#passwordForm [data-i18n="common.changePassword"]', "akun"],
  ['[data-i18n="profile.title"]', "data"],
];

setupHelp({
  tours: TOURS, guide: GUIDE, headLinks: HEAD_LINKS, bilingual: true,
  button: "#helpBtn, .help-open",
  doneKey: "ks-seller-tours", welcomeKey: "ks-seller-welcomed",
  welcome: {
    title: { id: "Selamat datang di halaman toko Anda! 👋", en: "Welcome to your shop page! 👋" },
    text: { id: "Mau tur singkat? Dalam satu menit Anda dikenalkan dengan halaman ini. Tur tidak mengubah apa pun, dan bisa dibuka lagi kapan saja lewat tombol Bantuan.",
      en: "Would you like a quick tour? In a minute you'll get to know this page. The tour doesn't change anything, and you can open it again any time with the Help button." },
  },
  allDone: { id: "🏅 Semua tur selesai! Selamat berjualan.", en: "🏅 All tours done! Happy selling." },
});
