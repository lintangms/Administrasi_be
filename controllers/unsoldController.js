const connection = require('../models/database');

exports.addUnsold = (req, res) => {
  const { akun_steam, akun_gmail, shift, jenis, jumlah_awal } = req.body; // tambah jumlah_awal
  const { id_karyawan } = req.params;

  // Validasi input
  if (!akun_steam || !akun_gmail || !shift || !jenis || !jumlah_awal || !id_karyawan) {
    return res.status(400).json({ error: 'Semua field wajib diisi!' });
  }

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

    // Insert data unsold dengan jumlah_awal dan jumlah_sisa yang diambil dari inputan
    const insertUnsoldQuery = `
      INSERT INTO unsold (akun_steam, akun_gmail, shift, id_karyawan, jenis, jumlah_awal, jumlah_sisa, waktu)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    connection.query(insertUnsoldQuery, [akun_steam, akun_gmail, shift, id_karyawan, jenis, jumlah_awal, jumlah_awal], (err, unsoldResult) => {
      if (err) {
        console.error('Error inserting unsold: ', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat menambahkan data unsold' });
      }

      return res.json({
        success: true,
        message: 'Data unsold berhasil ditambahkan',
        data: {
          id_unsold: unsoldResult.insertId,
          akun_steam,
          akun_gmail,
          shift,
          id_karyawan: parseInt(id_karyawan),
          jenis,
          jumlah_awal: jumlah_awal,
          jumlah_sisa: jumlah_awal, // jumlah_sisa = jumlah_awal
          waktu: new Date(),
        },
      });
    });
  });
};

exports.getAllUnsold = (req, res) => {
  const getAllUnsoldQuery = `
      SELECT 
          unsold.id_unsold, 
          unsold.akun_steam, 
          unsold.akun_gmail, 
          unsold.shift, 
          unsold.id_karyawan, 
          karyawan.nama AS nama, 
          unsold.jenis, 
          unsold.jumlah_awal, 
          unsold.jumlah_dijual, 
          unsold.jumlah_sisa, 
          unsold.waktu
      FROM unsold
      LEFT JOIN karyawan ON unsold.id_karyawan = karyawan.id_karyawan
      ORDER BY unsold.waktu DESC
  `;

  connection.query(getAllUnsoldQuery, (err, results) => {
      if (err) {
          console.error('Error fetching unsold: ', err);
          return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data unsold' });
      }

      if (results.length === 0) {
          return res.status(404).json({ message: 'Tidak ada data unsold ditemukan' });
      }

      return res.json({
          success: true,
          data: results,
      });
  });
};

exports.handleUnsold = (req, res) => {
    const { id_karyawan } = req.params; // Mengambil id_karyawan dari URL parameter
    const { limit = 10, page = 1 } = req.query; // Menggunakan req.query untuk limit dan page

    // Perhitungan OFFSET dan penanganan "all" untuk limit
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    // Query untuk menampilkan data unsold
    let getUnsoldQuery = `
        SELECT 
            id_unsold, akun_steam, akun_gmail, shift, id_karyawan, jenis, jumlah_awal, jumlah_dijual, jumlah_sisa, waktu
        FROM unsold
        WHERE id_karyawan = ?
        ORDER BY waktu DESC
    `;

    // Eksekusi query untuk mengambil data unsold berdasarkan id_karyawan
    connection.query(getUnsoldQuery + (isAll ? '' : ' LIMIT ? OFFSET ?'),
        [id_karyawan, ...(!isAll ? [Number(limit), Number(offset)] : [])],
        (err, results) => {
            if (err) {
                console.error('Error fetching unsold data: ', err.message);
                return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data unsold' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Tidak ada data unsold ditemukan untuk ID karyawan ini' });
            }

            // Query untuk menghitung total data unsold tanpa pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM unsold
                WHERE id_karyawan = ?
            `;

            connection.query(countQuery, [id_karyawan], (err, countResults) => {
                if (err) {
                    console.error('Error counting unsold: ', err.message);
                    return res.status(500).json({ error: 'Error menghitung total unsold' });
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