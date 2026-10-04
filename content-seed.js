// Starting content for Our People (groups) and Collaborations (partners), and their intro texts.
// It is put in the database once, the first time the server starts with these tables; after that admins
// edit it under Warga & Mitra in /pengelola. A partner with addedLater was added after the first release:
// it's also put in once on sites that already had the starting content (see seedAbout in server.js). The texts are used until an admin saves their own.
export default {
  "groups": [
    {
      "icon": "store",
      "name": "Para Penjual",
      "nameEn": "Sellers",
      "body": "Warga Kendung, perempuan maupun laki-laki, yang membuat dan menjual pecel semanggi, kue, dan olahan semanggi lainnya.",
      "bodyEn": "Kendung residents, women and men alike, who make and sell pecel semanggi, cookies and other semanggi foods.",
      "showSellers": true,
      "photos": [
        {
          "src": "/warga-foto/penjual-2.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Penjual semanggi menyambut pembeli di tokonya.",
          "captionEn": "Semanggi sellers welcoming buyers at their stall."
        },
        {
          "src": "/warga-foto/penjual-1.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Toko pecel semanggi dengan kerupuk puli yang besar.",
          "captionEn": "A pecel semanggi stall with big puli crackers."
        }
      ]
    },
    {
      "icon": "sprout",
      "name": "Petani",
      "nameEn": "Farmers",
      "body": "Menanam semanggi dan padi di sawah sekitar kampung, sehingga daun semanggi selalu segar.",
      "bodyEn": "They grow semanggi and rice in the fields around the village, so the semanggi leaves are always fresh.",
      "showSellers": false,
      "photos": [
        {
          "src": "/warga-foto/petani-1.jpg",
          "w": 842,
          "h": 1100,
          "caption": "Petani memanen semanggi di sawah Kendung.",
          "captionEn": "Farmers harvesting semanggi in the Kendung fields."
        },
        {
          "src": "/warga-foto/petani-2.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Sawah semanggi di tengah kampung.",
          "captionEn": "A semanggi field in the middle of the village."
        }
      ]
    },
    {
      "icon": "users",
      "name": "Tokoh Masyarakat",
      "nameEn": "Community Leaders",
      "body": "Sesepuh dan tokoh warga yang menjaga tradisi semanggi dan membimbing kampung.",
      "bodyEn": "Elders and respected residents who keep the semanggi tradition alive and guide the village.",
      "showSellers": false,
      "photos": [
        {
          "src": "/warga-foto/tokoh-1.jpg",
          "w": 664,
          "h": 374,
          "caption": "Rapat koordinasi bersama tokoh masyarakat, tokoh agama, dan Camat Benowo (2022).",
          "captionEn": "Coordination meeting with community and religious leaders and the Camat of Benowo (2022)."
        },
        {
          "src": "/warga-foto/tokoh-2.jpg",
          "w": 670,
          "h": 377,
          "caption": "Warga dan tokoh masyarakat membahas Kendung sebagai kampung wisata.",
          "captionEn": "Residents and community leaders discussing Kendung as a tourism village."
        },
        {
          "src": "/warga-foto/tokoh-3.jpg",
          "w": 698,
          "h": 312,
          "caption": "Sesepuh dan warga pada malam peringatan kemerdekaan.",
          "captionEn": "Elders and residents at the Independence Day evening."
        },
        {
          "src": "/warga-foto/tokoh-4.jpg",
          "w": 700,
          "h": 313,
          "caption": "Tokoh masyarakat pada malam tasyakuran kemerdekaan.",
          "captionEn": "Community leaders at the Independence Day thanksgiving evening."
        }
      ]
    },
    {
      "icon": "home",
      "name": "Pengurus RW 03, RT, dan PKK",
      "nameEn": "RW 03, RT and PKK committees",
      "body": "Menjaga kampung, mengatur kegiatan warga, dan menyambut tamu yang berkunjung.",
      "bodyEn": "They look after the village, organise community activities and welcome visitors.",
      "showSellers": false,
      "photos": [
        {
          "src": "/warga-foto/pkk-1.jpg",
          "w": 651,
          "h": 356,
          "caption": "Ibu-ibu PKK menunjukkan olahan semanggi kepada tamu.",
          "captionEn": "PKK women showing semanggi products to visitors."
        },
        {
          "src": "/warga-foto/pkk-2.jpg",
          "w": 650,
          "h": 366,
          "caption": "PKK menyambut tamu di stan produk warga.",
          "captionEn": "The PKK welcoming guests at the residents' product stand."
        },
        {
          "src": "/warga-foto/pkk-3.jpg",
          "w": 678,
          "h": 383,
          "caption": "Produk buatan warga yang dipamerkan PKK.",
          "captionEn": "Residents' products shown by the PKK."
        },
        {
          "src": "/warga-foto/pkk-4.jpg",
          "w": 698,
          "h": 524,
          "caption": "Stan RT 02 pada peringatan HUT RI ke-77.",
          "captionEn": "The RT 02 stand at the 77th Independence Day celebration."
        },
        {
          "src": "/warga-foto/pkk-5.jpg",
          "w": 616,
          "h": 462,
          "caption": "Warga RT 07 menyiapkan hidangan di stan mereka.",
          "captionEn": "RT 07 residents preparing food at their stand."
        },
        {
          "src": "/warga-foto/pkk-6.jpg",
          "w": 369,
          "h": 277,
          "caption": "Pos Kamling RT 02 RW 03.",
          "captionEn": "The RT 02 RW 03 neighbourhood watch post."
        },
        {
          "src": "/warga-foto/pkk-7.jpg",
          "w": 1100,
          "h": 619,
          "caption": "Pengurus kampung berkumpul di rumah warga.",
          "captionEn": "Village committee members gathered at a resident's home."
        }
      ]
    },
    {
      "icon": "sparkles",
      "name": "Karang Taruna RW 03",
      "nameEn": "Karang Taruna RW 03",
      "body": "Pemuda kampung yang mengelola situs web Kampoeng Semanggi.",
      "bodyEn": "The village youth group, who run the Kampoeng Semanggi website.",
      "showSellers": false,
      "photos": [
        {
          "src": "/warga-foto/karang-taruna-1.jpg",
          "w": 649,
          "h": 478,
          "caption": "Karang Taruna RW 03 dalam pelatihan kewirausahaan.",
          "captionEn": "Karang Taruna RW 03 at a business training."
        },
        {
          "src": "/warga-foto/karang-taruna-2.jpg",
          "w": 633,
          "h": 477,
          "caption": "Peserta pelatihan kewirausahaan untuk Karang Taruna.",
          "captionEn": "Young people taking part in the business training."
        },
        {
          "src": "/warga-foto/karang-taruna-3.jpg",
          "w": 752,
          "h": 478,
          "caption": "Pemuda kampung belajar memulai usaha.",
          "captionEn": "Village youth learning how to start a business."
        }
      ]
    },
    {
      "icon": "palette",
      "name": "Pembatik",
      "nameEn": "Batik Makers",
      "body": "Perajin batik dari kampung, bagian dari kerajinan dan budaya Kampoeng Semanggi.",
      "bodyEn": "Batik makers from the village, part of Kampoeng Semanggi's crafts and culture.",
      "showSellers": false,
      "photos": []
    }
  ],
  "partners": [
    {
      "years": "2017",
      "name": "Kecamatan Benowo dan Kelurahan Sememi",
      "nameEn": "Benowo district and Sememi sub-district",
      "body": "Memberi nama Kampoeng Semanggi, melatih 180 pedagang semanggi, dan menyiapkan kampung wisata edukasi dan kuliner.",
      "bodyEn": "Named the village Kampoeng Semanggi, trained 180 semanggi sellers and are preparing it as an educational and food-tourism village.",
      "photos": [
        {
          "src": "/kerja-sama-foto/pemerintah-1.jpg",
          "w": 944,
          "h": 708,
          "caption": "Cangkrukan Tiga Pilar, Oktober 2017.",
          "captionEn": "Cangkrukan Tiga Pilar, October 2017."
        },
        {
          "src": "/kerja-sama-foto/pemerintah-2.jpg",
          "w": 676,
          "h": 507,
          "caption": "Sambutan pada malam pemberian nama Kampoeng Semanggi.",
          "captionEn": "A speech on the night Kampoeng Semanggi was named."
        },
        {
          "src": "/kerja-sama-foto/pemerintah-3.jpg",
          "w": 676,
          "h": 508,
          "caption": "Pejabat dan warga duduk bersama saat cangkrukan.",
          "captionEn": "Officials and residents sitting together at the cangkrukan."
        },
        {
          "src": "/kerja-sama-foto/pemerintah-4.jpg",
          "w": 690,
          "h": 517,
          "caption": "Warga Kendung memenuhi jalan kampung untuk cangkrukan.",
          "captionEn": "Kendung residents filling the lane for the cangkrukan."
        },
        {
          "src": "/kerja-sama-foto/pemerintah-5.jpg",
          "w": 686,
          "h": 515,
          "caption": "Polsek, Koramil, dan warga di malam cangkrukan.",
          "captionEn": "Police, army and residents on the cangkrukan night."
        },
        {
          "src": "/kerja-sama-foto/pemerintah-6.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Piagam penghargaan Wali Kota Surabaya untuk Ketua RT Teladan (2022).",
          "captionEn": "The Mayor of Surabaya's award for the model RT head (2022)."
        }
      ]
    },
    {
      "years": "2021",
      "name": "Astra: Kampung Berseri Astra",
      "nameEn": "Astra: Kampung Berseri Astra",
      "body": "Kampoeng Semanggi menjadi kampung binaan Astra lewat empat pilar: sehat, pendidikan, kreatif, dan lingkungan.",
      "bodyEn": "Kampoeng Semanggi became an Astra-supported village through four pillars: health, education, creativity and environment.",
      "photos": [
        {
          "src": "/kerja-sama-foto/astra-1.jpg",
          "w": 700,
          "h": 366,
          "caption": "Peresmian Kampung Berseri Astra, 3 September 2021.",
          "captionEn": "Opening of Kampung Berseri Astra, 3 September 2021."
        },
        {
          "src": "/kerja-sama-foto/astra-2.jpg",
          "w": 521,
          "h": 275,
          "caption": "Pembagian paket sembako untuk warga.",
          "captionEn": "Food parcels handed out to residents."
        },
        {
          "src": "/kerja-sama-foto/astra-3.jpg",
          "w": 686,
          "h": 514,
          "caption": "Penyerahan sembako saat peresmian KBA.",
          "captionEn": "Handing over food parcels at the KBA opening."
        },
        {
          "src": "/kerja-sama-foto/astra-4.jpg",
          "w": 691,
          "h": 311,
          "caption": "Posyandu Pilar Sehat KBA.",
          "captionEn": "The KBA health pillar's child-health post."
        },
        {
          "src": "/kerja-sama-foto/astra-5.jpg",
          "w": 678,
          "h": 313,
          "caption": "Kader posyandu dan relawan KBA.",
          "captionEn": "Health-post volunteers and KBA volunteers."
        },
        {
          "src": "/kerja-sama-foto/astra-6.jpg",
          "w": 686,
          "h": 317,
          "caption": "Pembagian makanan tambahan bergizi untuk balita.",
          "captionEn": "Nutritious extra food for toddlers."
        },
        {
          "src": "/kerja-sama-foto/astra-7.jpg",
          "w": 699,
          "h": 323,
          "caption": "Makanan tambahan untuk balita di posyandu.",
          "captionEn": "Extra food for toddlers at the health post."
        }
      ]
    },
    {
      "years": "2021–2022",
      "name": "Universitas Wijaya Putra Surabaya",
      "nameEn": "Universitas Wijaya Putra Surabaya",
      "body": "Mitra program Kampung Berseri Astra. Mahasiswa KKN membuat spot foto dan situs web kampung.",
      "bodyEn": "Partner in the Kampung Berseri Astra programme. Its community-service students built photo spots and the village website.",
      "photos": [
        {
          "src": "/kerja-sama-foto/uwp-1.jpg",
          "w": 1024,
          "h": 576,
          "caption": "Mahasiswa KKN UWP menyerahkan situs web kampung kepada pengurus RW.",
          "captionEn": "UWP students handing the village website to the RW committee."
        },
        {
          "src": "/kerja-sama-foto/uwp-2.jpg",
          "w": 688,
          "h": 516,
          "caption": "Penutupan KKN UWP, 31 Juli 2022.",
          "captionEn": "Closing night of the UWP student programme, 31 July 2022."
        },
        {
          "src": "/kerja-sama-foto/uwp-3.jpg",
          "w": 689,
          "h": 516,
          "caption": "Sambutan pada peluncuran spot foto karya mahasiswa.",
          "captionEn": "A speech at the launch of the students' photo spots."
        },
        {
          "src": "/kerja-sama-foto/uwp-4.jpg",
          "w": 654,
          "h": 488,
          "caption": "Mahasiswa KKN UWP dan warga Kendung.",
          "captionEn": "UWP students and Kendung residents."
        },
        {
          "src": "/kerja-sama-foto/uwp-5.jpg",
          "w": 681,
          "h": 511,
          "caption": "Pembukaan KKN mahasiswa UWP di balai RW.",
          "captionEn": "Opening of the UWP student programme at the RW hall."
        },
        {
          "src": "/kerja-sama-foto/uwp-6.jpg",
          "w": 367,
          "h": 275,
          "caption": "Pemotongan pita pembukaan KKN.",
          "captionEn": "Ribbon cutting at the start of the student programme."
        },
        {
          "src": "/kerja-sama-foto/uwp-7.jpg",
          "w": 454,
          "h": 340,
          "caption": "Mahasiswa KKN berdiskusi dengan warga.",
          "captionEn": "Students talking with residents."
        },
        {
          "src": "/kerja-sama-foto/uwp-8.jpg",
          "w": 455,
          "h": 341,
          "caption": "Pelatihan bersama ibu-ibu warga Kendung.",
          "captionEn": "A training session with Kendung women."
        },
        {
          "src": "/kerja-sama-foto/uwp-9.jpg",
          "w": 455,
          "h": 341,
          "caption": "Sosialisasi program KKN kepada warga.",
          "captionEn": "Introducing the student programme to residents."
        },
        {
          "src": "/kerja-sama-foto/uwp-10.jpg",
          "w": 1100,
          "h": 619,
          "caption": "Mahasiswa KKN UWP dan warga di balai RW.",
          "captionEn": "UWP students and residents at the RW hall."
        },
        {
          "src": "/kerja-sama-foto/uwp-11.jpg",
          "w": 824,
          "h": 618,
          "caption": "Kegiatan bersama warga di balai RW.",
          "captionEn": "An activity with residents at the RW hall."
        },
        {
          "src": "/kerja-sama-foto/uwp-12.jpg",
          "w": 273,
          "h": 365,
          "caption": "Kegiatan malam bersama warga di lapangan.",
          "captionEn": "An evening activity with residents on the field."
        },
        {
          "src": "/kerja-sama-foto/uwp-13.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Mahasiswa dan warga Kendung, Juli 2022.",
          "captionEn": "Students and Kendung residents, July 2022."
        }
      ]
    },
    {
      "years": "2022",
      "name": "Universitas Trunojoyo Madura",
      "nameEn": "Universitas Trunojoyo Madura",
      "body": "Mahasiswa KKN ikut membangun kampung.",
      "bodyEn": "Its community-service students helped build up the village.",
      "photos": [
        {
          "src": "/kerja-sama-foto/utm-1.jpg",
          "w": 681,
          "h": 383,
          "caption": "Mahasiswa KKN membuat kerajinan bersama warga.",
          "captionEn": "Students making crafts with residents."
        },
        {
          "src": "/kerja-sama-foto/utm-2.jpg",
          "w": 685,
          "h": 385,
          "caption": "Mengecat kerajinan dari barang bekas.",
          "captionEn": "Painting crafts made from recycled items."
        },
        {
          "src": "/kerja-sama-foto/utm-3.jpg",
          "w": 1100,
          "h": 825,
          "caption": "Mahasiswa KKN bekerja bersama di rumah warga.",
          "captionEn": "Students working together at a resident's home."
        }
      ]
    },
    {
      "addedLater": "bank-jatim",
      "years": "",
      "name": "Bank Jatim",
      "nameEn": "Bank Jatim",
      "body": "Warga Kampoeng Semanggi ikut bazar dan pameran UKM dari Bank Jatim untuk memperkenalkan dan menjual olahan semanggi buatan mereka.",
      "bodyEn": "Kampoeng Semanggi residents took part in Bank Jatim's small-business bazaar and exhibition to show and sell their semanggi products.",
      "photos": [
        {
          "src": "/kerja-sama-foto/bank-jatim-1.jpg",
          "w": 519,
          "h": 692,
          "caption": "Olahan semanggi warga di stan bazar UKM Bank Jatim.",
          "captionEn": "Residents' semanggi products at the Bank Jatim small-business bazaar."
        },
        {
          "src": "/kerja-sama-foto/bank-jatim-2.jpg",
          "w": 373,
          "h": 497,
          "caption": "Warga Kampoeng Semanggi di stan mereka.",
          "captionEn": "Kampoeng Semanggi residents at their stand."
        },
        {
          "src": "/kerja-sama-foto/bank-jatim-3.jpg",
          "w": 802,
          "h": 601,
          "caption": "Deretan stan bazar dan pameran UKM Bank Jatim.",
          "captionEn": "The row of stands at the Bank Jatim bazaar and exhibition."
        }
      ]
    }
  ],
  "texts": {
    "peopleIntro": {
      "id": "Kampoeng Semanggi adalah warga RW 03 Kendung, Kelurahan Sememi. Lebih dari 120 perajin, perempuan maupun laki-laki, masih membuat pecel semanggi dan olahannya, meneruskan resep yang diwariskan sejak tahun 1960-an.\n\nSebagian berangkat sejak dini hari untuk berjualan di penjuru Surabaya. Yang lain melayani pembeli dari toko atau langsung dari rumah.",
      "en": "Kampoeng Semanggi is the people of RW 03 Kendung, Sememi. More than 120 makers, women and men alike, still make pecel semanggi and other semanggi foods, carrying on recipes handed down since the 1960s.\n\nSome set off before dawn to sell across Surabaya. Others serve buyers from their stall or straight from home."
    },
    "collabIntro": {
      "id": "Kampoeng Semanggi tumbuh berkat dukungan pemerintah, perusahaan, dan kampus. Terima kasih kepada semua mitra kami.",
      "en": "Kampoeng Semanggi has grown with support from the government, companies and universities. Thank you to all our partners."
    },
    "sponsorText": {
      "id": "Ingin mendukung pedagang semanggi dan kegiatan warga Kendung? Kami terbuka untuk sponsor acara, kemitraan usaha, dan program CSR.",
      "en": "Want to support Kendung's semanggi sellers and village activities? We welcome event sponsors, business partners and CSR programmes."
    }
  }
};
