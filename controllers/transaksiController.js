const connection = require('../models/database');
exports.addTransaksi = (req, res) => {
  const { akun_steam, akun_gmail, shift, jumlah_awal_koin, keterangan, jenis } = req.body;
  const { id_karyawan } = req.params;

  // Validasi input...
  // (Validasi seperti di kode kamu tetap sama)

  // Query untuk memastikan akun_karyawan sudah ada
  const insertAkunKaryawanQuery = `
    INSERT INTO akun_karyawan (id_karyawan, akun_steam, akun_gmail)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE akun_steam = VALUES(akun_steam), akun_gmail = VALUES(akun_gmail)
  `;

  connection.query(insertAkunKaryawanQuery, [id_karyawan, akun_steam, akun_gmail], (err, akunResult) => {
    if (err) {
      console.error('Error inserting akun karyawan: ', err);
      return res.status(500).json({ error: 'Error inserting akun karyawan' });
    }

    const id_akun = akunResult.insertId || akunResult.insertId === 0 ? akunResult.insertId : id_karyawan;

    // Setelah akun berhasil ditambahkan, lanjutkan dengan menambahkan koin
    const insertKoinQuery = `
      INSERT INTO koin (id_karyawan, id_akun, jumlah_awal, jumlah_sisa)
      VALUES (?, ?, ?, ?)
    `;

    connection.query(insertKoinQuery, [id_karyawan, id_akun, jumlah_awal_koin, jumlah_awal_koin], (err, koinResult) => {
      if (err) {
        console.error('Error inserting koin: ', err);
        return res.status(500).json({ error: 'Error inserting koin' });
      }

      const id_koin = koinResult.insertId;

      // Insert data transaksi setelah koin berhasil disimpan
      const insertTransaksiQuery = `
        INSERT INTO transaksi (akun_steam, akun_gmail, shift, id_karyawan, keterangan, id_koin, jenis)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      connection.query(insertTransaksiQuery, [akun_steam, akun_gmail, shift, id_karyawan, keterangan, id_koin, jenis], (err, transaksiResult) => {
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
            id_karyawan: parseInt(id_karyawan),
          },
        });
      });
    });
  });
};



exports.getAllTransaksi = (req, res) => {
  const getAllTransaksiQuery = `
    SELECT 
      karyawan.id_karyawan,
      karyawan.nama AS nama_karyawan,
      CONCAT(
        FLOOR(
          SUM(
            CASE 
              WHEN masuk.waktu IS NOT NULL AND pulang.waktu IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, masuk.waktu, pulang.waktu)
              ELSE 0
            END
          ) / 3600
        ), ' Jam ',
        FLOOR(
          (SUM(
            CASE 
              WHEN masuk.waktu IS NOT NULL AND pulang.waktu IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, masuk.waktu, pulang.waktu)
              ELSE 0
            END
          ) % 3600) / 60
        ), ' Menit'
      ) AS total_jam_kerja,
      SUM(CASE WHEN masuk.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_tnl,
      SUM(CASE WHEN masuk.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_la,
      (SELECT COUNT(*) FROM kasbon) AS total_kasbon
    FROM karyawan
    LEFT JOIN transaksi AS masuk 
      ON karyawan.id_karyawan = masuk.id_karyawan AND masuk.keterangan = 'masuk'
    LEFT JOIN transaksi AS pulang 
      ON karyawan.id_karyawan = pulang.id_karyawan AND pulang.keterangan = 'pulang'
    LEFT JOIN koin 
      ON masuk.id_koin = koin.id_koin
    GROUP BY karyawan.id_karyawan
  `;

  connection.query(getAllTransaksiQuery, (err, result) => {
    if (err) {
      console.error('Error fetching transaksi: ', err);
      return res.status(500).json({ error: 'Error fetching transaksi' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'No transaksi found' });
    }

    return res.json({
      success: true,
      data: result,
    });
  });
};


exports.getAllTransaksiStats = (req, res) => {
  const getAllTransaksiQuery = `
    SELECT 
      COUNT(DISTINCT transaksi.id_karyawan) AS total_karyawan,
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_tnl,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_la,
      (SELECT COUNT(*) FROM kasbon) AS total_kasbon
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
      data: result[0] // Mengembalikan objek pertama yang berisi total
    });
  });
};
exports.getAbsensi = (req, res) => {
  const getAbsensiQuery = `
    SELECT 
      karyawan.nama AS nama_karyawan,
      transaksi.jenis,
      koin.jumlah_awal,
      koin.jumlah_dijual,
      koin.jumlah_sisa,
      transaksi.shift,
      transaksi.keterangan,
      transaksi.waktu,
      CASE 
        WHEN transaksi.keterangan = 'pulang' THEN 
          CONCAT(
            FLOOR(TIMESTAMPDIFF(SECOND, masuk.waktu, transaksi.waktu) / 3600), ' Jam ',
            FLOOR((TIMESTAMPDIFF(SECOND, masuk.waktu, transaksi.waktu) % 3600) / 60), ' Menit'
          )
        ELSE NULL
      END AS jam_kerja
    FROM 
      karyawan
    JOIN transaksi 
      ON karyawan.id_karyawan = transaksi.id_karyawan
    LEFT JOIN koin 
      ON transaksi.id_koin = koin.id_koin
    LEFT JOIN transaksi AS masuk
      ON transaksi.id_karyawan = masuk.id_karyawan 
      AND masuk.keterangan = 'masuk'
    WHERE 
      transaksi.id_transaksi IN (
        SELECT MAX(t1.id_transaksi)
        FROM transaksi t1
        WHERE t1.keterangan IN ('masuk', 'pulang')
        GROUP BY t1.id_karyawan, t1.keterangan
      )
    ORDER BY 
      karyawan.nama, 
      FIELD(transaksi.keterangan, 'masuk', 'pulang'), 
      transaksi.waktu DESC;
  `;

  connection.query(getAbsensiQuery, (err, result) => {
    if (err) {
      console.error('Error fetching absensi data: ', err);
      return res.status(500).json({ error: 'Error fetching absensi data' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'No absensi data found' });
    }

    return res.json({
      success: true,
      data: result,
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
  const { limit = 10, page = 1 } = req.query; // Menggunakan req.query untuk limit dan page

  // Perhitungan OFFSET dan penanganan "all" untuk limit
  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

  // Query untuk menampilkan data transaksi
  let getTransaksiQuery = `
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
    WHERE transaksi.id_karyawan = ?
    ORDER BY transaksi.id_transaksi DESC
  `;

  // Eksekusi query untuk mengambil data transaksi berdasarkan id_karyawan
  connection.query(getTransaksiQuery + (isAll ? '' : ' LIMIT ? OFFSET ?'), 
    [id_karyawan, ...(!isAll ? [Number(limit), Number(offset)] : [])], 
    (err, results) => {
      if (err) {
        console.error('Error executing query:', err.message);
        return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data transaksi' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Tidak ada transaksi ditemukan untuk ID karyawan ini' });
      }

      // Query untuk menghitung total transaksi tanpa pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM transaksi
        WHERE transaksi.id_karyawan = ?
      `;

      connection.query(countQuery, [id_karyawan], (err, countResults) => {
        if (err) {
          console.error('Error counting transaksi: ', err.message);
          return res.status(500).json({ error: 'Error menghitung total transaksi' });
        }

        return res.json({
          success: true,
          data: results,
          total: countResults[0].total,
          page: isAll ? 1 : Number(page),
          limit: isAll ? countResults[0].total : Number(limit),
        });
      });
  });
};
exports.getKoinStatistik = (req, res) => {
  const statistikQuery = `
    SELECT 
      karyawan.nama,
      COALESCE(
        (SELECT koin.jumlah_awal
         FROM koin
         LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
         WHERE transaksi.jenis = 'TNL'
         AND transaksi.id_karyawan = karyawan.id_karyawan
         ORDER BY koin.waktu_update DESC
         LIMIT 1), 0) AS tnl_koin,
      COALESCE(
        (SELECT koin.jumlah_awal
         FROM koin
         LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
         WHERE transaksi.jenis = 'LA'
         AND transaksi.id_karyawan = karyawan.id_karyawan
         ORDER BY koin.waktu_update DESC
         LIMIT 1), 0) AS la_koin,
      COUNT(DISTINCT CASE WHEN transaksi.jenis = 'TNL' THEN transaksi.id_karyawan END) AS total_karyawan_tnl,
      COUNT(DISTINCT CASE WHEN transaksi.jenis = 'LA' THEN transaksi.id_karyawan END) AS total_karyawan_la
    FROM karyawan
    LEFT JOIN transaksi ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    GROUP BY karyawan.nama
    ORDER BY karyawan.nama ASC;
  `;

  connection.query(statistikQuery, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan' });
    }

    // Calculate total employees for TNL and LA
    const totalKaryawanTNL = results.reduce((acc, row) => acc + (row.tnl_koin > 0 ? 1 : 0), 0);
    const totalKaryawanLA = results.reduce((acc, row) => acc + (row.la_koin > 0 ? 1 : 0), 0);

    return res.json({
      success: true,
      data: results,
      stats: {
        tnl: totalKaryawanTNL,
        la: totalKaryawanLA,
      },
    });
  });
};
exports.getFilteredTransaksi = (req, res) => {
  const { nama, jenis, tanggal, limit = 10, page = 1 } = req.query;

  // Perhitungan OFFSET dan penanganan "all" untuk limit
  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

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

  // Tambahkan ORDER BY untuk memastikan data terbaru muncul di atas
  query += ` ORDER BY transaksi.id_transaksi DESC`; // Sort by id_transaksi in descending order

  // Tambahkan LIMIT dan OFFSET hanya jika limit tidak "all"
  if (!isAll) {
    query += ` LIMIT ? OFFSET ?`;
    filters.push(Number(limit), Number(offset));
  }

  // Eksekusi query dengan filter
  connection.query(query, filters, (err, results) => {
    if (err) {
      console.error('Error filtering transaksi: ', err);
      return res.status(500).json({ error: 'Error filtering transaksi' });
    }

    // Hitung total data tanpa pagination untuk informasi jumlah halaman
    let countQuery = `
      SELECT COUNT(*) as total
      FROM transaksi
      LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
      LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
      WHERE 1=1
    `;

    // Menambahkan filter yang sama untuk menghitung total
    const countFilters = [];
    if (nama) {
      countQuery += ` AND karyawan.nama LIKE ?`;
      countFilters.push(`%${nama}%`);
    }
    if (jenis) {
      countQuery += ` AND transaksi.jenis = ?`;
      countFilters.push(jenis);
    }
    if (tanggal) {
      countQuery += ` AND DATE(transaksi.waktu) = ?`;
      countFilters.push(tanggal);
    }

    // Eksekusi query untuk menghitung total
    connection.query(countQuery, countFilters, (err, countResults) => {
      if (err) {
        console.error('Error counting transaksi: ', err);
        return res.status(500).json({ error: 'Error counting transaksi' });
      }

      return res.json({
        success: true,
        data: results,
        total: countResults[0].total,
        page: isAll ? 1 : Number(page),
        limit: isAll ? countResults[0].total : Number(limit),
      });
    });
  });
};
exports.getgaji = (req, res) => {
  const { harga_rata_rata } = req.query; // Harga rata-rata koin diinputkan melalui query parameter

  // Query untuk mendapatkan data statistik koin
  const statistikQuery = `
    SELECT 
      karyawan.nama,
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_dijual ELSE 0 END) AS tnl_koin,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_dijual ELSE 0 END) AS la_koin,
      SUM(koin.jumlah_dijual) AS total_jumlah_dijual
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    GROUP BY karyawan.nama
    ORDER BY karyawan.nama ASC
  `;

  // Eksekusi query untuk mendapatkan data statistik
  connection.query(statistikQuery, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan' });
    }

    // Jika harga_rata_rata tidak diberikan, kembalikan data tanpa pendapatan
    if (!harga_rata_rata || isNaN(harga_rata_rata)) {
      return res.json({
        success: true,
        data: results.map(karyawan => ({
          ...karyawan,
          pendapatan_koin: null // Atur pendapatan_koin menjadi null
        })),
      });
    }

    // Menghitung pendapatan berdasarkan harga rata-rata
    const updatedResults = results.map(karyawan => {
      return {
        ...karyawan,
        pendapatan_koin: karyawan.total_jumlah_dijual * harga_rata_rata * 0.5 // Menghitung pendapatan berdasarkan harga rata-rata
      };
    });

    return res.json({
      success: true,
      data: updatedResults,
    });
  });
};

exports.getKaryawanByGame = (req, res) => {
  const getKaryawanByGameQuery = `
    SELECT 
      COUNT(DISTINCT CASE WHEN transaksi.jenis = 'TNL' THEN transaksi.id_karyawan END) AS total_karyawan_tnl,
      COUNT(DISTINCT CASE WHEN transaksi.jenis = 'LA' THEN transaksi.id_karyawan END) AS total_karyawan_la
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    WHERE transaksi.jenis IN ('TNL', 'LA')`;

  connection.query(getKaryawanByGameQuery, (err, result) => {
    if (err) {
      console.error('Error fetching karyawan by game: ', err);
      return res.status(500).json({ error: 'Error fetching karyawan by game' });
    }

    console.log(result); // Debugging untuk memastikan hasil query benar

    if (result.length === 0) {
      return res.status(404).json({ message: 'No karyawan found' });
    }

    return res.json({
      success: true,
      data: result[0] // Mengembalikan objek pertama yang berisi total
    });
  });
};
exports.getTopKaryawanByKoin = (req, res) => {
  const getTopKaryawanQuery = `
    SELECT 
      karyawan.id_karyawan,
      karyawan.nama,  -- Pastikan nama kolom benar
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_dijual ELSE 0 END) AS total_koin_tnl,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_dijual ELSE 0 END) AS total_koin_la,
      (SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_dijual ELSE 0 END) + 
       SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_dijual ELSE 0 END)) AS total_koin
    FROM transaksi
    LEFT JOIN karyawan ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin  -- Menghubungkan dengan tabel koin
    WHERE transaksi.jenis IN ('TNL', 'LA')
    GROUP BY karyawan.id_karyawan, karyawan.nama
    ORDER BY total_koin DESC
    LIMIT 5`;

  connection.query(getTopKaryawanQuery, (err, result) => {
    if (err) {
      console.error('Error fetching top karyawan by koin: ', err);
      return res.status(500).json({ error: 'Error fetching top karyawan by koin' });
    }

    console.log(result); // Debugging untuk memastikan hasil query benar

    if (result.length === 0) {
      return res.status(404).json({ message: 'No karyawan found' });
    }

    return res.json({
      success: true,
      data: result // Mengembalikan hasil query yang berisi top 5 karyawan dengan koin terbanyak
    });
  });
};
exports.getKoinStatistikPeriode = (req, res) => {
  const { startDate, endDate, groupBy } = req.query;

  // Validasi parameter input
  if (
    !startDate ||
    !endDate ||
    !groupBy ||
    !['DAY', 'MONTH', 'WEEK'].includes(groupBy.toUpperCase())
  ) {
    return res.status(400).json({
      success: false,
      message: 'Parameter startDate, endDate, dan groupBy (DAY/MONTH/WEEK) diperlukan.',
    });
  }

  // Tentukan kolom periode berdasarkan groupBy
  let periodColumn;
  if (groupBy.toUpperCase() === 'DAY') {
    periodColumn = "DATE_FORMAT(transaksi.waktu, '%W') AS period"; // Hari (Monday, Tuesday, ...)
  } else if (groupBy.toUpperCase() === 'MONTH') {
    periodColumn = "DATE_FORMAT(transaksi.waktu, '%M') AS period"; // Bulan (January, February, ...)
  } else if (groupBy.toUpperCase() === 'WEEK') {
    periodColumn = "CONCAT('Minggu ', WEEK(transaksi.waktu)) AS period"; // Minggu (Week 1, Week 2, ...)
  }

  // Query SQL untuk menghitung statistik berdasarkan grup (DAY/MONTH/WEEK)
  const statistikQuery = `
    SELECT 
      ${periodColumn},
      SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_tnl,
      SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END) AS total_koin_la,
      (SUM(CASE WHEN transaksi.jenis = 'TNL' THEN koin.jumlah_awal ELSE 0 END) +
       SUM(CASE WHEN transaksi.jenis = 'LA' THEN koin.jumlah_awal ELSE 0 END)) AS total_koin
    FROM transaksi
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    WHERE transaksi.waktu BETWEEN ? AND ?
    GROUP BY period
    ORDER BY 
      ${groupBy.toUpperCase() === 'DAY' ? `
        FIELD(
          period, 
          'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
        ) /* Urutan hari */
      ` : groupBy.toUpperCase() === 'MONTH' ? `
        FIELD(
          period, 
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ) /* Urutan bulan */
      ` : `period /* Urutan default untuk WEEK */`
    }
  `;

  // Eksekusi query
  connection.query(statistikQuery, [startDate, endDate], (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik per periode: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik per periode' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan untuk periode ini' });
    }

    return res.json({
      success: true,
      data: results,
    });
  });
};
