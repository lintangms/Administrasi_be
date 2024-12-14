// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/user/:kode_akun', userController.getUserByKodeAkun);
router.get('/users', userController.getAllUsers);
router.get('/users/:id_karyawan', userController.getUserByIdKaryawan);
router.post('/adduser', userController.addUser);
router.put('/update/:id_karyawan', userController.updateUser);
router.delete('/delete/:id_karyawan', userController.deleteUser);
router.post('/addakun', userController.addAkunToUser)
router.get('/getakun', userController.getAkunKaryawan)
router.get('/getnama', userController.getKaryawanOptions)


module.exports = router;
