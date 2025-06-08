const express = require('express');
const router = express.Router();
const pool = require('../database_pg');

// Получить все новости
router.get('/news', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Получаем новости с пагинацией
        const newsQuery = `
            SELECT * FROM news 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        const newsResult = await pool.query(newsQuery, [limit, offset]);

        // Получаем общее количество новостей
        const countResult = await pool.query('SELECT COUNT(*) FROM news');
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            news: newsResult.rows,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// Получить одну новость
router.get('/news/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM news WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'News not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching news item:', error);
        res.status(500).json({ error: 'Failed to fetch news item' });
    }
});

// Создать новость
router.post('/news', async (req, res) => {
    try {
        const { title, description, image_url } = req.body;
        
        // Получаем автора из сессии или используем default
        const author = req.session?.user?.name || 'Администратор';

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const result = await pool.query(
            `INSERT INTO news (title, description, author, image_url) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [title, description, author, image_url]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating news:', error);
        res.status(500).json({ error: 'Failed to create news' });
    }
});

// Обновить новость
router.put('/news/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, image_url } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const result = await pool.query(
            `UPDATE news 
             SET title = $1, description = $2, image_url = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING *`,
            [title, description, image_url, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'News not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({ error: 'Failed to update news' });
    }
});

// Удалить новость
router.delete('/news/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM news WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'News not found' });
        }

        res.json({ message: 'News deleted successfully', id: result.rows[0].id });
    } catch (error) {
        console.error('Error deleting news:', error);
        res.status(500).json({ error: 'Failed to delete news' });
    }
});

module.exports = router;