// Mendapatkan daftar nama karyawan
const connection = require('../models/database');
exports.getKaryawanList = (req, res) => {
    const query = `SELECT id_karyawan, nama FROM karyawan`;
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching karyawan list: ', err);
        return res.status(500).json({ error: 'Error fetching karyawan list' });
      }
  
      res.json(results);
    });
  };

  exports.sellKoin = (req, res) => {
    const { id_koin } = req.params; // ID koin yang akan diupdate
    const { 
      jumlah_dijual, 
      tanggal, 
      id_karyawan, 
      server, 
      demand, 
      rate, 
      rp 
    } = req.body; // Data tambahan untuk tabel penjualan
  
    // Validasi input dasar
    if (!jumlah_dijual || jumlah_dijual <= 0) {
      return res.status(400).json({ error: 'Jumlah dijual harus lebih dari 0' });
    }
  
    if (!tanggal || !id_karyawan || !server || !demand || !rate || !rp) {
      return res.status(400).json({ error: 'Semua data untuk penjualan harus diisi' });
    }
  
    // Ambil data koin untuk validasi jumlah_sisa
    const getKoinQuery = `SELECT jumlah_sisa, jumlah_awal FROM koin WHERE id_koin = ?`;
  
    connection.query(getKoinQuery, [id_koin], (err, result) => {
      if (err) {
        console.error('Error fetching koin: ', err);
        return res.status(500).json({ error: 'Error fetching koin' });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Data koin tidak ditemukan' });
      }
  
      const { jumlah_sisa, jumlah_awal } = result[0];
  
      // Pastikan jumlah dijual tidak melebihi jumlah sisa
      if (jumlah_dijual > jumlah_sisa) {
        return res.status(400).json({ error: 'Jumlah dijual melebihi jumlah sisa' });
      }
  
      // Mulai transaksi
      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          console.error('Error starting transaction: ', transactionErr);
          return res.status(500).json({ error: 'Error starting transaction' });
        }
  
        // Update jumlah_dijual dan jumlah_sisa di tabel koin
        const updateKoinQuery = `
          UPDATE koin
          SET jumlah_dijual = jumlah_dijual + ?, 
              jumlah_sisa = jumlah_sisa - ?
          WHERE id_koin = ?`;
  
        connection.query(updateKoinQuery, [jumlah_dijual, jumlah_dijual, id_koin], (updateErr) => {
          if (updateErr) {
            console.error('Error updating koin: ', updateErr);
            return connection.rollback(() => {
              res.status(500).json({ error: 'Error updating koin' });
            });
          }
  
          // Insert data ke tabel penjualan
          const insertPenjualanQuery = `
            INSERT INTO penjualan (
              id_koin, tanggal, id_karyawan, server, demand, rate, rp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
          connection.query(insertPenjualanQuery, [id_koin, tanggal, id_karyawan, server, demand, rate, rp], (insertErr) => {
            if (insertErr) {
              console.error('Error inserting penjualan: ', insertErr);
              return connection.rollback(() => {
                res.status(500).json({ error: 'Error inserting penjualan' });
              });
            }
  
            // Commit transaksi
            connection.commit((commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction: ', commitErr);
                return connection.rollback(() => {
                  res.status(500).json({ error: 'Error committing transaction' });
                });
              }
  
              return res.json({
                success: true,
                message: 'Koin berhasil dijual dan data penjualan berhasil dicatat',
                data: {
                  id_koin,
                  jumlah_dijual,
                  jumlah_awal,
                  jumlah_sisa: jumlah_sisa - jumlah_dijual,
                  penjualan: {
                    tanggal,
                    id_karyawan,
                    server,
                    demand,
                    rate,
                    rp
                  }
                }
              });
            });
          });
        });
      });
    });
  };
  
exports.getAllKoinPenjualan = (req, res) => {
    // Query untuk mendapatkan semua data dari tabel koin dan penjualan
    const query = `
      SELECT k.id_koin, k.jumlah_awal, k.jumlah_sisa, k.jumlah_dijual, 
             p.tanggal, p.id_karyawan, p.server, p.demand, p.rate, p.rp
      FROM koin k
      LEFT JOIN penjualan p ON k.id_koin = p.id_koin
    `;
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching koin and penjualan: ', err);
        return res.status(500).json({ error: 'Error fetching koin and penjualan' });
      }
  
      // Mengembalikan data
      res.json(results);
    });
  };