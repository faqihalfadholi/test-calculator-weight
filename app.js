import express from 'express';
import bodyParser from 'body-parser';
import mysql from'mysql2';
const app = express();

// Setting EJS sebagai view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Koneksi ke database MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',   // sesuaikan dengan user mysql anda
    password: '',   // sesuaikan dengan password mysql anda
    database: 'kalkulator',
});

db.connect(err => {
    if (err) throw err;
    console.log("Terhubung ke database MySQL");
});

// Fungsi kalkulasi berat badan ideal (metode Broca)
function hitungBeratIdeal(jenisKelamin, tinggi) {
    // Berat Ideal (Pria): (Tinggi - 100) - 10% dari (Tinggi - 100)
    // Berat Ideal (Wanita): (Tinggi - 100) - 15% dari (Tinggi - 100)
    let beratIdeal;
    if (jenisKelamin === 'Laki-laki') {
        beratIdeal = (tinggi - 100) - 0.1 * (tinggi - 100);
    } else {
        beratIdeal = (tinggi - 100) - 0.15 * (tinggi - 100);
    }
    return parseFloat(beratIdeal.toFixed(1));
}

// Route utama tampil form dan data
app.get('/', (req, res) => {
    db.query('SELECT * FROM berat_ideal ORDER BY tanggal DESC LIMIT 10', (err, results) => {
        if (err) throw err;
        res.render('index', { records: results });
    });
});

// Route proses form POST
app.post('/hitung', (req, res) => {
    const { nama, jenis_kelamin, tinggi, berat } = req.body;
    const tinggiNum = parseInt(tinggi);
    const beratNum = parseInt(berat);

    if (!nama || !jenis_kelamin || !tinggiNum || !beratNum) {
        return res.send('Data tidak lengkap, mohon diisi semua.');
    }

    const beratIdeal = hitungBeratIdeal(jenis_kelamin, tinggiNum);

    // Simpan ke database
    const sql = `INSERT INTO berat_ideal (nama, jenis_kelamin, tinggi, berat, berat_ideal) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [nama, jenis_kelamin, tinggiNum, beratNum, beratIdeal], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Jalankan server
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});