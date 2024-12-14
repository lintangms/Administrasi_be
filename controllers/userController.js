// controllers/userController.js
const connection = require('../models/database');

exports.getUserByKodeAkun = (req, res) => {
  const { kode_akun } = req.params;

  const query = `
    SELECT 
      karyawan.nama, 
      karyawan.no_telp, 
      karyawan.waktu_login, 
      akun_karyawan.akun_steam, 
      akun_karyawan.akun_gmail, 
      transaksi.shift
    FROM karyawan
    INNER JOIN transaksi ON karyawan.id_karyawan = transaksi.id_karyawan
    INNER JOIN akun_karyawan ON transaksi.id_akun = akun_karyawan.id_akun
    WHERE karyawan.kode_akun = ?`;

  connection.query(query, [kode_akun], (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    if (results.length > 0) {
      return res.json({
        success: true,
        user: results[0]
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  });
};


exports.getAllUsers = (req, res) => {
  const { nama, status, kategori, limit = 10, page = 1 } = req.query; // Ambil parameter query dari request

  // Perhitungan OFFSET dan penanganan "all" untuk limit
  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

  // Mulai dengan query dasar, pastikan id_karyawan dimasukkan
  let query = `SELECT id_karyawan, nama, no_telp, kode_akun, status, kategori FROM karyawan WHERE 1=1`;

  // Array untuk menyimpan nilai parameter
  const params = [];

  // Tambahkan kondisi untuk filtering jika parameter ada
  if (nama) {
    query += ` AND nama LIKE ?`;
    params.push(`%${nama}%`); // Gunakan wildcard untuk pencarian parsial
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (kategori) {
    query += ` AND kategori = ?`;
    params.push(kategori);
  }

  // Tambahkan urutan berdasarkan 'created_at' (terbaru di atas)
  query += ` ORDER BY created_at DESC`; // Urutkan berdasarkan tanggal pembuatan

  // Tambahkan LIMIT dan OFFSET hanya jika limit tidak "all"
  if (!isAll) {
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
  }

  // Eksekusi query dengan filter
  connection.query(query, params, (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    // Hitung total data tanpa pagination untuk informasi jumlah halaman
    const countQuery = `SELECT COUNT(*) as total FROM karyawan WHERE 1=1`;

    connection.query(countQuery, params.slice(0, -2), (err, countResults) => {
      if (err) {
        console.error('Error counting users: ', err);
        return res.status(500).json({ error: 'Error counting users' });
      }

      return res.json({
        success: true,
        users: results, // Mengembalikan array data karyawan yang difilter, termasuk id_karyawan
        total: countResults[0].total,
        page: isAll ? 1 : Number(page),
        limit: isAll ? countResults[0].total : Number(limit),
      });
    });
  });
};



exports.getUserByIdKaryawan = (req, res) => {
  const { id_karyawan } = req.params;  // Menggunakan id_karyawan sebagai parameter

  const query = `SELECT nama FROM karyawan WHERE id_karyawan = ?`;  // Query disesuaikan dengan id_karyawan

  connection.query(query, [id_karyawan], (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    if (results.length > 0) {
      return res.json({
        success: true,
        nama: results[0].nama  // Mengembalikan nama karyawan berdasarkan id_karyawan
      });
    } else {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
  });
};
exports.addUser = (req, res) => {
  const { nama, no_telp, kode_akun, status, kategori, akun } = req.body; // Tambahkan `akun` di body request

  // Validasi input
  if (!nama || !no_telp || !kode_akun || !status || !kategori) {
    return res.status(400).json({ error: 'Nama, nomor telepon, kode akun, status, dan kategori wajib diisi' });
  }

  const validStatuses = ['calon', 'karyawan'];
  const validCategories = ['baru', 'lama'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid. Pilihan: calon, karyawan' });
  }

  if (!validCategories.includes(kategori)) {
    return res.status(400).json({ error: 'Kategori tidak valid. Pilihan: baru, lama' });
  }

  // Query untuk menambahkan data karyawan
  const query = `
    INSERT INTO karyawan (nama, no_telp, kode_akun, status, kategori)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(query, [nama, no_telp, kode_akun, status, kategori], (err, result) => {
    if (err) {
      console.error('Error inserting user into database: ', err);
      return res.status(500).json({ error: 'Error inserting user into database' });
    }

    const userId = result.insertId; // ID dari karyawan yang baru saja ditambahkan

    // Jika tidak ada akun yang diberikan, hanya tambahkan user
    if (!akun || akun.length === 0) {
      return res.status(201).json({
        success: true,
        message: 'User added successfully',
        userId,
      });
    }

    // Tambahkan akun ke tabel akun_karyawan
    const akunValues = akun.map((item) => [userId, item.akun, item.jenis_akun]); // Array untuk batch insert
    const akunQuery = `
      INSERT INTO akun_karyawan (id_karyawan, akun, jenis_akun)
      VALUES ?
    `;

    connection.query(akunQuery, [akunValues], (err) => {
      if (err) {
        console.error('Error inserting akun_karyawan into database: ', err);
        return res.status(500).json({ error: 'Error inserting akun_karyawan into database' });
      }

      return res.status(201).json({
        success: true,
        message: 'User and akun_karyawan added successfully',
        userId,
      });
    });
  });
};
// Menambahkan akun ke pengguna (karyawan)
// Controller untuk menambah akun ke pengguna
exports.addAkunToUser = (req, res) => {
  const { nama, akun_steam, akun_gmail, jenis } = req.body; // Ganti id_karyawan dengan nama_karyawan

  // Validasi input
  if (!nama || (!akun_steam && !akun_gmail) || !jenis) {
    return res.status(400).json({ error: 'Nama, akun_steam, akun_gmail, dan jenis wajib diisi' });
  }

  // Query untuk memeriksa apakah nama karyawan valid dan mendapatkan id_karyawan
  const checkKaryawanQuery = `
    SELECT id_karyawan, nama 
    FROM karyawan 
    WHERE nama = ?
  `;

  connection.query(checkKaryawanQuery, [nama], (err, results) => {
    if (err) {
      console.error('Error fetching karyawan from database: ', err);
      return res.status(500).json({ error: 'Error fetching karyawan from database' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }

    // Jika karyawan ditemukan, ambil id_karyawan dari hasil query
    const id_karyawan = results[0].id_karyawan;

    // Lanjutkan dengan penambahan akun
    const query = `
      INSERT INTO akun_karyawan (id_karyawan, akun_steam, akun_gmail, jenis)
      VALUES (?, ?, ?, ?)
    `;

    connection.query(query, [id_karyawan, akun_steam, akun_gmail, jenis], (err) => {
      if (err) {
        console.error('Error inserting akun_karyawan into database: ', err);
        return res.status(500).json({ error: 'Error inserting akun_karyawan into database' });
      }

      return res.status(201).json({
        success: true,
        message: 'Akun berhasil ditambahkan ke pengguna',
        karyawan: results[0], // Mengirim data karyawan (id dan nama)
      });
    });
  });
};

// Mengambil akun karyawan
exports.getAkunKaryawan = (req, res) => {
  const query = `
    SELECT 
      karyawan.id_karyawan,
      karyawan.nama AS nama,
      akun_karyawan.id_akun,
      akun_karyawan.akun_steam,
      akun_karyawan.akun_gmail,
      akun_karyawan.jenis
    FROM akun_karyawan
    INNER JOIN karyawan ON akun_karyawan.id_karyawan = karyawan.id_karyawan
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching akun_karyawan from database: ', err);
      return res.status(500).json({ error: 'Error fetching akun_karyawan from database' });
    }

    // Proses data untuk mengelompokkan akun berdasarkan karyawan
    const groupedData = results.reduce((acc, row) => {
      const { id_karyawan, nama, id_akun, akun_steam, akun_gmail, jenis } = row;

      if (!acc[id_karyawan]) {
        acc[id_karyawan] = { nama, akun: [] };
      }

      acc[id_karyawan].akun.push({
        id_akun,
        akun_steam: akun_steam || 'Tidak ada',
        akun_gmail: akun_gmail || 'Tidak ada',
        jenis: jenis || 'Tidak ditentukan',
      });

      return acc;
    }, {});

    // Ubah hasil ke dalam bentuk array
    const resultArray = Object.values(groupedData);

    return res.status(200).json({
      success: true,
      data: resultArray,
    });
  });
};

// Mengambil data karyawan untuk dropdown
exports.getKaryawanOptions = (req, res) => {
  const query = `
    SELECT id_karyawan, nama FROM karyawan
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching karyawan from database: ', err);
      return res.status(500).json({ error: 'Error fetching karyawan from database' });
    }

    return res.status(200).json(results);
  });
};


exports.updateUser = (req, res) => {
  const idKaryawan = req.params.id_karyawan; // Tangkap ID dari parameter URL
  const { nama, no_telp, kode_akun, status, kategori } = req.body;

  // Validasi input
  if (!nama || !no_telp || !kode_akun || !status || !kategori) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  const validStatuses = ['calon', 'karyawan'];
  const validCategories = ['baru', 'lama'];

  if (!validStatuses.includes(status) || !validCategories.includes(kategori)) {
    return res.status(400).json({ error: 'Status atau kategori tidak valid' });
  }

  const query = `
    UPDATE karyawan
    SET nama = ?, no_telp = ?, kode_akun = ?, status = ?, kategori = ?
    WHERE id_karyawan = ?
  `;

  connection.query(
    query,
    [nama, no_telp, kode_akun, status, kategori, idKaryawan],
    (err, result) => {
      if (err) {
        console.error('Error updating user: ', err);
        return res.status(500).json({ error: 'Gagal mengupdate user' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
      }

      res.status(200).json({ success: true, message: 'User updated successfully' });
    }
  );
};
exports.deleteUser = (req, res) => {
  const { id_karyawan } = req.params; // ID karyawan yang akan dihapus

  // Validasi input
  if (!id_karyawan) {
    return res.status(400).json({ error: 'ID karyawan wajib diisi' });
  }

  // Query untuk menghapus data terkait transaksi terlebih dahulu
  const deleteTransaksiQuery = `
    DELETE FROM transaksi
    WHERE id_karyawan = ?
  `;

  connection.query(deleteTransaksiQuery, [id_karyawan], (err, result) => {
    if (err) {
      console.error('Error deleting related transaksi: ', err);
      return res.status(500).json({ error: 'Error deleting related transaksi' });
    }

    // Setelah transaksi dihapus, lanjutkan menghapus karyawan
    const query = `
      DELETE FROM karyawan
      WHERE id_karyawan = ?
    `;

    connection.query(query, [id_karyawan], (err, result) => {
      if (err) {
        console.error('Error deleting user from database: ', err);
        return res.status(500).json({ error: 'Error deleting user from database' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
      }

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    });
  });
};
