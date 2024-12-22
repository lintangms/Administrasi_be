const connection = require('../models/database');
exports.addTransaksi = (req, res) => {
  const { akun_steam, akun_gmail, shift, jumlah_awal, keterangan, jenis } = req.body;
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
    [id_karyawan, jumlah_awal, jumlah_awal], 
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
              jumlah_awal, 
              jumlah_sisa: jumlah_awal,
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
      COALESCE((
        SELECT SUM(koin.jumlah_awal)
        FROM transaksi
        INNER JOIN koin ON transaksi.id_koin = koin.id_koin
        WHERE transaksi.jenis = 'TNL'
      ), 0) AS total_koin_tnl,
      COALESCE((
        SELECT SUM(latest_koin.jumlah_awal)
        FROM (
          SELECT 
            koin.jumlah_awal, 
            transaksi.id_karyawan, 
            ROW_NUMBER() OVER (PARTITION BY transaksi.id_karyawan ORDER BY transaksi.timestamp DESC) AS row_num
          FROM koin
          INNER JOIN transaksi ON koin.id_koin = transaksi.id_koin
          WHERE transaksi.jenis = 'LA'
        ) AS latest_koin
        WHERE latest_koin.row_num = 1
      ), 0) AS total_koin_la,
      (SELECT COUNT(*) FROM kasbon) AS total_kasbon
    FROM transaksi;
  `;

  connection.query(getAllTransaksiQuery, (err, result) => {
    if (err) {
      console.error('Error fetching transaksi: ', err);
      return res.status(500).json({ error: 'Error fetching transaksi' });
    }

    if (!result.length) {
      return res.status(404).json({ message: 'No transaksi found' });
    }

    const totalKaryawan = result[0].total_karyawan || 0;
    const totalKoinTnl = result[0].total_koin_tnl || 0;
    const totalKoinLa = result[0].total_koin_la || 0;
    const totalKasbon = result[0].total_kasbon || 0;

    return res.json({
      success: true,
      data: {
        total_karyawan: totalKaryawan,
        total_koin_tnl: totalKoinTnl,
        total_koin_la: totalKoinLa,
        total_kasbon: totalKasbon,
      },
    });
  });
};


exports.getAbsensi = (req, res) => {
  const { id_karyawan, nama, bulan, tahun } = req.query;

  // Mulai query dasar
  let baseQuery = `
    SELECT 
      karyawan.nama AS nama_karyawan,
      transaksi.keterangan,
      transaksi.waktu AS waktu_transaksi
    FROM 
      karyawan
    JOIN transaksi 
      ON karyawan.id_karyawan = transaksi.id_karyawan
    WHERE 
      transaksi.keterangan IN ('masuk', 'pulang')
  `;

  const queryParams = [];

  // Apply filters
  if (id_karyawan) {
    baseQuery += ` AND karyawan.id_karyawan = ?`;
    queryParams.push(Number(id_karyawan));
  }

  if (nama) {
    baseQuery += ` AND LOWER(karyawan.nama) LIKE LOWER(?)`;
    queryParams.push(`%${nama}%`);
  }

  if (bulan) {
    baseQuery += ` AND MONTH(transaksi.waktu) = ?`;
    queryParams.push(Number(bulan));
  }

  if (tahun) {
    baseQuery += ` AND YEAR(transaksi.waktu) = ?`;
    queryParams.push(Number(tahun));
  }

  baseQuery += `
    ORDER BY 
      karyawan.nama, 
      transaksi.waktu;
  `;

  connection.query(baseQuery, queryParams, (err, result) => {
    if (err) {
      console.error('Error fetching absensi data: ', err);
      return res.status(500).json({ error: 'Error fetching absensi data' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'No absensi data found' });
    }

    // Format the result into a more readable structure
    const formattedResult = result.reduce((acc, row) => {
      const { nama_karyawan, keterangan, waktu_transaksi } = row;

      // Find the employee or create a new entry
      if (!acc[nama_karyawan]) {
        acc[nama_karyawan] = { nama_karyawan, total_jam_kerja: 0 };
      }

      // Check if there are both "masuk" and "pulang"
      if (keterangan === 'masuk') {
        acc[nama_karyawan].jam_masuk = new Date(waktu_transaksi);
      } else if (keterangan === 'pulang' && acc[nama_karyawan].jam_masuk) {
        const jam_pulang = new Date(waktu_transaksi);

        // Calculate the difference in time between masuk and pulang
        const diffTime = (jam_pulang - acc[nama_karyawan].jam_masuk) / (1000 * 60); // in minutes

        // Add the result to the total minutes worked
        acc[nama_karyawan].total_jam_kerja += diffTime;

        // Clear jam_masuk after calculating the work hours
        acc[nama_karyawan].jam_masuk = null; // Reset so it doesn't accumulate incorrectly
      }

      return acc;
    }, {});

    // Convert total minutes to hours:minutes format
    const responseData = Object.values(formattedResult).map(entry => {
      const totalMinutes = entry.total_jam_kerja;
      const hours = Math.floor(totalMinutes / 60); // Get the number of full hours
      const minutes = Math.round(totalMinutes % 60); // Get the remaining minutes

      // Format hours and minutes as "HH:MM"
      const formattedTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;

      return {
        nama_karyawan: entry.nama_karyawan,
        total_jam_kerja: formattedTime,
      };
    });

    return res.json({
      success: true,
      data: responseData,
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
      COALESCE((
        SELECT koin.jumlah_awal
        FROM koin
        LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
        WHERE transaksi.jenis = 'TNL'
        AND transaksi.id_karyawan = karyawan.id_karyawan
        ORDER BY transaksi.timestamp DESC
        LIMIT 1
      ), 0) AS tnl_koin,
      COALESCE((
        SELECT koin.jumlah_awal
        FROM koin
        LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
        WHERE transaksi.jenis = 'LA'
        AND transaksi.id_karyawan = karyawan.id_karyawan
        ORDER BY transaksi.timestamp DESC
        LIMIT 1
      ), 0) AS la_koin
    FROM karyawan
    LEFT JOIN transaksi ON transaksi.id_karyawan = karyawan.id_karyawan
    GROUP BY karyawan.id_karyawan, karyawan.nama
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

    // Menghitung total karyawan yang memiliki transaksi TNL dan LA
    const totalKaryawanTNL = results.filter(row => row.tnl_koin > 0).length;
    const totalKaryawanLA = results.filter(row => row.la_koin > 0).length;

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



exports.getKoinUpdate = (req, res) => {
  const { nama, limit = 10, page = 1 } = req.query;

  const isAll = limit === 'all';
  const offset = isAll ? 0 : (page - 1) * Number(limit);

  let statistikQuery = `
    SELECT 
      transaksi.id_transaksi,
      karyawan.id_karyawan,
      koin.id_koin,
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
    FROM karyawan
    LEFT JOIN transaksi ON transaksi.id_karyawan = karyawan.id_karyawan
    LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
    WHERE transaksi.id_transaksi IN (
      SELECT MAX(transaksi.id_transaksi)
      FROM transaksi
      LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
      GROUP BY transaksi.id_karyawan, transaksi.jenis
    )
  `;

  const filters = [];
  if (nama) {
    statistikQuery += ` AND karyawan.nama LIKE ?`;
    filters.push(`%${nama}%`);
  }

  statistikQuery += ` ORDER BY transaksi.waktu DESC`;

  if (!isAll) {
    statistikQuery += ` LIMIT ? OFFSET ?`;
    filters.push(Number(limit), Number(offset));
  }

  connection.query(statistikQuery, filters, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik' });
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM karyawan
      LEFT JOIN transaksi ON transaksi.id_karyawan = karyawan.id_karyawan
      LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
      WHERE transaksi.id_transaksi IN (
        SELECT MAX(transaksi.id_transaksi)
        FROM transaksi
        LEFT JOIN koin ON transaksi.id_koin = koin.id_koin
        GROUP BY transaksi.id_karyawan, transaksi.jenis
      )
    `;

    connection.query(countQuery, filters.slice(0, filters.length - 2), (err, countResults) => {
      if (err) {
        console.error('Error counting koin statistik: ', err);
        return res.status(500).json({ error: 'Error counting koin statistik' });
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

exports.getKoinKaryawan = (req, res) => {
  const { id_karyawan, nama, bulan, tahun } = req.query;

  // Query dasar
  let baseQuery = `
    SELECT 
      karyawan.nama,
      COALESCE((
        SELECT koin.jumlah_awal
        FROM koin
        LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
        WHERE transaksi.jenis = 'TNL'
        AND transaksi.id_karyawan = karyawan.id_karyawan
        AND MONTH(transaksi.timestamp) = ? AND YEAR(transaksi.timestamp) = ?
        ORDER BY transaksi.timestamp DESC
        LIMIT 1
      ), 0) AS tnl_koin,
      COALESCE((
        SELECT koin.jumlah_awal
        FROM koin
        LEFT JOIN transaksi ON koin.id_koin = transaksi.id_koin
        WHERE transaksi.jenis = 'LA'
        AND transaksi.id_karyawan = karyawan.id_karyawan
        AND MONTH(transaksi.timestamp) = ? AND YEAR(transaksi.timestamp) = ?
        ORDER BY transaksi.timestamp DESC
        LIMIT 1
      ), 0) AS la_koin
    FROM karyawan
    LEFT JOIN transaksi ON transaksi.id_karyawan = karyawan.id_karyawan
    WHERE 1=1
  `;

  let queryParams = [bulan, tahun, bulan, tahun];

  // Apply filters
  if (id_karyawan) {
    baseQuery += ` AND karyawan.id_karyawan = ?`;
    queryParams.push(Number(id_karyawan));
  }

  if (nama) {
    baseQuery += ` AND LOWER(karyawan.nama) LIKE LOWER(?)`;
    queryParams.push(`%${nama}%`);
  }

  baseQuery += `
    GROUP BY karyawan.id_karyawan, karyawan.nama
    ORDER BY karyawan.nama ASC;
  `;

  // Eksekusi query
  connection.query(baseQuery, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching koin statistik per periode: ', err);
      return res.status(500).json({ error: 'Error fetching koin statistik per periode' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Tidak ada data statistik ditemukan untuk periode ini' });
    }

    // Menghitung total karyawan yang memiliki transaksi TNL dan LA
    const totalKaryawanTNL = results.filter(row => row.tnl_koin > 0).length;
    const totalKaryawanLA = results.filter(row => row.la_koin > 0).length;

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
