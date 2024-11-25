// controllers/koinController.js
const connection = require('../models/database');

exports.sellKoin = (req, res) => {
  const { id_karyawan, jumlah_dijual } = req.body;

  if (!id_karyawan || !jumlah_dijual) {
    return res.status(400).json({ error: 'id_karyawan and jumlah_dijual are required' });
  }

  const getKoinQuery = 'SELECT jumlah_awal, jumlah_sisa FROM koin WHERE id_karyawan = ?';
  connection.query(getKoinQuery, [id_karyawan], (err, result) => {
    if (err) {
      console.error('Error fetching koin: ', err);
      return res.status(500).json({ error: 'Error fetching koin' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Koin not found for this user' });
    }

    const koin = result[0];

    if (jumlah_dijual > koin.jumlah_sisa) {
      return res.status(400).json({ error: 'Insufficient coins to sell' });
    }

    const updateKoinQuery = `
      UPDATE koin
      SET jumlah_dijual = jumlah_dijual + ?, jumlah_sisa = jumlah_sisa - ?
      WHERE id_karyawan = ?`;
    connection.query(updateKoinQuery, [jumlah_dijual, jumlah_dijual, id_karyawan], (err, result) => {
      if (err) {
        console.error('Error updating koin: ', err);
        return res.status(500).json({ error: 'Error updating koin' });
      }

      return res.json({
        success: true,
        message: 'Koin berhasil dijual',
        data: {
          id_karyawan,
          jumlah_dijual,
          jumlah_sisa: koin.jumlah_sisa - jumlah_dijual
        }
      });
    });
  });
};

exports.getKoin = (req, res) => {
  const { id_karyawan } = req.params;  // Ambil id_karyawan dari URL parameter

  if (!id_karyawan) {
    return res.status(400).json({ error: 'id_karyawan is required' });
  }

  const getKoinQuery = 'SELECT jumlah_awal, jumlah_dijual, jumlah_sisa FROM koin WHERE id_karyawan = ?';
  connection.query(getKoinQuery, [id_karyawan], (err, result) => {
    if (err) {
      console.error('Error fetching koin: ', err);
      return res.status(500).json({ error: 'Error fetching koin' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Koin not found for this user' });
    }

    return res.json({
      success: true,
      data: result[0]  // Kirimkan data koin yang ditemukan
    });
  });
};
exports.getTotalKoinByIdKaryawan = (req, res) => {
  const { id_karyawan } = req.params;  // Mendapatkan id_karyawan dari URL parameter

  // Query untuk menghitung jumlah_awal, jumlah_dijual, dan jumlah_sisa berdasarkan id_karyawan
  const query = `
    SELECT 
      SUM(jumlah_awal) AS total_jumlah_awal,
      SUM(jumlah_dijual) AS total_jumlah_dijual,
      SUM(jumlah_sisa) AS total_jumlah_sisa
    FROM koin  -- Ganti dengan nama tabel yang sesuai
    WHERE id_karyawan = ?`;

  connection.query(query, [id_karyawan], (err, results) => {
    if (err) {
      console.error('Error querying database: ', err);
      return res.status(500).json({ error: 'Error querying database' });
    }

    if (results.length > 0) {
      return res.json({
        success: true,
        total_jumlah_awal: results[0].total_jumlah_awal,
        total_jumlah_dijual: results[0].total_jumlah_dijual,
        total_jumlah_sisa: results[0].total_jumlah_sisa
      });
    } else {
      return res.status(404).json({ success: false, message: 'No koin found for this karyawan' });
    }
  });
};
