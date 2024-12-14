// routes/akunRoutes.js
const express = require('express');
const router = express.Router();
const transaksiController = require('../controllers/transaksiController');

router.post('/akun/:id_karyawan', transaksiController.addTransaksi);
router.get('/transaksi', transaksiController.getAllTransaksi)
router.put('/sellkoin/:id_koin', transaksiController.sellKoin)
router.get('/handleget/:id_karyawan', transaksiController.handleTransaksi)
router.get('/koin-statistik', transaksiController.getKoinStatistik);
router.get('/filter', transaksiController.getFilteredTransaksi);
router.get('/gaji', transaksiController.getgaji)
router.get('/karyawangame', transaksiController.getKaryawanByGame)
router.get('/karyawantop', transaksiController.getTopKaryawanByKoin)
router.get('/statsperiode', transaksiController.getKoinStatistikPeriode)
router.get('/getabsensi', transaksiController.getAbsensi)
module.exports = router;
