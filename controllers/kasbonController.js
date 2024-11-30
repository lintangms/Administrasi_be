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
  const { nama, cicilan, tanggal, limit = 10, page = 1 } = req.query;

  // Perhitungan OFFSET dan penanganan "all" untuk limit
  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

  // Membuat query dasar tanpa ORDER BY
  let query = 'SELECT * FROM kasbon WHERE 1=1'; 
  const queryParams = [];

  // Menambahkan filter berdasarkan nama
  if (nama) {
    query += ' AND nama LIKE ?';
    queryParams.push(`%${nama}%`);
  }

  // Menambahkan filter berdasarkan cicilan
  if (cicilan) {
    query += ' AND cicilan = ?';
    queryParams.push(cicilan);
  }

  // Menambahkan filter berdasarkan tanggal
  if (tanggal) {
    query += ' AND tanggal = ?';
    queryParams.push(tanggal);
  }

  // Tambahkan ORDER BY setelah semua kondisi WHERE
  query += ' ORDER BY id_kasbon DESC';

  // Tambahkan LIMIT dan OFFSET jika limit tidak "all"
  if (!isAll) {
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(Number(limit), Number(offset));
  }

  // Eksekusi query untuk mendapatkan data kasbon
  connection.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error querying kasbon data: ', err);
      return res.status(500).json({ error: 'Gagal mendapatkan kasbon' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data kasbon' });
    }

    // Query untuk menghitung total data
    let countQuery = 'SELECT COUNT(*) as total FROM kasbon WHERE 1=1';
    const countFilters = [];

    if (nama) {
      countQuery += ' AND nama LIKE ?';
      countFilters.push(`%${nama}%`);
    }
    if (cicilan) {
      countQuery += ' AND cicilan = ?';
      countFilters.push(cicilan);
    }
    if (tanggal) {
      countQuery += ' AND tanggal = ?';
      countFilters.push(tanggal);
    }

    // Eksekusi query untuk menghitung jumlah total
    connection.query(countQuery, countFilters, (err, countResults) => {
      if (err) {
        console.error('Error counting kasbon data: ', err);
        return res.status(500).json({ error: 'Gagal menghitung jumlah kasbon' });
      }

      return res.json({
        success: true,
        kasbons: results,
        total: countResults[0].total,
        page: isAll ? 1 : Number(page),
        limit: isAll ? countResults[0].total : Number(limit),
      });
    });
  });
};

// Fungsi untuk mendapatkan kasbon berdasarkan ID karyawan dengan pagination
exports.getKasbonByKaryawan = (req, res) => {
  const { id_karyawan } = req.params;
  const { limit = 10, page = 1 } = req.query; // Ambil parameter query dari request

  // Perhitungan OFFSET dan penanganan "all" untuk limit
  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

  // Membuat query dasar
  let query = 'SELECT * FROM kasbon WHERE id_karyawan = ? ORDER BY id_kasbon DESC'; // Sort by id_kasbon in descending order
  const queryParams = [id_karyawan];

  // Tambahkan LIMIT dan OFFSET hanya jika limit tidak "all"
  if (!isAll) {
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(Number(limit), Number(offset));
  }

  // Eksekusi query untuk mendapatkan data kasbon dengan filter dan pagination
  connection.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error querying kasbon by karyawan: ', err);
      return res.status(500).json({ error: 'Gagal mendapatkan kasbon berdasarkan karyawan' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Kasbon tidak ditemukan untuk karyawan ini' });
    }

    // Hitung total data tanpa pagination untuk informasi jumlah halaman
    const countQuery = 'SELECT COUNT(*) as total FROM kasbon WHERE id_karyawan = ?';
    
    connection.query(countQuery, [id_karyawan], (err, countResults) => {
      if (err) {
        console.error('Error counting kasbon data: ', err);
        return res.status(500).json({ error: 'Gagal menghitung jumlah kasbon' });
      }

      return res.json({
        success: true,
        kasbons: results, // Mengembalikan array data kasbon yang difilter
        total: countResults[0].total,
        page: isAll ? 1 : Number(page),
        limit: isAll ? countResults[0].total : Number(limit),
      });
    });
  });
};

// Fungsi untuk mengupdate status kasbon
exports.updateKasbonStatusByIdKasbon = (req, res) => {
  const { status } = req.body;
  const id_kasbon = req.params.id_kasbon; // Ambil id_kasbon dari parameter URL

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
      return res.status(404).json({ message: 'Kasbon tidak ditemukan untuk ID kasbon tersebut' });
    }

    return res.json({
      success: true,
      message: 'Status kasbon berhasil diupdate',
      data: { id_kasbon, status }
    });
  });
};