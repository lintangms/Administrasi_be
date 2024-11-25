const connection = require('../models/database');
exports.addTransaksi = (req, res) => {
  const { akun_steam, akun_gmail, shift, jumlah_awal_koin, keterangan, jenis } = req.body;
  const { id_karyawan } = req.params;

  if (!["masuk", "pulang"].includes(keterangan)) {
    return res.status(400).json({ error: 'Keterangan harus berupa "masuk" atau "pulang"' });
  }

  if (!["LA", "TNL"].includes(jenis)) {
    return res.status(400).json({ error: 'Jenis harus berupa "LA" atau "TNL"' });
  }

  if (!id_karyawan || isNaN(id_karyawan)) {
    return res.status(400).json({ error: 'ID karyawan harus disediakan dan berupa angka' });
  }

  const insertTransaksiQuery = 
    `INSERT INTO transaksi (akun_steam, akun_gmail, shift, id_karyawan, keterangan, id_koin, jenis)
     VALUES (?, ?, ?, ?, ?, ?, ?)`;

  const insertKoinQuery = 
    `INSERT INTO koin (id_karyawan, jumlah_awal, jumlah_sisa)
     VALUES (?, ?, ?)`;

  connection.query(
    insertKoinQuery, 
    [id_karyawan, jumlah_awal_koin, jumlah_awal_koin], 
    (err, koinResult) => {
      if (err) {
        console.error('Error inserting koin: ', err);
        return res.status(500).json({ error: 'Error inserting koin' });
      }

      const id_koin = koinResult.insertId;

      connection.query(
        insertTransaksiQuery, 
        [akun_steam, akun_gmail, shift, id_karyawan, keterangan, id_koin, jenis], 
        (err, transaksiResult) => {
          if (err) {
            console.error('Error inserting transaksi: ', err);
            return res.status(500).json({ error: 'Error inserting transaksi' });
          }

          return res.json({
            success: true,
            message: 'Transaksi berhasil ditambahkan',
            data: { 
              akun_steam, 
              akun_gmail, 
              shift, 
              jumlah_awal_koin, 
              jumlah_sisa: jumlah_awal_koin,
              keterangan,
              jenis,
              id_karyawan: parseInt(id_karyawan)
            }
          });
        }
      );
    }
  );
};



exports.getAllTransaksi = (req, res) => {
  const getAllTransaksiQuery = `
    SELECT 
      transaksi.id_transaksi,
      transaksi.id_karyawan,
      transaksi.id_koin,
      karyawan.nama,
      koin.jumlah_awal,
      koin.jumlah_dijual,
      koin.jumlah_sisa,
      transaksi.akun_steam,
      transaksi.jenis,
      transaksi.shift,
      transaksi.keterangan,
      transaksi.waktu
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin`;

  connection.query(getAllTransaksiQuery, (err, result) => {
    if (err) {
      console.error('Error fetching transaksi: ', err);
      return res.status(500).json({ error: 'Error fetching transaksi' });
    }

    console.log(result); // Debugging untuk memastikan hasil query benar

    if (result.length === 0) {
      return res.status(404).json({ message: 'No transaksi found' });
    }

    return res.json({
      success: true,
      data: result
    });
  });
};

exports.sellKoin = (req, res) => {
  const { id_koin } = req.params; // ID koin yang akan diupdate
  const { jumlah_dijual } = req.body; // Jumlah koin yang dijual

  // Validasi jumlah dijual
  if (!jumlah_dijual || jumlah_dijual <= 0) {
    return res.status(400).json({ error: 'Jumlah dijual harus lebih dari 0' });
  }

  // Ambil data koin untuk validasi jumlah_sisa
  const getKoinQuery = `SELECT jumlah_sisa FROM koin WHERE id_koin = ?`;

  connection.query(getKoinQuery, [id_koin], (err, result) => {
    if (err) {
      console.error('Error fetching koin: ', err);
      return res.status(500).json({ error: 'Error fetching koin' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Data koin tidak ditemukan' });
    }

    const { jumlah_sisa } = result[0];

    // Pastikan jumlah dijual tidak melebihi jumlah sisa
    if (jumlah_dijual > jumlah_sisa) {
      return res.status(400).json({ error: 'Jumlah dijual melebihi jumlah sisa' });
    }

    // Update jumlah_dijual dan jumlah_sisa
    const updateKoinQuery = `
      UPDATE koin
      SET jumlah_dijual = jumlah_dijual + ?, 
          jumlah_sisa = jumlah_sisa - ?
      WHERE id_koin = ?`;

    connection.query(updateKoinQuery, [jumlah_dijual, jumlah_dijual, id_koin], (err, updateResult) => {
      if (err) {
        console.error('Error updating koin: ', err);
        return res.status(500).json({ error: 'Error updating koin' });
      }

      return res.json({
        success: true,
        message: 'Koin berhasil dijual',
        data: { id_koin, jumlah_dijual, jumlah_sisa: jumlah_sisa - jumlah_dijual }
      });
    });
  });
};
// controllers/transaksiController.js

exports.handleTransaksi = (req, res) => {
  const { id_karyawan } = req.params; // Mengambil id_karyawan dari URL parameter
  const { action, id_koin, jumlah_dijual } = req.body; // Aksi tambahan untuk menjual koin

  // Query untuk menampilkan data transaksi
  const getTransaksiQuery = `
    SELECT 
      transaksi.id_transaksi,
      transaksi.id_karyawan,
      transaksi.akun_steam,
      transaksi.akun_gmail,
      transaksi.shift,
      transaksi.keterangan,
      transaksi.jenis,
      koin.id_koin,
      koin.jumlah_awal,
      koin.jumlah_dijual,
      koin.jumlah_sisa
    FROM transaksi
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    WHERE transaksi.id_karyawan = ?`;

  // Jika tidak ada aksi tambahan, hanya tampilkan data
  if (!action) {
    connection.query(getTransaksiQuery, [id_karyawan], (err, results) => {
      if (err) {
        console.error('Error executing query:', err.message);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data transaksi' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Tidak ada transaksi ditemukan untuk ID karyawan ini' });
      }

      return res.json({ success: true, data: results });
    });
  } else if (action === 'sell') {
    // Jika aksi adalah 'sell', lakukan update pada jumlah_dijual dan jumlah_sisa
    const sellKoinQuery = `
      UPDATE koin
      SET 
        jumlah_dijual = jumlah_dijual + ?,
        jumlah_sisa = jumlah_sisa - ?
      WHERE id_koin = ?`;

    connection.query(sellKoinQuery, [jumlah_dijual, jumlah_dijual, id_koin], (err, result) => {
      if (err) {
        console.error('Error selling koin:', err.message);
        return res.status(500).json({ error: 'Gagal menjual koin' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Koin tidak ditemukan atau tidak dapat dijual' });
      }

      return res.json({ success: true, message: 'Koin berhasil dijual' });
    });
  } else {
    return res.status(400).json({ error: 'Aksi tidak valid' });
  }
};


exports.getKoinStatistik = (req, res) => {
  const statistikQuery = `
    SELECT 
      karyawan.nama,
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) AS tnl_koin,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END) AS la_koin
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    GROUP BY karyawan.nama
    ORDER BY karyawan.nama ASC
  `;

  connection.query(statistikQuery, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan' });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
};
exports.getFilteredTransaksi = (req, res) => {
  const { nama, jenis, tanggal } = req.query;

  // Base query
  let query = `
    SELECT 
      transaksi.id_transaksi,
      transaksi.id_karyawan,
      transaksi.id_koin,
      karyawan.nama,
      koin.jumlah_awal,
      koin.jumlah_dijual,
      koin.jumlah_sisa,
      transaksi.akun_steam,
      transaksi.akun_gmail,
      transaksi.jenis,
      transaksi.shift,
      transaksi.keterangan,
      transaksi.waktu
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    WHERE 1=1
  `;

  // Menambahkan filter opsional
  const filters = [];
  if (nama) {
    query += ` AND karyawan.nama LIKE ?`;
    filters.push(`%${nama}%`);
  }
  if (jenis) {
    query += ` AND transaksi.jenis = ?`;
    filters.push(jenis);
  }
  if (tanggal) {
    query += ` AND DATE(transaksi.waktu) = ?`;
    filters.push(tanggal);
  }

  // Eksekusi query dengan filter
  connection.query(query, filters, (err, results) => {
    if (err) {
      console.error('Error filtering transaksi: ', err);
      return res.status(500).json({ error: 'Error filtering transaksi' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada transaksi ditemukan dengan filter yang diberikan' });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
};
exports.getgaji = (req, res) => {
  const { harga_rata_rata } = req.query; // Harga rata-rata koin diinputkan melalui query parameter

  if (!harga_rata_rata || isNaN(harga_rata_rata)) {
    return res.status(400).json({ error: 'Harga rata-rata koin harus diinputkan dan valid' });
  }

  const statistikQuery = `
    SELECT 
      karyawan.nama,
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) AS tnl_koin,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END) AS la_koin,
      SUM(koin.jumlah_dijual) * ${harga_rata_rata} * 0.5 AS pendapatan_koin
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    GROUP BY karyawan.nama
    ORDER BY karyawan.nama ASC
  `;

  connection.query(statistikQuery, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan' });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
};
