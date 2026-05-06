require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'seat_allocation_v2_db',
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    connectionLimit: 10,
    multipleStatements: true
});

pool.getConnection().then(conn => {
    console.log('Connected to MySQL Database: seat_allocation_v2_db');
    conn.release();
}).catch(err => console.error('Error connecting to MySQL:', err));

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { rollno, password, name, f_name, m_name, category, gender, dob, phone, email, jee_rank } = req.body;
    
    // Server-side validation
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Invalid phone number." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address." });
    if (!/^2026\d{2}$/.test(rollno)) return res.status(400).json({ error: "Invalid roll number format." });
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/.test(password)) return res.status(400).json({ error: "Password does not meet complexity requirements." });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Simulating payment at registration by setting has_paid = TRUE
        const [userResult] = await conn.query(
            "INSERT INTO users (rollno, password_hash, name, category, gender, dob, phone, email, has_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
            [rollno, hashedPassword, name, category, gender, dob, phone, email]
        );
        const userId = userResult.insertId;
        
        await conn.query("INSERT INTO user_parents (user_id, f_name, m_name) VALUES (?, ?, ?)", [userId, f_name, m_name]);
        await conn.query(
            "INSERT INTO user_exam_details (user_id, jee_rank) VALUES (?, ?)", 
            [userId, parseInt(jee_rank)]
        );
        
        await conn.commit();
        res.status(201).json({ message: "Registration & Payment successful!", user_id: userId });
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
    
    if (rollno === 'admin' && password === 'admin') {
        return res.json({ message: "Admin login successful", user: { id: 0, role: 'admin', name: 'Administrator' } });
    }

    try {
        const [users] = await pool.query(`
            SELECT u.*, e.jee_rank, p.f_name, p.m_name
            FROM users u
            LEFT JOIN user_exam_details e ON u.id = e.user_id
            LEFT JOIN user_parents p ON u.id = p.user_id
            WHERE u.rollno = ?
        `, [rollno]);
        
        if (users.length === 0) return res.status(401).json({ error: "Invalid credentials." });
        
        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials." });
        
        delete user.password_hash;
        user.role = 'user';
        res.json({ message: "Login successful", user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error during login." });
    }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.id, u.rollno, u.name, u.category, u.gender, u.dob, u.phone, u.email, u.isExited, u.isFrozen, u.currentSeatID,
                   p.f_name, p.m_name, e.jee_rank
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
    const { id, name, f_name, m_name, category, gender, dob, phone, email, jee_rank } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        await conn.query(
            "UPDATE users SET name=?, category=?, gender=?, dob=?, phone=?, email=? WHERE id=?",
            [name, category, gender, dob, phone, email, id]
        );
        await conn.query("UPDATE user_parents SET f_name=?, m_name=? WHERE user_id=?", [f_name, m_name, id]);
        await conn.query(
            "UPDATE user_exam_details SET jee_rank=? WHERE user_id=?", 
            [parseInt(jee_rank), id]
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

// --- Branches & Choices Routes ---
app.get('/api/branches', async (req, res) => {
    try {
        // Uses get_available_seats() function to show live availability
        const [rows] = await pool.query("SELECT *, get_available_seats(branch_id) as available_seats FROM branches ORDER BY branch_id");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.get('/api/choices/:user_id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT uc.*, b.branch_name 
            FROM user_choices uc
            JOIN branches b ON uc.branch_id = b.branch_id
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
            const values = choices.map((c, index) => [user_id, c.branch_id, index + 1]);
            await pool.query("INSERT INTO user_choices (user_id, branch_id, preference_no) VALUES ?", [values]);
        }
        res.json({ message: "Choices saved." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error saving choices." });
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
    const { is_registration_open, is_choice_filling_open, is_result_published, current_round } = req.body;
    try {
        await pool.query(
            "UPDATE system_config SET is_registration_open=?, is_choice_filling_open=?, is_result_published=?, current_round=? WHERE id=1",
            [is_registration_open, is_choice_filling_open, is_result_published, current_round]
        );
        res.json({ message: "System config updated." });
    } catch (err) {
        res.status(500).json({ error: "Database error updating config." });
    }
});

app.post('/api/admin/setup_branches', async (req, res) => {
    const { branches } = req.body; // Array of { branch_id, total_capacity }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [config] = await conn.query("SELECT current_round, is_result_published FROM system_config LIMIT 1");
        if (config[0].current_round > 1 || config[0].is_result_published) {
            await conn.rollback();
            return res.status(400).json({ error: "Cannot modify capacities after Round 1 results are published." });
        }

        for (const b of branches) {
            await conn.query("UPDATE branches SET total_capacity = ?, remaining_capacity = ? WHERE branch_id = ?", [b.total_capacity, b.total_capacity, b.branch_id]);
        }
        await conn.commit();
        res.json({ message: "Branch capacities updated successfully." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Database error." });
    } finally {
        conn.release();
    }
});

app.post('/api/admin/allocate', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [config] = await conn.query("SELECT current_round FROM system_config LIMIT 1");
        const roundNo = config[0].current_round;

        // Execute the allocation logic natively inside the database via Stored Procedure
        await conn.query("CALL process_allocation_round()");

        await conn.commit();
        res.json({ message: `Round ${roundNo} Allocation processing complete.` });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Error during allocation run." });
    } finally {
        conn.release();
    }
});

app.post('/api/admin/reset', async (req, res) => {
    try {
        const sqlPath = path.join(__dirname, '../sql/reset_demo.sql');
        const sqlScript = fs.readFileSync(sqlPath, 'utf8');
        
        await pool.query(sqlScript);
        res.json({ message: "System successfully reset to Round 1." });
    } catch (err) {
        console.error("Error executing reset_demo.sql:", err);
        res.status(500).json({ error: "Failed to reset system database." });
    }
});

app.post('/api/admin/init-procedures', async (req, res) => {
    try {
        const sqlFiles = ['functions.sql', 'triggers.sql', 'procedures.sql'];
        for (const file of sqlFiles) {
            const sqlPath = path.join(__dirname, '../sql/', file);
            let sql = fs.readFileSync(sqlPath, 'utf8');
            sql = sql.replace(/USE\s+.*;/gi, '');
            sql = sql.replace(/DELIMITER\s+\$\$\s*/gi, '');
            sql = sql.replace(/DELIMITER\s+;\s*/gi, '');
            sql = sql.replace(/\$\$/g, ';');
            await pool.query(sql);
            console.log(`Loaded ${file} successfully.`);
        }
        res.json({ message: "Functions, triggers, and procedures created successfully." });
    } catch (err) {
        console.error("Error creating PL/SQL components:", err);
        res.status(500).json({ error: "Failed to create PL/SQL components: " + err.message });
    }
});

app.post('/api/student/action', async (req, res) => {
    const { user_id, action } = req.body; // 'Exit', 'Freeze', 'Float'
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [config] = await conn.query("SELECT current_round FROM system_config LIMIT 1");
        const roundNo = config[0].current_round;

        // Uses is_eligible_for_allocation() function to check eligibility
        const [users] = await conn.query("SELECT currentSeatID, isExited, isFrozen, is_eligible_for_allocation(id) as is_eligible FROM users WHERE id = ?", [user_id]);
        if (users.length === 0) return res.status(404).json({ error: "User not found." });
        
        const user = users[0];
        if (!user.is_eligible) {
            await conn.rollback();
            return res.status(400).json({ error: "You have already completed your process." });
        }

        if (action === 'Exit') {
            // Trigger trg_before_user_exit handles: capacity release, seatID reset, audit log
            await conn.query("UPDATE users SET isExited = TRUE WHERE id = ?", [user_id]);
            await conn.commit();
            return res.json({ message: "Successfully exited. Payment Refunded.", refunded: true });
        } 
        else if (action === 'Freeze') {
            if (!user.currentSeatID) {
                await conn.rollback();
                return res.status(400).json({ error: "No seat to freeze." });
            }
            await conn.query("UPDATE users SET isFrozen = TRUE WHERE id = ?", [user_id]);
            await conn.query("INSERT INTO audit_logs (user_id, round_no, action, branch_id) VALUES (?, ?, 'Frozen', ?)", [user_id, roundNo, user.currentSeatID]);
            await conn.commit();
            return res.json({ message: "Seat frozen successfully." });
        }
        else if (action === 'Float') {
            if (!user.currentSeatID) {
                await conn.rollback();
                return res.status(400).json({ error: "No seat to float." });
            }
            await conn.query("INSERT INTO audit_logs (user_id, round_no, action, branch_id) VALUES (?, ?, 'Floated', ?)", [user_id, roundNo, user.currentSeatID]);
            await conn.commit();
            return res.json({ message: "Opted for float successfully." });
        }
        
        await conn.rollback();
        res.status(400).json({ error: "Invalid action." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Database error." });
    } finally {
        conn.release();
    }
});

app.get('/api/results/:user_id', async (req, res) => {
    try {
        // Uses get_student_status() function to get allocation status
        const [users] = await pool.query(`
            SELECT u.currentSeatID, u.isExited, u.isFrozen, u.has_paid, b.branch_name,
                   get_student_status(u.id) as status
            FROM users u
            LEFT JOIN branches b ON u.currentSeatID = b.branch_id
            WHERE u.id = ?
        `, [req.params.user_id]);

        if (users.length === 0) return res.status(404).json({ error: "User not found" });
        const user = users[0];

        const [config] = await pool.query("SELECT is_result_published, current_round FROM system_config LIMIT 1");
        if (!config[0].is_result_published && !user.isExited && !user.isFrozen) {
             return res.json({ published: false });
        }

        const [logs] = await pool.query(`
            SELECT a.*, b.branch_name 
            FROM audit_logs a
            LEFT JOIN branches b ON a.branch_id = b.branch_id
            WHERE a.user_id = ?
            ORDER BY a.timestamp DESC
        `, [req.params.user_id]);

        // removed duplicate declaration
        if (!user.currentSeatID) {
            return res.json({ 
                published: true, 
                alloted: false, 
                isExited: user.isExited,
                history: logs 
            });
        }

        res.json({ 
            published: true, 
            alloted: true, 
            data: {
                branch_name: user.branch_name,
                status: user.status,
                isFrozen: user.isFrozen,
                isExited: user.isExited,
                has_paid: user.has_paid
            },
            history: logs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Backend V2 running on http://localhost:${PORT}`);
});
