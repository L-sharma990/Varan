require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Lokesh@77',
    database: process.env.DB_NAME || 'seat_allocation_db',
    connectionLimit: 10
});

// Test connection
pool.getConnection()
    .then(conn => {
        console.log('Connected to MySQL Database: seat_allocation_v2_db');
        conn.release();
    })
    .catch(err => console.error('Error connecting to MySQL:', err));

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { rollno, password, name, f_name, m_name, category, gender, dob, phone, email, jee_rank, jee_adv_rollno, jee_adv_rank } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [userResult] = await conn.query(
            "INSERT INTO users (rollno, password_hash, name, category, gender, dob, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [rollno, hashedPassword, name, category, gender, dob, phone, email]
        );
        const userId = userResult.insertId;
        
        await conn.query("INSERT INTO user_parents (user_id, f_name, m_name) VALUES (?, ?, ?)", [userId, f_name, m_name]);
        await conn.query(
            "INSERT INTO user_exam_details (user_id, jee_rank, jee_adv_rollno, jee_adv_rank) VALUES (?, ?, ?, ?)", 
            [userId, parseInt(jee_rank), jee_adv_rollno || null, jee_adv_rank ? parseInt(jee_adv_rank) : null]
        );
        
        await conn.commit();
        res.status(201).json({ message: "Registration successful!", user_id: userId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') res.status(400).json({ error: "Roll number already exists." });
        else res.status(500).json({ error: "Database error during registration." });
    } finally {
        conn.release();
    }
});

app.post('/api/login', async (req, res) => {
    const { rollno, password } = req.body;
    
    // Admin Override
    if (rollno === 'admin' && password === 'admin') {
        return res.json({ message: "Admin login successful", user: { id: 0, role: 'admin', name: 'Administrator' } });
    }

    try {
        const [users] = await pool.query(`
            SELECT u.*, e.jee_rank, e.jee_adv_rollno, e.jee_adv_rank, p.f_name, p.m_name
            FROM users u
            LEFT JOIN user_exam_details e ON u.id = e.user_id
            LEFT JOIN user_parents p ON u.id = p.user_id
            WHERE u.rollno = ?
        `, [rollno]);
        
        if (users.length === 0) return res.status(401).json({ error: "Invalid credentials." });
        
        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials." });
        
        // Don't send hash
        delete user.password_hash;
        user.role = 'user';
        res.json({ message: "Login successful", user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error during login." });
    }
});

// --- User Dashboard Routes ---
app.get('/api/user/:id', async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.id, u.rollno, u.name, u.category, u.gender, u.dob, u.phone, u.email,
                   p.f_name, p.m_name, e.jee_rank, e.jee_adv_rollno, e.jee_adv_rank
            FROM users u
            LEFT JOIN user_parents p ON u.id = p.user_id
            LEFT JOIN user_exam_details e ON u.id = e.user_id
            WHERE u.id = ?
        `, [req.params.id]);
        
        if (users.length === 0) return res.status(404).json({ error: "User not found." });
        res.json(users[0]);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.put('/api/user/update', async (req, res) => {
    const { id, name, f_name, m_name, category, gender, dob, phone, email, jee_rank, jee_adv_rollno, jee_adv_rank } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        await conn.query(
            "UPDATE users SET name=?, category=?, gender=?, dob=?, phone=?, email=? WHERE id=?",
            [name, category, gender, dob, phone, email, id]
        );
        await conn.query("UPDATE user_parents SET f_name=?, m_name=? WHERE user_id=?", [f_name, m_name, id]);
        await conn.query(
            "UPDATE user_exam_details SET jee_rank=?, jee_adv_rollno=?, jee_adv_rank=? WHERE user_id=?", 
            [parseInt(jee_rank), jee_adv_rollno || null, jee_adv_rank ? parseInt(jee_adv_rank) : null, id]
        );
        
        await conn.commit();
        res.json({ message: "Profile updated successfully." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Error updating profile." });
    } finally {
        conn.release();
    }
});

// --- Institute / Choices Routes ---
app.get('/api/courses', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * 
            FROM courses
            ORDER BY course_name
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.get('/api/choices/:user_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT uc.*, c.course_name 
            FROM user_choices uc
            JOIN courses c ON uc.course_id = c.id
            WHERE uc.user_id = ?
            ORDER BY uc.preference_no ASC
        `, [req.params.user_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.post('/api/choices/save', async (req, res) => {
    const { user_id, choices } = req.body;
    try {
        await pool.query("DELETE FROM user_choices WHERE user_id = ?", [user_id]);
        
        if (choices && choices.length > 0) {
            const values = choices.map((c, index) => [user_id, c.course_id, index + 1, false]);
            await pool.query("INSERT INTO user_choices (user_id, course_id, preference_no, is_locked) VALUES ?", [values]);
        }
        res.json({ message: "Choices saved." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error saving choices." });
    }
});

app.post('/api/choices/lock', async (req, res) => {
    const { user_id } = req.body;
    try {
        await pool.query("UPDATE user_choices SET is_locked = TRUE WHERE user_id = ?", [user_id]);
        res.json({ message: "Choices locked successfully." });
    } catch (err) {
        res.status(500).json({ error: "Error locking choices." });
    }
});

// --- System & Admin Routes ---
app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM system_config LIMIT 1");
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.post('/api/admin/config', async (req, res) => {
    const { is_registration_open, is_choice_filling_open, is_result_published } = req.body;
    try {
        await pool.query(
            "UPDATE system_config SET is_registration_open=?, is_choice_filling_open=?, is_result_published=? WHERE id=1",
            [is_registration_open, is_choice_filling_open, is_result_published]
        );
        res.json({ message: "System config updated." });
    } catch (err) {
        res.status(500).json({ error: "Database error updating config." });
    }
});

app.post('/api/admin/allocate', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Check if allocation already run
        const [config] = await conn.query("SELECT * FROM system_config LIMIT 1");
        if (config[0].is_allocation_run) {
            await conn.rollback();
            return res.status(400).json({ error: "Allocation already run." });
        }

        // Reset available seats just in case
        await conn.query("UPDATE courses SET available_seats = total_seats");
        
        // Clear old results
        await conn.query("DELETE FROM results");

        // 1. Get all users sorted by jee_rank ASC
        const [users] = await conn.query(`
            SELECT u.id 
            FROM users u
            JOIN user_exam_details e ON u.id = e.user_id
            ORDER BY e.jee_rank ASC
        `);

        // 2. For each user, get choices sorted by preference
        for (const user of users) {
            const [choices] = await conn.query("SELECT * FROM user_choices WHERE user_id = ? ORDER BY preference_no ASC", [user.id]);
            
            for (const choice of choices) {
                const [coursesInfo] = await conn.query("SELECT available_seats FROM courses WHERE id = ? FOR UPDATE", [choice.course_id]);
                
                if (coursesInfo[0] && coursesInfo[0].available_seats > 0) {
                    // Allot this seat
                    await conn.query("INSERT INTO results (user_id, course_id) VALUES (?, ?)", [user.id, choice.course_id]);
                    await conn.query("UPDATE courses SET available_seats = available_seats - 1 WHERE id = ?", [choice.course_id]);
                    break; // Move to next user
                }
            }
        }

        // 3. Mark allocation as run
        await conn.query("UPDATE system_config SET is_allocation_run = TRUE WHERE id=1");

        await conn.commit();
        res.json({ message: "Seat Allocation processing complete." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Error during allocation run." });
    } finally {
        conn.release();
    }
});

app.get('/api/results/:user_id', async (req, res) => {
    try {
        const [configRows] = await pool.query("SELECT is_result_published FROM system_config LIMIT 1");
        if (!configRows[0].is_result_published) {
             return res.json({ published: false });
        }

        const [results] = await pool.query(`
            SELECT r.*, c.course_name 
            FROM results r
            JOIN courses c ON r.course_id = c.id
            WHERE r.user_id = ?
        `, [req.params.user_id]);

        if (results.length === 0) {
            return res.json({ published: true, alloted: false });
        }

        res.json({ published: true, alloted: true, data: results[0] });
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.post('/api/payment', async (req, res) => {
    const { user_id } = req.body;
    try {
        await pool.query("UPDATE results SET status = 'Paid' WHERE user_id = ?", [user_id]);
        res.json({ message: "Payment recorded successfully." });
    } catch (err) {
        res.status(500).json({ error: "Database error recording payment." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Backend V2 running on http://localhost:${PORT}`);
});
