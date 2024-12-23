const connection = require('../models/database');

exports.getKaryawanGajiDetails = (req, res) => {
    const { bulan, tahun, nama, limit = 10, page = 1, persentase = 50, id_karyawan, bayar_emak, kasbon } = req.query;

    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    let baseQuery = `
        FROM karyawan ka
        LEFT JOIN penjualan p ON ka.id_karyawan = p.id_karyawan
        LEFT JOIN unsold u ON ka.id_karyawan = u.id_karyawan
        LEFT JOIN kasbon ON ka.id_karyawan = kasbon.id_karyawan
        WHERE 1=1
    `;

    const queryParams = [];

    if (bulan) {
        baseQuery += ` AND MONTH(p.tanggal) = ?`;
        queryParams.push(Number(bulan));
    }

    if (tahun) {
        baseQuery += ` AND YEAR(p.tanggal) = ?`;
        queryParams.push(Number(tahun));
    }

    if (nama) {
        baseQuery += ` AND LOWER(ka.nama) LIKE LOWER(?)`;
        queryParams.push(`%${nama}%`);
    }

    if (id_karyawan) {
        baseQuery += ` AND ka.id_karyawan = ?`;
        queryParams.push(Number(id_karyawan));
    }

    const rateQuery = `
        SELECT ROUND(AVG(p.rate)) AS rata_rate
        FROM penjualan p
        WHERE p.id_koin IS NOT NULL AND (p.id_unsold IS NULL OR p.id_unsold = 0)
    `;

    const dataQuery = `
        SELECT
            ka.id_karyawan,
            ka.nama AS karyawan_nama,
            COALESCE(SUM(p.dijual), 0) AS total_dijual,
            COALESCE(SUM(u.jumlah_dijual), 0) AS total_unsold,
            ? AS rata_rate,
            (ROUND(? * COALESCE(SUM(p.dijual), 0))) AS sales_rate,
            (ROUND(? * COALESCE(SUM(p.dijual), 0) * ? / 100)) AS sales_bersih,
            COALESCE(SUM(kasbon.nominal), 0) AS total_kasbon,
            (ROUND(? * COALESCE(SUM(p.dijual), 0) * ? / 100) - COALESCE(SUM(kasbon.nominal), 0)) AS total_gaji
        ${baseQuery}
        GROUP BY ka.id_karyawan
        ORDER BY ka.nama ASC
    `;

    const paginatedQuery = isAll ? dataQuery : `${dataQuery} LIMIT ? OFFSET ?`;
    const paginationParams = isAll ? [] : [Number(limit), Number(offset)];

    connection.query(rateQuery, queryParams, (err, rateResults) => {
        if (err) {
            console.error('Error fetching rata-rata rate: ', err);
            return res.status(500).json({ error: 'Error fetching rata-rata rate' });
        }

        const rataRate = rateResults[0]?.rata_rate || 0;

        connection.query(
            paginatedQuery,
            [rataRate, rataRate, rataRate, persentase, rataRate, persentase, ...queryParams, ...paginationParams],
            (err, results) => {
                if (err) {
                    console.error('Error fetching gaji details: ', err);
                    return res.status(500).json({ error: 'Error fetching gaji details' });
                }

                const totalQuery = `
                    SELECT COUNT(DISTINCT ka.id_karyawan) AS total
                    ${baseQuery}
                `;

                connection.query(totalQuery, queryParams, (err, countResults) => {
                    if (err) {
                        console.error('Error counting gaji details: ', err);
                        return res.status(500).json({ error: 'Error counting gaji details' });
                    }

                    // Update gaji data ke tabel gaji
                    const gajiUpdateQuery = `
                        INSERT INTO gaji (id_karyawan, bulan, tahun, bayar_emak, kasbon, sales_bersih, total_gaji)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE bayar_emak = VALUES(bayar_emak), kasbon = VALUES(kasbon), sales_bersih = VALUES(sales_bersih), total_gaji = VALUES(total_gaji)
                    `;

                    results.forEach(result => {
                        const salesBersih = (persentase * result.sales_rate) / 100;
                        const totalGaji = salesBersih - (Number(kasbon) || 0);

                        connection.query(gajiUpdateQuery, [
                            result.id_karyawan,
                            bulan,
                            tahun,
                            bayar_emak || 0,
                            kasbon || 0,
                            salesBersih,
                            totalGaji
                        ], (err) => {
                            if (err) {
                                console.error('Error updating gaji: ', err);
                            }
                        });
                    });

                    return res.json({
                        success: true,
                        data: results.map(result => {
                            const salesBersih = (persentase * result.sales_rate) / 100;
                            const totalGaji = salesBersih - result.total_kasbon;

                            return {
                                ...result,
                                sales_bersih: salesBersih,
                                total_gaji: totalGaji,
                                persentase: Number(persentase)
                            };
                        }),
                        total: countResults[0].total,
                        page: isAll ? 1 : Number(page),
                        limit: isAll ? countResults[0].total : Number(limit),
                    });
                });
            }
        );
    });
};




exports.getAllGaji = (req, res) => {
    const { bulan, tahun, id_karyawan } = req.query;

    let baseQuery = `
        SELECT 
            g.id_gaji,
            g.id_karyawan,
            k.nama AS karyawan_nama,
            g.sales_rate,
            g.sales_bersih,
            g.total_gaji,
            g.bayar_emak,
            g.kasbon,
            g.total_gaji,
            g.bulan,
            g.tahun
        FROM gaji g
        LEFT JOIN karyawan k ON g.id_karyawan = k.id_karyawan
        WHERE 1=1
    `;

    const queryParams = [];

    if (bulan) {
        baseQuery += ` AND g.bulan = ?`;
        queryParams.push(Number(bulan));
    }

    if (tahun) {
        baseQuery += ` AND g.tahun = ?`;
        queryParams.push(Number(tahun));
    }

    if (id_karyawan) {
        baseQuery += ` AND g.id_karyawan = ?`;
        queryParams.push(Number(id_karyawan));
    }

    connection.query(baseQuery, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching gaji details: ', err);
            return res.status(500).json({ error: 'Error fetching gaji details' });
        }

        return res.json({
            success: true,
            data: results,
        });
    });
};


exports.getGaji = (req, res) => {
    const { limit = 10, page = 1, bulan, tahun, id_karyawan, nama } = req.query;

    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    let baseQuery = `
        FROM karyawan ka
        LEFT JOIN gaji g ON ka.id_karyawan = g.id_karyawan
        WHERE 1=1
    `;

    const queryParams = [];

    if (id_karyawan) {
        baseQuery += ` AND ka.id_karyawan = ?`;
        queryParams.push(Number(id_karyawan));
    }

    if (nama) {
        baseQuery += ` AND LOWER(ka.nama) LIKE LOWER(?)`;
        queryParams.push(`%${nama}%`);
    }

    if (bulan) {
        baseQuery += ` AND g.bulan = ?`;
        queryParams.push(Number(bulan));
    }

    if (tahun) {
        baseQuery += ` AND g.tahun = ?`;
        queryParams.push(Number(tahun));
    }

    const dataQuery = `
        SELECT 
            ka.id_karyawan,
            ka.nama AS karyawan_nama,
            COALESCE(SUM(g.sales_rate), 0) AS total_sales_rate,
            COALESCE(SUM(g.sales_bersih), 0) AS total_sales_bersih,
            COALESCE(SUM(g.total_gaji), 0) AS total_total_gaji,
            -- Ambil data terakhir bayar_emak, kasbon, dan persentase
            (SELECT bayar_emak FROM gaji WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun ORDER BY id_gaji DESC LIMIT 1) AS total_bayar_emak,
            (SELECT kasbon FROM gaji WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun ORDER BY id_gaji DESC LIMIT 1) AS total_kasbon,
            (SELECT persentase FROM gaji WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun ORDER BY id_gaji DESC LIMIT 1) AS total_persentase,
            -- Perhitungan total gaji yang benar (sales_bersih dikurangi bayar_emak dan kasbon dari data terakhir)
            (
                SELECT sales_bersih 
                FROM gaji 
                WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun 
                ORDER BY id_gaji DESC LIMIT 1
            ) - 
            (
                SELECT COALESCE(SUM(kasbon), 0) 
                FROM gaji 
                WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun 
                ORDER BY id_gaji DESC LIMIT 1
            ) - 
            (
                SELECT COALESCE(SUM(bayar_emak), 0) 
                FROM gaji 
                WHERE id_karyawan = ka.id_karyawan AND bulan = g.bulan AND tahun = g.tahun 
                ORDER BY id_gaji DESC LIMIT 1
            ) AS total_gaji
        ${baseQuery}
        GROUP BY ka.id_karyawan
        ORDER BY ka.nama ASC
    `;

    const paginatedQuery = isAll ? dataQuery : `${dataQuery} LIMIT ? OFFSET ?`;
    const paginationParams = isAll ? [] : [Number(limit), Number(offset)];

    connection.query(
        paginatedQuery,
        [...queryParams, ...paginationParams],
        (err, results) => {
            if (err) {
                console.error('Error fetching gaji data: ', err);
                return res.status(500).json({ error: 'Error fetching gaji data' });
            }

            const totalQuery = `
                SELECT COUNT(DISTINCT ka.id_karyawan) AS total
                ${baseQuery}
            `;

            connection.query(totalQuery, queryParams, (err, countResults) => {
                if (err) {
                    console.error('Error counting gaji data: ', err);
                    return res.status(500).json({ error: 'Error counting gaji data' });
                }

                return res.json({
                    success: true,
                    data: results,
                    total: countResults[0].total,
                    page: isAll ? 1 : Number(page),
                    limit: isAll ? countResults[0].total : Number(limit),
                });
            });
        }
    );
};



// exports.updateGaji = (req, res) => {
//     const { id_karyawan } = req.params; // Path parameter
//     const { bulan, tahun } = req.query; // Query parameters
//     const { persentase, bayar_emak, kasbon } = req.body; // Body data
  
//     if (!id_karyawan || !bulan || !tahun) {
//       return res.status(400).json({ error: "ID karyawan, bulan, dan tahun wajib diisi" });
//     }
  
//     // Validasi persentase
//     if (!persentase || persentase <= 0 || persentase > 100) {
//       return res.status(400).json({ error: "Persentase harus antara 1 dan 100" });
//     }
  
//     // Query untuk mendapatkan semua data gaji berdasarkan bulan dan tahun
//     const selectQuery = `
//       SELECT id_gaji, sales_rate, sales_bersih, total_gaji
//       FROM gaji
//       WHERE id_karyawan = ? AND bulan = ? AND tahun = ?
//     `;
  
//     connection.query(selectQuery, [id_karyawan, bulan, tahun], (err, results) => {
//       if (err) {
//         console.error("Error fetching gaji data: ", err);
//         return res.status(500).json({ error: "Error fetching gaji data" });
//       }
  
//       if (results.length === 0) {
//         return res.status(404).json({ error: "Data gaji tidak ditemukan untuk bulan dan tahun tersebut" });
//       }
  
//       // Hitung dan update semua entri yang ditemukan
//       let total_sales_rate = 0;
//       let total_sales_bersih = 0;
//       let total_total_gaji = 0;
  
//       const updatePromises = results.map((row) => {
//         const sales_bersih = (row.sales_rate * persentase) / 100;
  
//         if (bayar_emak + kasbon > sales_bersih) {
//           return Promise.reject(
//             `Bayar emak (${bayar_emak}) dan kasbon (${kasbon}) tidak boleh lebih besar dari sales bersih (${sales_bersih})`
//           );
//         }
  
//         const total_gaji = sales_bersih - bayar_emak - kasbon;
  
//         // Akumulasi total
//         total_sales_rate += row.sales_rate;
//         total_sales_bersih += sales_bersih;
//         total_total_gaji += total_gaji;
  
//         // Query untuk update setiap row
//         const updateQuery = `
//           UPDATE gaji
//           SET sales_bersih = ?, bayar_emak = ?, kasbon = ?, total_gaji = ?, persentase = ?
//           WHERE id_gaji = ?
//         `;
  
//         return new Promise((resolve, reject) => {
//           connection.query(
//             updateQuery,
//             [sales_bersih, bayar_emak, kasbon, total_gaji, persentase, row.id_gaji],
//             (updateErr) => {
//               if (updateErr) {
//                 console.error("Error updating gaji: ", updateErr);
//                 reject("Error updating gaji");
//               } else {
//                 resolve();
//               }
//             }
//           );
//         });
//       });
  
//       // Eksekusi semua update
//       Promise.all(updatePromises)
//         .then(() => {
//           return res.json({
//             success: true,
//             message: "Data gaji berhasil diperbarui",
//             data: {
//               id_karyawan,
//               total_sales_rate,
//               total_sales_bersih,
//               total_total_gaji,
//               bulan,
//               tahun,
//             },
//           });
//         })
//         .catch((updateErr) => {
//           return res.status(400).json({ error: updateErr });
//         });
//     });
// };

exports.addGaji = (req, res) => {
    const { nama, koin, unsold, rate, tanggal } = req.body; // Body data

    // Validasi input
    if (!nama || !rate || !tanggal) {
        return res.status(400).json({ error: "Nama, Rate, dan Tanggal wajib diisi" });
    }

    // Jika unsold tidak ada (opsional), anggap unsold = 0
    const unsoldValue = unsold || 0;

    // Sales Rate dihitung: (koin + unsold) * rate
    const sales_rate = (koin + unsoldValue) * rate;  // Rumus yang benar

    // Query untuk mendapatkan id_karyawan berdasarkan nama
    const selectKaryawanQuery = `SELECT id_karyawan FROM karyawan WHERE nama = ? LIMIT 1`;

    connection.query(selectKaryawanQuery, [nama], (err, results) => {
        if (err) {
            console.error("Error fetching karyawan data: ", err);
            return res.status(500).json({ error: "Error fetching karyawan data" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Karyawan tidak ditemukan" });
        }

        const id_karyawan = results[0].id_karyawan;

        // Insert data gaji ke tabel gaji, termasuk koin, unsold, rate, dan sales_rate
        const insertGajiQuery = `
            INSERT INTO gaji (id_karyawan, koin, unsold, rate, sales_rate, tanggal)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        connection.query(insertGajiQuery, [id_karyawan, koin, unsoldValue, rate, sales_rate, tanggal], (insertErr, result) => {
            if (insertErr) {
                console.error("Error inserting gaji data: ", insertErr);
                return res.status(500).json({ error: "Error inserting gaji data" });
            }

            return res.status(201).json({
                success: true,
                message: "Data gaji berhasil ditambahkan",
                data: {
                    id_karyawan,
                    koin,
                    unsold: unsoldValue, // Pastikan nilai unsold disertakan walaupun opsional
                    rate,
                    sales_rate,
                    tanggal
                },
            });
        });
    });
};





exports.updateGaji = (req, res) => {
    const { id_gaji } = req.params; // Path parameter (id_gaji)
    const { bayar_emak, kasbon, persentase } = req.body; // Body data

    // Validasi input
    if (!bayar_emak || !kasbon || !persentase) {
      return res.status(400).json({ error: "Bayar Emak, Kasbon, dan Persentase wajib diisi" });
    }

    // Validasi persentase (harus antara 0 dan 100)
    if (persentase <= 0 || persentase > 100) {
      return res.status(400).json({ error: "Persentase harus antara 1 dan 100" });
    }

    // Query untuk mendapatkan data gaji berdasarkan id_gaji
    const selectGajiQuery = `SELECT id_karyawan, sales_rate, sales_bersih, total_gaji FROM gaji WHERE id_gaji = ?`;

    connection.query(selectGajiQuery, [id_gaji], (err, results) => {
      if (err) {
        console.error("Error fetching gaji data: ", err);
        return res.status(500).json({ error: "Error fetching gaji data" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Data gaji tidak ditemukan" });
      }

      const row = results[0];
      const sales_rate = row.sales_rate;

      // Hitung sales_bersih berdasarkan persentase
      const sales_bersih = (sales_rate * persentase) / 100;

      // Hitung total gaji (sales_bersih - bayar_emak - kasbon)
      const total_gaji = sales_bersih - bayar_emak - kasbon;

      // Update data gaji di tabel gaji
      const updateGajiQuery = `
        UPDATE gaji
        SET sales_bersih = ?, bayar_emak = ?, kasbon = ?, total_gaji = ?, persentase = ?
        WHERE id_gaji = ?
      `;

      connection.query(updateGajiQuery, [sales_bersih, bayar_emak, kasbon, total_gaji, persentase, id_gaji], (updateErr, updateResult) => {
        if (updateErr) {
          console.error("Error updating gaji data: ", updateErr);
          return res.status(500).json({ error: "Error updating gaji data" });
        }

        return res.status(200).json({
          success: true,
          message: "Data gaji berhasil diperbarui",
          data: {
            id_gaji,
            sales_rate,
            sales_bersih,
            total_gaji,
            bayar_emak,
            kasbon,
            persentase,
          },
        });
      });
    });
};


exports.getGajiAll = (req, res) => {
    const { limit = 10, page = 1, id_karyawan, nama, bulan, tahun } = req.query;

    // Pagination settings
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    let baseQuery = `
        FROM gaji g
        LEFT JOIN karyawan ka ON g.id_karyawan = ka.id_karyawan
        WHERE 1=1
    `;
    const queryParams = [];

    // Apply filters
    if (id_karyawan) {
        baseQuery += ` AND g.id_karyawan = ?`;
        queryParams.push(Number(id_karyawan));
    }

    if (nama) {
        baseQuery += ` AND LOWER(ka.nama) LIKE LOWER(?)`;
        queryParams.push(`%${nama}%`);
    }

    if (bulan) {
        baseQuery += ` AND MONTH(g.tanggal) = ?`;
        queryParams.push(Number(bulan));
    }

    if (tahun) {
        baseQuery += ` AND YEAR(g.tanggal) = ?`;
        queryParams.push(Number(tahun));
    }

    // Modify SELECT to include sales_rate and tanggal
    const dataQuery = `
        SELECT 
            g.id_gaji,
            g.koin,
            g.unsold,
            g.sales_rate,
            g.sales_bersih,
            g.total_gaji,
            g.bayar_emak,
            g.kasbon,
            g.persentase,
            g.tanggal,
            g.rate,
            ka.id_karyawan AS karyawan_id,
            ka.nama AS karyawan_nama
        ${baseQuery}
        ORDER BY g.id_gaji DESC
    `;

    // Apply pagination if not "all"
    const paginatedQuery = isAll ? dataQuery : `${dataQuery} LIMIT ? OFFSET ?`;
    const paginationParams = isAll ? [] : [Number(limit), Number(offset)];

    connection.query(
        paginatedQuery,
        [...queryParams, ...paginationParams],
        (err, results) => {
            if (err) {
                console.error('Error fetching gaji data: ', err);
                return res.status(500).json({ error: 'Error fetching gaji data' });
            }

            // Query to get total records count and totals for fields
            const totalQuery = `
                SELECT 
                    COUNT(*) AS total,
                    SUM(g.koin) AS total_koin,
                    SUM(g.unsold) AS total_unsold,
                    SUM(g.sales_rate) AS total_sales_rate,
                    SUM(g.kasbon) AS total_kasbon,
                    SUM(g.bayar_emak) AS total_bayar_emak,
                    SUM(g.total_gaji) AS total_gaji
                ${baseQuery}
            `;

            connection.query(totalQuery, queryParams, (err, countResults) => {
                if (err) {
                    console.error('Error counting gaji data: ', err);
                    return res.status(500).json({ error: 'Error counting gaji data' });
                }

                const totals = countResults[0];

                return res.json({
                    success: true,
                    data: results,
                    total: totals.total,
                    page: isAll ? 1 : Number(page),
                    limit: isAll ? totals.total : Number(limit),
                    totals: {
                        koin: totals.total_koin || 0,
                        unsold: totals.total_unsold || 0,
                        sales_rate: totals.total_sales_rate || 0,
                        kasbon: totals.total_kasbon || 0,
                        bayar_emak: totals.total_bayar_emak || 0,
                        total_gaji: totals.total_gaji || 0,
                    },
                });
            });
        }
    );
};



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