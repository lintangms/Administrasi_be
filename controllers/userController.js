// controllers/userController.js
const connection = require('../models/database');

exports.getUserByKodeAkun = (req, res) => {
  const { kode_akun } = req.params;

  const query = `
    SELECT karyawan.nama, karyawan.no_telp, karyawan.waktu_login, transaksi.akun_steam, transaksi.akun_gmail, transaksi.shift
    FROM karyawan
    INNER JOIN transaksi ON karyawan.id_karyawan = transaksi.id_transaksi
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
  const { nama, no_telp, kode_akun, status, kategori } = req.body;

  // Validasi input
  if (!nama || !no_telp || !kode_akun || !status || !kategori) {
    return res.status(400).json({ error: 'Nama, nomor telepon, kode akun, status, dan kategori wajib diisi' });
  }

  // Validasi nilai status dan kategori
  const validStatuses = ['calon', 'karyawan'];  // Menambahkan 'karyawan' sebagai status yang valid
  const validCategories = ['baru', 'lama'];     // Tetap mempertahankan kategori 'baru' dan 'lama'

  // Validasi status
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid. Pilihan: calon, karyawan' });
  }

  // Validasi kategori
  if (!validCategories.includes(kategori)) {
    return res.status(400).json({ error: 'Kategori tidak valid. Pilihan: baru, lama' });
  }

  // Query untuk menambahkan data karyawan dengan status dan kategori
  const query = `
    INSERT INTO karyawan (nama, no_telp, kode_akun, status, kategori)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(query, [nama, no_telp, kode_akun, status, kategori], (err, result) => {
    if (err) {
      console.error('Error inserting user into database: ', err);
      return res.status(500).json({ error: 'Error inserting user into database' });
    }

    // Mengembalikan ID pengguna yang baru ditambahkan
    return res.status(201).json({
      success: true,
      message: 'User added successfully',
      userId: result.insertId,
    });
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
