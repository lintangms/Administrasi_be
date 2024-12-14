const connection = require('../models/database'); // Pastikan path koneksi database Anda sudah benar

// Fungsi untuk menambahkan dispensasi
exports.addDispensasi = (req, res) => {
    const { keperluan, hari, tanggal } = req.body;
    const { id_karyawan } = req.params; // Mengambil id_karyawan dari URL parameter

    // Validasi input
    if (!id_karyawan || !keperluan || !hari || !tanggal) {
        return res.status(400).json({ error: 'Semua data harus diisi' });
    }

    // Query untuk menambahkan dispensasi dengan status default 'belum_disetujui'
    const query = `
        INSERT INTO dispensasi (id_karyawan, keperluan, hari, tanggal, status)
        VALUES (?, ?, ?, ?, 'belum_disetujui')
    `;

    connection.query(query, [id_karyawan, keperluan, hari, tanggal], (err, result) => {
        if (err) {
            console.error('Error inserting dispensasi data: ', err);
            return res.status(500).json({ error: 'Gagal menambahkan dispensasi' });
        }

        return res.json({
            success: true,
            message: 'Dispensasi berhasil ditambahkan',
            data: { id_karyawan, keperluan, hari, tanggal, status: 'belum_disetujui' }
        });
    });
};

// Fungsi untuk mendapatkan semua dispensasi
exports.getAllDispensasi = (req, res) => {
    const { keperluan, hari, status, tanggal, limit = 10, page = 1 } = req.query;

    // Perhitungan OFFSET dan penanganan "all" untuk limit
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    // Membuat query dasar tanpa ORDER BY
    let query = 'SELECT * FROM dispensasi WHERE 1=1';
    const queryParams = [];

    // Menambahkan filter berdasarkan keperluan
    if (keperluan) {
        query += ' AND keperluan LIKE ?';
        queryParams.push(`%${keperluan}%`);
    }

    // Menambahkan filter berdasarkan hari
    if (hari) {
        query += ' AND hari = ?';
        queryParams.push(hari);
    }

    // Menambahkan filter berdasarkan status
    if (status) {
        query += ' AND status = ?';
        queryParams.push(status);
    }

    // Menambahkan filter berdasarkan tanggal
    if (tanggal) {
        query += ' AND tanggal = ?';
        queryParams.push(tanggal);
    }

    // Tambahkan ORDER BY setelah semua kondisi WHERE
    query += ' ORDER BY id_dispensasi DESC';

    // Tambahkan LIMIT dan OFFSET jika limit tidak "all"
    if (!isAll) {
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(Number(limit), Number(offset));
    }

    // Eksekusi query untuk mendapatkan data dispensasi
    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error querying dispensasi data: ', err);
            return res.status(500).json({ error: 'Gagal mendapatkan dispensasi' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Tidak ada data dispensasi' });
        }

        // Query untuk menghitung total data
        let countQuery = 'SELECT COUNT(*) as total FROM dispensasi WHERE 1=1';
        const countFilters = [];

        if (keperluan) {
            countQuery += ' AND keperluan LIKE ?';
            countFilters.push(`%${keperluan}%`);
        }
        if (hari) {
            countQuery += ' AND hari = ?';
            countFilters.push(hari);
        }
        if (status) {
            countQuery += ' AND status = ?';
            countFilters.push(status);
        }
        if (tanggal) {
            countQuery += ' AND tanggal = ?';
            countFilters.push(tanggal);
        }

        // Eksekusi query untuk menghitung jumlah total
        connection.query(countQuery, countFilters, (err, countResults) => {
            if (err) {
                console.error('Error counting dispensasi data: ', err);
                return res.status(500).json({ error: 'Gagal menghitung jumlah dispensasi' });
            }

            return res.json({
                success: true,
                dispensasis: results,
                total: countResults[0].total,
                page: isAll ? 1 : Number(page),
                limit: isAll ? countResults[0].total : Number(limit),
            });
        });
    });
};

// Fungsi untuk mendapatkan dispensasi berdasarkan ID karyawan dengan pagination
exports.getDispensasiByKaryawan = (req, res) => {
    const { id_karyawan } = req.params;
    const { limit = 10, page = 1 } = req.query; // Ambil parameter query dari request

    // Perhitungan OFFSET dan penanganan "all" untuk limit
    const isAll = limit === 'all';
    const offset = isAll ? 0 : (page - 1) * Number(limit);

    // Membuat query dasar
    let query = 'SELECT * FROM dispensasi WHERE id_karyawan = ? ORDER BY id_dispensasi DESC'; // Sort by id_dispensasi in descending order
    const queryParams = [id_karyawan];

    // Tambahkan LIMIT dan OFFSET hanya jika limit tidak "all"
    if (!isAll) {
        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));
    }

    // Eksekusi query untuk mendapatkan data dispensasi dengan filter dan pagination
    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error querying dispensasi by karyawan: ', err);
            return res.status(500).json({ error: 'Gagal mendapatkan dispensasi berdasarkan karyawan' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Dispensasi tidak ditemukan untuk karyawan ini' });
        }

        // Hitung total data tanpa pagination untuk informasi jumlah halaman
        const countQuery = 'SELECT COUNT(*) as total FROM dispensasi WHERE id_karyawan = ?';

        connection.query(countQuery, [id_karyawan], (err, countResults) => {
            if (err) {
                console.error('Error counting dispensasi data: ', err);
                return res.status(500).json({ error: 'Gagal menghitung jumlah dispensasi' });
            }

            return res.json({
                success: true,
                dispensasis: results, // Mengembalikan array data dispensasi yang difilter
                total: countResults[0].total,
                page: isAll ? 1 : Number(page),
                limit: isAll ? countResults[0].total : Number(limit),
            });
        });
    });
};

// Fungsi untuk mengupdate status dispensasi
exports.updateStatusDispensasiById = (req, res) => {
    const { status } = req.body;
    const id_dispensasi = req.params.id_dispensasi; // Ambil id_dispensasi dari parameter URL
  
    if (!id_dispensasi || !status) {
      return res.status(400).json({ error: 'ID dispensasi dan status harus diisi' });
    }
  
    const query = 'UPDATE dispensasi SET status = ? WHERE id_dispensasi = ?';
    connection.query(query, [status, id_dispensasi], (err, result) => {
      if (err) {
        console.error('Error updating dispensasi status: ', err);
        return res.status(500).json({ error: 'Gagal mengupdate status dispensasi' });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Dispensasi tidak ditemukan untuk ID dispensasi tersebut' });
      }
  
      return res.json({
        success: true,
        message: 'Status dispensasi berhasil diupdate',
        data: { id_dispensasi, status }
      });
    });
  };
  
