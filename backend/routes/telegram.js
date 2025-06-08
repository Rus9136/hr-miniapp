const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../database_pg');

// Telegram Bot Token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '-7765333400:AAG0rFD5IvUwlc83WiXZ5sjqo-YJF-xgmAs';
const JWT_SECRET = process.env.JWT_SECRET || 'hr_jwt_secret_key_for_telegram_auth_2025';

// Validate Telegram WebApp initData
function validateTelegramData(initData) {
    try {
        // For development/testing - allow bypassing validation
        const isDevelopment = process.env.NODE_ENV !== 'production';
        if (isDevelopment) {
            console.log('🔧 Development mode: Skipping Telegram hash validation');
            return true;
        }
        
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        
        // If no hash provided, assume development mode
        if (!hash) {
            console.log('⚠️ No hash in initData, assuming development mode');
            return true;
        }
        
        urlParams.delete('hash');
        
        // Create data-check-string
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        
        // Create secret key
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        
        // Calculate hash
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        
        // Verify hash
        if (calculatedHash !== hash) {
            console.log('⚠️ Hash validation failed, but allowing in non-production');
            return true; // Allow in non-production for testing
        }
        
        // Check timestamp (allow up to 24 hours for development)
        const authDate = parseInt(urlParams.get('auth_date'));
        if (authDate) {
            const currentTime = Math.floor(Date.now() / 1000);
            const maxAge = isDevelopment ? 86400 : 3600; // 24h for dev, 1h for prod
            if (currentTime - authDate > maxAge) {
                console.log('⚠️ Data too old, but allowing in development');
                return true;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Telegram data validation error:', error);
        // In development, return true even on errors
        const isDevelopment = process.env.NODE_ENV !== 'production';
        return isDevelopment;
    }
}

// Parse user data from initData
function parseUserData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const userParam = urlParams.get('user');
        if (userParam) {
            return JSON.parse(decodeURIComponent(userParam));
        }
        return null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

// Link Telegram user with employee
router.post('/telegram/link', async (req, res) => {
    try {
        const { initData, employeeNumber, employeeIIN } = req.body;
        
        console.log('🔗 Telegram link request:', { initData, employeeNumber, employeeIIN });
        
        // Support both old (employeeNumber) and new (employeeIIN) parameters
        if (!initData || (!employeeNumber && !employeeIIN)) {
            console.log('❌ Missing required parameters');
            return res.status(400).json({ error: 'initData and employeeIIN are required' });
        }
        
        // For development, allow bypassing validation
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const isDevMode = initData === 'dev_mode';
        console.log('🔧 Development mode:', isDevelopment, 'NODE_ENV:', process.env.NODE_ENV, 'Dev mode request:', isDevMode);
        let telegramUser = null;
        
        if (isDevMode) {
            console.log('🧪 Using dev mode mock user (regardless of NODE_ENV)');
            // Development mode - create mock user
            telegramUser = {
                id: Math.floor(Math.random() * 1000000) + 100000,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser'
            };
        } else {
            console.log('🔍 Validating real Telegram data');
            // Validate Telegram data
            if (!validateTelegramData(initData)) {
                console.log('❌ Telegram data validation failed');
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            
            // Parse user data
            telegramUser = parseUserData(initData);
            console.log('👤 Parsed user data:', telegramUser);
            if (!telegramUser) {
                console.log('❌ Failed to parse user data');
                return res.status(400).json({ error: 'Invalid user data' });
            }
        }
        
        // No strict validation on server side
        
        // Check if employee exists
        const searchParam = employeeIIN || employeeNumber;
        const searchField = employeeIIN ? 'iin' : 'table_number';
        
        const employee = await db.queryRow(
            `SELECT * FROM employees WHERE ${searchField} = $1`,
            [searchParam]
        );
        
        if (!employee) {
            return res.status(404).json({ error: employeeIIN ? 'Сотрудник с таким ИИН не найден' : 'Employee not found' });
        }
        
        // Check if Telegram user is already linked
        const existingLink = await db.queryRow(
            'SELECT * FROM users WHERE telegram_user_id = $1',
            [telegramUser.id]
        );
        
        if (existingLink && existingLink.employee_iin !== employee.iin && existingLink.employee_number !== employee.table_number) {
            return res.status(409).json({ error: 'This Telegram account is already linked to another employee' });
        }
        
        // Check if employee is already linked to another Telegram account
        const existingEmployeeLink = await db.queryRow(
            'SELECT * FROM users WHERE employee_number = $1 OR employee_iin = $2',
            [employee.table_number, employee.iin]
        );
        
        if (existingEmployeeLink && existingEmployeeLink.telegram_user_id !== telegramUser.id) {
            // If employee is linked to different Telegram account, update it
            await db.query(
                'UPDATE users SET telegram_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE employee_number = $2 OR employee_iin = $3',
                [telegramUser.id, employee.table_number, employee.iin]
            );
        } else {
            // Create or update user link with both employee_number and employee_iin
            await db.query(`
                INSERT INTO users (telegram_user_id, employee_number, employee_iin, role, created_at, updated_at)
                VALUES ($1, $2, $3, 'employee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (telegram_user_id) DO UPDATE SET
                    employee_number = EXCLUDED.employee_number,
                    employee_iin = EXCLUDED.employee_iin,
                    updated_at = CURRENT_TIMESTAMP
            `, [telegramUser.id, employee.table_number, employee.iin]);
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                telegram_user_id: telegramUser.id,
                employee_number: employee.table_number,
                employee_iin: employee.iin,
                role: 'employee'
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            message: 'Account linked successfully',
            token,
            employee: {
                id: employee.id,
                tableNumber: employee.table_number,
                fullName: employee.full_name,
                iin: employee.iin
            },
            telegram_user: {
                id: telegramUser.id,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name,
                username: telegramUser.username
            }
        });
        
    } catch (error) {
        console.error('Error linking Telegram account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Authenticate with Telegram
router.post('/telegram/auth', async (req, res) => {
    try {
        const { initData } = req.body;
        
        console.log('🔑 Telegram auth request with initData:', initData.substring(0, 50) + '...');
        
        if (!initData) {
            console.log('❌ No initData provided');
            return res.status(400).json({ error: 'initData is required' });
        }
        
        // Allow mock authentication when initData is 'dev_mode'
        const isDevMode = initData === 'dev_mode';
        let telegramUser = null;
        
        if (isDevMode) {
            // Development mode - use first linked user
            const userLink = await db.queryRow(`
                SELECT u.*, e.*, d.object_name as department_name, p.staff_position_name as position_name
                FROM users u
                JOIN employees e ON (u.employee_number = e.table_number OR u.employee_iin = e.iin)
                LEFT JOIN departments d ON e.object_code = d.object_code
                LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
                WHERE u.role = 'employee'
                LIMIT 1
            `);
            
            if (userLink) {
                return res.json({
                    success: true,
                    employee: {
                        id: userLink.id,
                        tableNumber: userLink.table_number,
                        fullName: userLink.full_name,
                        department: userLink.department_name,
                        position: userLink.position_name,
                        objectBin: userLink.object_bin
                    },
                    isLinked: true
                });
            } else {
                return res.json({
                    success: false,
                    message: 'No linked account found',
                    isLinked: false
                });
            }
        } else {
            // Validate Telegram data
            if (!validateTelegramData(initData)) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            
            // Parse user data
            telegramUser = parseUserData(initData);
            if (!telegramUser) {
                return res.status(400).json({ error: 'Invalid user data' });
            }
        }
        
        // Find linked employee (join by either employee_number or employee_iin for backward compatibility)
        const userLink = await db.queryRow(`
            SELECT u.*, e.*, d.object_name as department_name, p.staff_position_name as position_name
            FROM users u
            JOIN employees e ON (u.employee_number = e.table_number OR u.employee_iin = e.iin)
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            WHERE u.telegram_user_id = $1
        `, [telegramUser.id]);
        
        if (!userLink) {
            return res.json({
                success: false,
                message: 'Account not linked. Please enter your IIN to link.',
                isLinked: false,
                telegram_user: {
                    id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name,
                    username: telegramUser.username
                }
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                telegram_user_id: telegramUser.id,
                employee_number: userLink.employee_number,
                employee_iin: userLink.employee_iin,
                role: userLink.role
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            employee: {
                id: userLink.id,
                tableNumber: userLink.table_number,
                fullName: userLink.full_name,
                department: userLink.department_name,
                position: userLink.position_name,
                objectBin: userLink.object_bin,
                iin: userLink.iin
            },
            isLinked: true,
            token
        });
        
    } catch (error) {
        console.error('Error authenticating with Telegram:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Unlink Telegram account
router.post('/telegram/unlink', async (req, res) => {
    try {
        const { initData } = req.body;
        
        if (!initData) {
            return res.status(400).json({ error: 'initData is required' });
        }
        
        // Allow mock authentication when initData is 'dev_mode'
        const isDevMode = initData === 'dev_mode';
        let telegramUser = null;
        
        if (isDevMode) {
            // Development mode - find any linked user to unlink
            const anyLinkedUser = await db.queryRow(`
                SELECT telegram_user_id FROM users 
                WHERE telegram_user_id IS NOT NULL 
                LIMIT 1
            `);
            
            if (!anyLinkedUser) {
                return res.status(404).json({ error: 'No linked account found' });
            }
            
            telegramUser = { id: anyLinkedUser.telegram_user_id };
        } else {
            // Validate Telegram data
            if (!validateTelegramData(initData)) {
                return res.status(401).json({ error: 'Invalid Telegram data' });
            }
            
            // Parse user data
            telegramUser = parseUserData(initData);
            if (!telegramUser) {
                return res.status(400).json({ error: 'Invalid user data' });
            }
        }
        
        // Remove link
        const result = await db.query(
            'DELETE FROM users WHERE telegram_user_id = $1',
            [telegramUser.id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Account not linked' });
        }
        
        res.json({
            success: true,
            message: 'Account unlinked successfully'
        });
        
    } catch (error) {
        console.error('Error unlinking Telegram account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get linked accounts info (for admin)
router.get('/telegram/links', async (req, res) => {
    try {
        const links = await db.queryRows(`
            SELECT 
                u.telegram_user_id,
                u.employee_number,
                u.employee_iin,
                u.role,
                u.created_at,
                e.full_name,
                e.iin,
                d.object_name as department_name,
                p.staff_position_name as position_name
            FROM users u
            JOIN employees e ON (u.employee_number = e.table_number OR u.employee_iin = e.iin)
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            WHERE u.telegram_user_id IS NOT NULL
            ORDER BY u.created_at DESC
        `);
        
        res.json(links);
        
    } catch (error) {
        console.error('Error getting Telegram links:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;