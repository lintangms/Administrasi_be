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
  const { nama, status, kategori } = req.query; // Ambil parameter query dari request

  // Mulai dengan query dasar
  let query = `SELECT nama, no_telp, kode_akun, status, kategori FROM karyawan WHERE 1=1`;

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

  connection.query(query, params, (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    // Jika ada hasil, kirimkan data karyawan
    if (results.length > 0) {
      return res.json({
        success: true,
        users: results, // Mengembalikan array data karyawan yang difilter
      });
    } else {
      return res.status(404).json({ success: false, message: 'No users found' });
    }
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

