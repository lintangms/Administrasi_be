const connection = require('../models/database'); // Pastikan path koneksi database Anda sudah benar

// Fungsi untuk menambahkan kasbon
exports.addKasbon = (req, res) => {
  const { nominal, keperluan, cicilan } = req.body;
  const { id_karyawan } = req.params; // Mengambil id_karyawan dari URL parameter

  // Validasi input
  if (!id_karyawan || !nominal || !keperluan || !cicilan) {
    return res.status(400).json({ error: 'Semua data harus diisi' });
  }

  // Query untuk menambahkan kasbon dengan status default 'belum_lunas'
  const query = `
    INSERT INTO kasbon (id_karyawan, nama, nominal, keperluan, cicilan, status)
    VALUES (?, (SELECT nama FROM karyawan WHERE id_karyawan = ?), ?, ?, ?, 'belum_lunas')
  `;

  connection.query(query, [id_karyawan, id_karyawan, nominal, keperluan, cicilan], (err, result) => {
    if (err) {
      console.error('Error inserting kasbon data: ', err);
      return res.status(500).json({ error: 'Gagal menambahkan kasbon' });
    }

    return res.json({
      success: true,
      message: 'Kasbon berhasil ditambahkan',
      data: { id_karyawan, nominal, keperluan, cicilan, status: 'belum_lunas' }
    });
  });
};

// Fungsi untuk mengupdate kasbon termasuk status
exports.updateKasbon = (req, res) => {
  const { id_kasbon, nominal, keperluan, cicilan, status } = req.body;

  if (!id_kasbon || !nominal || !keperluan || !cicilan || !status) {
    return res.status(400).json({ error: 'Semua data harus diisi' });
  }

  const query = 'UPDATE kasbon SET nominal = ?, keperluan = ?, cicilan = ?, status = ? WHERE id_kasbon = ?';
  connection.query(query, [nominal, keperluan, cicilan, status, id_kasbon], (err, result) => {
    if (err) {
      console.error('Error updating kasbon: ', err);
      return res.status(500).json({ error: 'Gagal mengupdate kasbon' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Kasbon tidak ditemukan' });
    }

    return res.json({
      success: true,
      message: 'Kasbon berhasil diupdate',
      data: { id_kasbon, nominal, keperluan, cicilan, status }
    });
  });
};

// Fungsi untuk mendapatkan semua kasbon
exports.getAllKasbon = (req, res) => {
  const { nama, cicilan, tanggal } = req.query;

  // Membuat query dasar
  let query = 'SELECT * FROM kasbon WHERE 1=1'; // 1=1 agar bisa menambahkan kondisi lain tanpa mempengaruhi query

  // Menambahkan filter berdasarkan nama
  if (nama) {
    query += ` AND nama LIKE ?`;
  }

  // Menambahkan filter berdasarkan cicilan
  if (cicilan) {
    query += ` AND cicilan = ?`;
  }

  // Menambahkan filter berdasarkan tanggal
  if (tanggal) {
    query += ` AND tanggal = ?`;
  }

  // Menjalankan query dengan parameter yang sesuai
  const queryParams = [];
  if (nama) queryParams.push(`%${nama}%`); // Untuk mencari nama yang mengandung kata kunci
  if (cicilan) queryParams.push(cicilan);
  if (tanggal) queryParams.push(tanggal);

  connection.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error querying kasbon data: ', err);
      return res.status(500).json({ error: 'Gagal mendapatkan kasbon' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data kasbon' });
    }

    return res.json({ data: results });
  });
};

// Fungsi untuk mendapatkan kasbon berdasarkan ID karyawan
exports.getKasbonByKaryawan = (req, res) => {
  const { id_karyawan } = req.params;

  const query = 'SELECT * FROM kasbon WHERE id_karyawan = ?';
  connection.query(query, [id_karyawan], (err, results) => {
    if (err) {
      console.error('Error querying kasbon by karyawan: ', err);
      return res.status(500).json({ error: 'Gagal mendapatkan kasbon berdasarkan karyawan' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Kasbon tidak ditemukan untuk karyawan ini' });
    }

    return res.json({ data: results });
  });
};

// Fungsi untuk mengupdate status kasbon
exports.updateKasbonStatus = (req, res) => {
  const { id_kasbon, status } = req.body;

  if (!id_kasbon || !status) {
    return res.status(400).json({ error: 'ID kasbon dan status harus diisi' });
  }

  const query = 'UPDATE kasbon SET status = ? WHERE id_kasbon = ?';
  connection.query(query, [status, id_kasbon], (err, result) => {
    if (err) {
      console.error('Error updating kasbon status: ', err);
      return res.status(500).json({ error: 'Gagal mengupdate status kasbon' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Kasbon tidak ditemukan' });
    }

    return res.json({
      success: true,
      message: 'Status kasbon berhasil diupdate',
      data: { id_kasbon, status }
    });
  });
};
