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
    const { id_koin } = req.params; // ID koin yang akan dijual
    const { jumlah_dijual, tanggal, server, demand, rate } = req.body; // Data yang dimasukkan oleh user
  
    // Validasi input dasar
    if (!jumlah_dijual || jumlah_dijual <= 0) {
      return res.status(400).json({ error: 'Jumlah dijual harus lebih dari 0' });
    }
  
    if (!tanggal || !server || !demand || !rate) {
      return res.status(400).json({ error: 'Semua data untuk penjualan harus diisi' });
    }
  
    // Ambil data koin untuk validasi jumlah_sisa dan id_karyawan
    const getKoinQuery = `SELECT jumlah_sisa, id_karyawan FROM koin WHERE id_koin = ?`;
  
    connection.query(getKoinQuery, [id_koin], (err, result) => {
      if (err) {
        console.error('Error fetching koin: ', err);
        return res.status(500).json({ error: 'Error fetching koin' });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Data koin tidak ditemukan' });
      }
  
      const { jumlah_sisa, id_karyawan } = result[0];
  
      // Pastikan jumlah dijual tidak melebihi jumlah sisa
      if (jumlah_dijual > jumlah_sisa) {
        return res.status(400).json({ error: 'Jumlah dijual melebihi jumlah sisa' });
      }
  
      // Ambil nama karyawan berdasarkan id_karyawan
      const getKaryawanQuery = `SELECT nama FROM karyawan WHERE id_karyawan = ?`;
  
      connection.query(getKaryawanQuery, [id_karyawan], (karyawanErr, karyawanResult) => {
        if (karyawanErr) {
          console.error('Error fetching karyawan: ', karyawanErr);
          return res.status(500).json({ error: 'Error fetching karyawan' });
        }
  
        if (karyawanResult.length === 0) {
          return res.status(404).json({ error: 'Data karyawan tidak ditemukan' });
        }
  
        const { nama } = karyawanResult[0];
  
        // Hitung rp (rate * jumlah_dijual)
        const rp = rate * jumlah_dijual;
  
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
  
            // Insert data ke tabel penjualan (termasuk kolom "dijual")
            const insertPenjualanQuery = `
              INSERT INTO penjualan (
                id_koin, tanggal, id_karyawan, server, demand, rate, rp, dijual
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
            connection.query(insertPenjualanQuery, [id_koin, tanggal, id_karyawan, server, demand, rate, rp, jumlah_dijual], (insertErr) => {
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
                    jumlah_sisa: jumlah_sisa - jumlah_dijual,
                    penjualan: {
                      tanggal,
                      id_karyawan,
                      nama_karyawan: nama, // Menambahkan nama karyawan
                      server,
                      demand,
                      rate,
                      rp,
                      dijual: jumlah_dijual // Menambahkan nilai dijual
                    }
                  }
                });
              });
            });
          });
        });
      });
    });
  };
  
  exports.getAllKoinPenjualan = (req, res) => {
    const { limit = 10, page = 1, bulan, tahun, nama } = req.query;
  
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);
  
    let baseQuery = `
      FROM penjualan p
      LEFT JOIN koin k ON p.id_koin = k.id_koin
      LEFT JOIN karyawan ka ON p.id_karyawan = ka.id_karyawan
      WHERE p.id_koin IS NOT NULL AND (p.id_unsold IS NULL OR p.id_unsold = 0)
    `;
  
    const filters = [];
    const queryParams = [];
  
    if (bulan) {
      filters.push(`MONTH(p.tanggal) = ?`);
      queryParams.push(Number(bulan));
    }
    if (tahun) {
      filters.push(`YEAR(p.tanggal) = ?`);
      queryParams.push(Number(tahun));
    }
    if (nama) {
      filters.push(`ka.nama LIKE ?`);
      queryParams.push(`%${nama}%`);
    }
  
    if (filters.length > 0) {
      baseQuery += ` AND ` + filters.join(' AND ');
    }
  
    const dataQuery = `
      SELECT p.id_penjualan, p.id_koin, 
             DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, 
             p.id_karyawan, p.server, 
             p.demand, p.rate, p.rp, 
             p.dijual, 
             k.jumlah_dijual, 
             k.jumlah_sisa, 
             k.jumlah_awal, 
             ka.nama AS karyawan_nama
      ${baseQuery}
      ORDER BY p.tanggal DESC
    `;
  
    const paginatedQuery = isAll ? dataQuery : `${dataQuery} LIMIT ? OFFSET ?`;
    const paginationParams = isAll ? [] : [Number(limit), Number(offset)];
  
    const totalQuery = `
      SELECT COUNT(*) AS total
      ${baseQuery}
    `;
  
    const totalRpQuery = `
    SELECT SUM(p.rp) AS total_rp, ROUND(AVG(p.rate)) AS rata_rate
    ${baseQuery}
  `;
  
  
    const totalJumlahDijualQuery = `
      SELECT SUM(p.dijual) AS total_dijual
      ${baseQuery}
    `;
  
    connection.query(paginatedQuery, [...queryParams, ...paginationParams], (err, results) => {
      if (err) {
        console.error('Error fetching koin penjualan: ', err);
        return res.status(500).json({ error: 'Error fetching koin penjualan' });
      }
  
      connection.query(totalQuery, queryParams, (err, countResults) => {
        if (err) {
          console.error('Error counting koin penjualan: ', err);
          return res.status(500).json({ error: 'Error counting koin penjualan' });
        }
  
        connection.query(totalRpQuery, queryParams, (err, totalRpResults) => {
          if (err) {
            console.error('Error fetching total RP penjualan: ', err);
            return res.status(500).json({ error: 'Error fetching total RP penjualan' });
          }
  
          connection.query(totalJumlahDijualQuery, queryParams, (err, totalJumlahDijualResults) => {
            if (err) {
              console.error('Error fetching total jumlah_dijual: ', err);
              return res.status(500).json({ error: 'Error fetching total jumlah_dijual' });
            }
  
            return res.json({
              success: true,
              data: results,
              total: countResults[0].total,
              page: isAll ? 1 : Number(page),
              limit: isAll ? countResults[0].total : Number(limit),
              total_rp: totalRpResults[0].total_rp || 0,
              rata_rate: totalRpResults[0].rata_rate || 0,
              total_dijual: totalJumlahDijualResults[0].total_dijual || 0,
            });
          });
        });
      });
    });
  };
  
  exports.getAllUnsoldPenjualan = (req, res) => {
    const { limit = 10, page = 1, bulan, tahun, nama } = req.query;
  
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);
  
    let baseQuery = `
      FROM penjualan p
      LEFT JOIN unsold u ON p.id_unsold = u.id_unsold
      LEFT JOIN karyawan ka ON p.id_karyawan = ka.id_karyawan
      WHERE p.id_unsold IS NOT NULL AND (p.id_koin IS NULL OR p.id_koin = 0)
    `;
  
    const filters = [];
    const queryParams = [];
  
    if (bulan) {
      filters.push(`MONTH(p.tanggal) = ?`);
      queryParams.push(Number(bulan));
    }
    if (tahun) {
      filters.push(`YEAR(p.tanggal) = ?`);
      queryParams.push(Number(tahun));
    }
    if (nama) {
      filters.push(`ka.nama LIKE ?`);
      queryParams.push(`%${nama}%`);
    }
  
    if (filters.length > 0) {
      baseQuery += ` AND ` + filters.join(' AND ');
    }
  
    const dataQuery = `
      SELECT p.id_penjualan, p.id_unsold, 
             DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, 
             p.id_karyawan, p.server, 
             p.demand, p.rate, p.rp, 
             p.dijual, 
             u.jumlah_dijual, 
             u.jumlah_sisa, 
             u.jumlah_awal, 
             ka.nama AS karyawan_nama
      ${baseQuery}
      ORDER BY p.tanggal DESC
    `;
  
    const paginatedQuery = isAll ? dataQuery : `${dataQuery} LIMIT ? OFFSET ?`;
    const paginationParams = isAll ? [] : [Number(limit), Number(offset)];
  
    const totalQuery = `
      SELECT COUNT(*) AS total
      ${baseQuery}
    `;
  
    const totalHargaQuery = `
    SELECT SUM(u.total_harga) AS total_harga, ROUND(AVG(p.rate)) AS rata_rate
    ${baseQuery}
 ` ;
  
  
    const totalJumlahDijualUnsoldQuery = `
      SELECT SUM(u.jumlah_dijual) AS total_jumlah_dijual
      ${baseQuery}
    `;
  
    connection.query(paginatedQuery, [...queryParams, ...paginationParams], (err, results) => {
      if (err) {
        console.error('Error fetching unsold penjualan: ', err);
        return res.status(500).json({ error: 'Error fetching unsold penjualan' });
      }
  
      connection.query(totalQuery, queryParams, (err, countResults) => {
        if (err) {
          console.error('Error counting unsold penjualan: ', err);
          return res.status(500).json({ error: 'Error counting unsold penjualan' });
        }
  
        connection.query(totalHargaQuery, queryParams, (err, totalHargaResults) => {
          if (err) {
            console.error('Error fetching total harga unsold: ', err);
            return res.status(500).json({ error: 'Error fetching total harga unsold' });
          }
  
          connection.query(totalJumlahDijualUnsoldQuery, queryParams, (err, totalJumlahDijualUnsoldResults) => {
            if (err) {
              console.error('Error fetching total jumlah_dijual unsold: ', err);
              return res.status(500).json({ error: 'Error fetching total jumlah_dijual unsold' });
            }
  
            return res.json({
              success: true,
              data: results,
              total: countResults[0].total,
              page: isAll ? 1 : Number(page),
              limit: isAll ? countResults[0].total : Number(limit),
              total_harga: totalHargaResults[0].total_harga || 0,
              rata_rate: totalHargaResults[0].rata_rate || 0,
              total_jumlah_dijual: totalJumlahDijualUnsoldResults[0].total_jumlah_dijual || 0,
            });
          });
        });
      });
    });
  };
  

  exports.sellUnsold = (req, res) => {
    const { id_unsold } = req.params; // ID unsold yang akan diproses
    const { jumlah_dijual, tanggal, server, demand, rate } = req.body; // Data input dari user
  
    // Validasi input
    if (!jumlah_dijual || jumlah_dijual <= 0) {
        return res.status(400).json({ error: 'Jumlah dijual harus lebih dari 0' });
    }
  
    if (!tanggal || !server || !demand || !rate) {
        return res.status(400).json({ error: 'Semua data penjualan harus diisi' });
    }
  
    // Ambil data unsold berdasarkan id_unsold
    const getUnsoldQuery = `SELECT jumlah_sisa, id_karyawan FROM unsold WHERE id_unsold = ?`;
  
    connection.query(getUnsoldQuery, [id_unsold], (err, result) => {
        if (err) {
            console.error('Error fetching unsold data: ', err);
            return res.status(500).json({ error: 'Error fetching unsold data' });
        }
  
        if (result.length === 0) {
            return res.status(404).json({ error: 'Data unsold tidak ditemukan' });
        }
  
        const { jumlah_sisa, id_karyawan } = result[0];
  
        // Validasi jumlah dijual
        if (jumlah_dijual > jumlah_sisa) {
            return res.status(400).json({ error: 'Jumlah dijual melebihi jumlah sisa' });
        }
  
        // Ambil nama karyawan
        const getKaryawanQuery = `SELECT nama FROM karyawan WHERE id_karyawan = ?`;
  
        connection.query(getKaryawanQuery, [id_karyawan], (karyawanErr, karyawanResult) => {
            if (karyawanErr) {
                console.error('Error fetching karyawan: ', karyawanErr);
                return res.status(500).json({ error: 'Error fetching karyawan' });
            }
  
            if (karyawanResult.length === 0) {
                return res.status(404).json({ error: 'Data karyawan tidak ditemukan' });
            }
  
            const { nama } = karyawanResult[0];
            const rp = rate * jumlah_dijual; // Hitung nilai rupiah
  
            // Mulai transaksi
            connection.beginTransaction((transactionErr) => {
                if (transactionErr) {
                    console.error('Error starting transaction: ', transactionErr);
                    return res.status(500).json({ error: 'Error starting transaction' });
                }
  
                // Update tabel unsold
                const updateUnsoldQuery = `
                    UPDATE unsold
                    SET jumlah_dijual = jumlah_dijual + ?, 
                        jumlah_sisa = jumlah_sisa - ?
                    WHERE id_unsold = ?;
                `;
  
                connection.query(updateUnsoldQuery, [jumlah_dijual, jumlah_dijual, id_unsold], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating unsold: ', updateErr);
                        return connection.rollback(() => {
                            res.status(500).json({ error: 'Error updating unsold' });
                        });
                    }
  
                    // Insert ke tabel penjualan dengan kolom dijual
                    const insertPenjualanQuery = `
                        INSERT INTO penjualan (
                            id_unsold, tanggal, id_karyawan, server, demand, rate, rp, dijual
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    `;
  
                    connection.query(insertPenjualanQuery, [id_unsold, tanggal, id_karyawan, server, demand, rate, rp, jumlah_dijual], (insertErr) => {
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
                                message: 'Data unsold berhasil dijual dan dicatat dalam penjualan',
                                data: {
                                    id_unsold,
                                    jumlah_dijual,
                                    jumlah_sisa: jumlah_sisa - jumlah_dijual,
                                    penjualan: {
                                        tanggal,
                                        id_karyawan,
                                        nama_karyawan: nama,
                                        server,
                                        demand,
                                        rate,
                                        rp,
                                        dijual: jumlah_dijual // Menambahkan kolom dijual
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });
    });
  };
  