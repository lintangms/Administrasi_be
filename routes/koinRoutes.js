// routes/koinRoutes.js
const express = require('express');
const router = express.Router();
const koinController = require('../controllers/koinController');

router.post('/sell-koin', koinController.sellKoin);
router.get('/koin/:id_karyawan', koinController.getKoin);
router.get('/total-koin/:id_karyawan', koinController.getTotalKoinByIdKaryawan)


module.exports = router;
