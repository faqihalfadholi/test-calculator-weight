require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { Connector } = require('@google-cloud/cloud-sql-connector');

const app = express();

// Setup view engine dan body parser
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Inisialisasi Cloud SQL Connector
const connector = new Connector();

// Buat fungsi untuk membuat koneksi
async function createPool() {
    const clientOpts = await connector.getOptions({
        instanceConnectionName: process.env.DB_HOST,  // Gunakan instance connection name dari .env
        ipType: 'PUBLIC',  // Anda dapat menggunakan 'PRIVATE' jika instance Cloud SQL Anda menggunakan IP privat
    });

    return mysql.createPool({
        ...clientOpts,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// Inisialisasi koneksi dan buat pool
let pool;
createPool().then(p => pool = p).catch(err => {
    console.error("Error saat membuat koneksi:", err);
    process.exit(1); // Exit aplikasi jika koneksi gagal
});

// Fungsi untuk menghitung berat ideal
function hitungBeratIdeal(jenisKelamin, tinggi) {
    let beratIdeal;
    if (jenisKelamin === 'Laki-laki') {
        beratIdeal = (tinggi - 100) - 0.1 * (tinggi - 100);
    } else {
        beratIdeal = (tinggi - 100) - 0.15 * (tinggi - 100);
    }
    return parseFloat(beratIdeal.toFixed(1));
}

// Fungsi untuk membersihkan data lama
function cleanupOldRecords(maxRecords = 5) {
    const sql = `DELETE FROM berat_ideal 
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM berat_ideal 
                ORDER BY tanggal DESC 
                LIMIT ?
            ) AS temp
        )`;

    if (pool) {
        pool.query(sql, [maxRecords], (err, result) => {
            if (err) {
                console.error('Error saat membersihkan data lama:', err);
            } else if (result.affectedRows > 0) {
                console.log(`${result.affectedRows} data lama telah dihapus`);
            }
        });
    } else {
        console.error("Koneksi pool tidak terinisialisasi");
    }
}

// Route untuk halaman utama
app.get('/', (req, res) => {
    if (pool) {
        pool.query('SELECT * FROM berat_ideal ORDER BY tanggal DESC LIMIT 10', (err, results) => {
            if (err) {
                console.error('Error fetching records:', err);
                return res.status(500).send('Gagal mengambil data riwayat.');
            }
            res.render('index', { records: results });
        });
    } else {
        console.error("Koneksi pool tidak terinisialisasi");
        res.status(500).send('Koneksi ke database gagal');
    }
});

// Route untuk menghitung berat ideal dan menyimpan data
app.post('/hitung', (req, res) => {
    const { nama, jenis_kelamin, tinggi, berat } = req.body;
    const tinggiNum = parseInt(tinggi);
    const beratNum = parseInt(berat);

    if (!nama || !jenis_kelamin || isNaN(tinggiNum) || isNaN(beratNum)) {
        return res.send('Data tidak lengkap atau tidak valid, mohon diisi semua dengan benar.');
    }

    const beratIdeal = hitungBeratIdeal(jenis_kelamin, tinggiNum);
    const sql = `INSERT INTO berat_ideal (nama, jenis_kelamin, tinggi, berat, berat_ideal) VALUES (?, ?, ?, ?, ?)`;

    if (pool) {
        pool.query(sql, [nama, jenis_kelamin, tinggiNum, beratNum, beratIdeal], (err, result) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).send('Gagal menyimpan data.');
            }

            cleanupOldRecords(10);
            
            res.redirect('/');
        });
    } else {
        console.error("Koneksi pool tidak terinisialisasi");
        res.status(500).send('Koneksi ke database gagal');
    }
});

// Route untuk menghapus riwayat
app.post('/clear-history', (req, res) => {
    const sql = 'DELETE FROM berat_ideal';

    if (pool) {
        pool.query(sql, (err, result) => {
            if (err) {
                console.error('Error saat menghapus riwayat:', err);
                res.status(500).send('Terjadi kesalahan saat menghapus riwayat');
            } else {
                console.log('Semua riwayat berhasil dihapus');
                res.redirect('/');
            }
        });
    } else {
        console.error("Koneksi pool tidak terinisialisasi");
        res.status(500).send('Koneksi ke database gagal');
    }
});

// Menjalankan server
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});
