const express = require('express');
const bodyParser = require('body-parser'); // Tetap gunakan body-parser;
const mysql = require('mysql2') // Tetap gunakan mysql2

const app = express();

// Setting EJS sebagai view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// --- PERUBAHAN: Gunakan Connection Pool ---
const pool = mysql.createPool({
    connectionLimit: 10, // Jumlah koneksi maksimum di pool
    host: 'localhost',
    user: 'root',      // sesuaikan dengan user mysql anda
    password: '',      // sesuaikan dengan password mysql anda
    database: 'kalkulator',
});

// Coba dapatkan koneksi untuk tes awal (opsional tapi bagus)
pool.getConnection((err, connection) => {
    if (err) {
        console.error("Error saat menghubungkan ke database:", err);
        // Anda mungkin ingin menghentikan aplikasi jika koneksi awal gagal
        // process.exit(1); 
        return;
    }
    if (connection) {
        connection.release(); // Lepaskan koneksi kembali ke pool
        console.log("Terhubung ke database MySQL (menggunakan pool)");
    }
});
// --- AKHIR PERUBAHAN ---

// Fungsi kalkulasi berat badan ideal (metode Broca) - Tetap Sama
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
    
    // --- PERUBAHAN: Gunakan pool untuk query ---
    pool.query(sql, [maxRecords], (err, result) => {
        if (err) {
            console.error('Error saat membersihkan data lama:', err);
        } else if (result.affectedRows > 0) {
            console.log(`${result.affectedRows} data lama telah dihapus`);
        }
    });
    // --- AKHIR PERUBAHAN ---
}

// Route utama tampil form dan data
app.get('/', (req, res) => {
    // --- PERUBAHAN: Gunakan pool untuk query ---
    pool.query('SELECT * FROM berat_ideal ORDER BY tanggal DESC LIMIT 10', (err, results) => {
        if (err) {
            console.error('Error fetching records:', err);
            // Tampilkan halaman error atau pesan ke pengguna
            return res.status(500).send('Gagal mengambil data riwayat.'); 
        }
        res.render('index', { records: results });
    });
    // --- AKHIR PERUBAHAN ---
});

// Route proses form POST
app.post('/hitung', (req, res) => {
    const { nama, jenis_kelamin, tinggi, berat } = req.body;
    const tinggiNum = parseInt(tinggi);
    const beratNum = parseInt(berat);

    if (!nama || !jenis_kelamin || isNaN(tinggiNum) || isNaN(beratNum)) { // Cek NaN juga
        return res.send('Data tidak lengkap atau tidak valid, mohon diisi semua dengan benar.');
    }

    const beratIdeal = hitungBeratIdeal(jenis_kelamin, tinggiNum);
    const sql = `INSERT INTO berat_ideal (nama, jenis_kelamin, tinggi, berat, berat_ideal) VALUES (?, ?, ?, ?, ?)`;

    // --- PERUBAHAN: Gunakan pool untuk query ---
    pool.query(sql, [nama, jenis_kelamin, tinggiNum, beratNum, beratIdeal], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).send('Gagal menyimpan data.');
        }
        
        // Bersihkan data lama setelah menambahkan data baru
        // Panggil cleanup SETELAH insert berhasil
        cleanupOldRecords(10); 
        
        res.redirect('/');
    });
    // --- AKHIR PERUBAHAN ---
});

// Route untuk menghapus semua riwayat
app.post('/clear-history', (req, res) => {
    const sql = 'DELETE FROM berat_ideal';
    // --- PERUBAHAN: Gunakan pool untuk query ---
    pool.query(sql, (err, result) => {
        if (err) {
            console.error('Error saat menghapus riwayat:', err);
            res.status(500).send('Terjadi kesalahan saat menghapus riwayat');
        } else {
            console.log('Semua riwayat berhasil dihapus');
            res.redirect('/');
        }
    });
    // --- AKHIR PERUBAHAN ---
});

// Jalankan server - Tetap Sama
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});