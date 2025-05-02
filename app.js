require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2')

const app = express();


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));


const pool = mysql.createPool({
    connectionLimit: 10, 
    host: process.env.DB_HOST,
    user: process.env.DB_USER,     
    password: process.env.DB_PASSWORD,   
    database: process.env.DB_NAME,
});


pool.getConnection((err, connection) => {
    if (err) {
        console.error("Error saat menghubungkan ke database:", err);
        return;
    }
    if (connection) {
        connection.release();
        console.log("Terhubung ke database MySQL (menggunakan pool)");
    }
});

function hitungBeratIdeal(jenisKelamin, tinggi) {
    let beratIdeal;
    if (jenisKelamin === 'Laki-laki') {
        beratIdeal = (tinggi - 100) - 0.1 * (tinggi - 100);
    } else {
        beratIdeal = (tinggi - 100) - 0.15 * (tinggi - 100);
    }
    return parseFloat(beratIdeal.toFixed(1));
}

function cleanupOldRecords(maxRecords = 5) {
    const sql = `
        DELETE FROM berat_ideal 
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM berat_ideal 
                ORDER BY tanggal DESC 
                LIMIT ?
            ) AS temp
        )
    `;
    
    pool.query(sql, [maxRecords], (err, result) => {
        if (err) {
            console.error('Error saat membersihkan data lama:', err);
        } else if (result.affectedRows > 0) {
            console.log(`${result.affectedRows} data lama telah dihapus`);
        }
    });
}

app.get('/', (req, res) => {
    pool.query('SELECT * FROM berat_ideal ORDER BY tanggal DESC LIMIT 10', (err, results) => {
        if (err) {
            console.error('Error fetching records:', err);
        
            return res.status(500).send('Gagal mengambil data riwayat.'); 
        }
        res.render('index', { records: results });
    });
});

app.post('/hitung', (req, res) => {
    const { nama, jenis_kelamin, tinggi, berat } = req.body;
    const tinggiNum = parseInt(tinggi);
    const beratNum = parseInt(berat);

    if (!nama || !jenis_kelamin || isNaN(tinggiNum) || isNaN(beratNum)) {
        return res.send('Data tidak lengkap atau tidak valid, mohon diisi semua dengan benar.');
    }

    const beratIdeal = hitungBeratIdeal(jenis_kelamin, tinggiNum);
    const sql = `INSERT INTO berat_ideal (nama, jenis_kelamin, tinggi, berat, berat_ideal) VALUES (?, ?, ?, ?, ?)`;

    pool.query(sql, [nama, jenis_kelamin, tinggiNum, beratNum, beratIdeal], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).send('Gagal menyimpan data.');
        }

        cleanupOldRecords(10); 
        
        res.redirect('/');
    });
});

app.post('/clear-history', (req, res) => {
    const sql = 'DELETE FROM berat_ideal';
    pool.query(sql, (err, result) => {
        if (err) {
            console.error('Error saat menghapus riwayat:', err);
            res.status(500).send('Terjadi kesalahan saat menghapus riwayat');
        } else {
            console.log('Semua riwayat berhasil dihapus');
            res.redirect('/');
        }
    });
});

app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});