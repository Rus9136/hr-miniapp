const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const MultiAgentSystem = require('../services/multi-agent-system');
const MCPClient = require('../services/mcp-client');

require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

/**
 * POST /api/admin/ai-recommendations/analyze
 * Запуск мультиагентного анализа подразделения
 */
router.post('/analyze', async (req, res) => {
    try {
        const { department_id, date_start, date_end, reviews_count = 50 } = req.body;

        // Валидация входных данных
        if (!department_id || !date_start || !date_end) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: department_id, date_start, date_end'
            });
        }

        console.log(`[AI-Recommendations] Запуск анализа для подразделения ${department_id}, период: ${date_start} - ${date_end}`);

        // 1. Получение данных от MCP API
        const mcpClient = new MCPClient();
        const mcpData = await mcpClient.getDashboardData(department_id, date_start, date_end, reviews_count);

        if (!mcpData.success) {
            return res.status(500).json({
                success: false,
                error: 'Ошибка получения данных от MCP API',
                details: mcpData.error
            });
        }

        // 2. Запуск мультиагентного анализа
        const multiAgentSystem = new MultiAgentSystem();
        const analysisResult = await multiAgentSystem.runAnalysis(mcpData.data);

        if (!analysisResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Ошибка мультиагентного анализа',
                details: analysisResult.error
            });
        }

        // 3. Сохранение результатов в БД
        const saveResult = await saveAnalysisResults(
            department_id,
            date_start,
            date_end,
            mcpData.data,
            analysisResult.results
        );

        res.json({
            success: true,
            data: {
                analysis_id: saveResult.analysis_id,
                department_id,
                period: { start: date_start, end: date_end },
                mcp_data: mcpData.data,
                agent_results: analysisResult.results,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка анализа:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/ai-recommendations/history
 * Получение истории анализов
 */
router.get('/history', async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const query = `
            SELECT id, department_id, date_start, date_end, created_at,
                   jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name') as department_name
            FROM ai_recommendations 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            }
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка получения истории:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения истории анализов',
            details: error.message
        });
    }
});

/**
 * GET/PUT /api/admin/ai-recommendations/prompts
 * Работа с промптами агентов
 */
router.get('/prompts', async (req, res) => {
    try {
        const query = `
            SELECT agent_name, prompt_text, updated_at 
            FROM ai_prompts 
            ORDER BY agent_name
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка получения промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения промптов',
            details: error.message
        });
    }
});

router.put('/prompts', async (req, res) => {
    try {
        const { prompts } = req.body;

        if (!prompts || typeof prompts !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Неверный формат данных. Ожидается объект prompts'
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const [agentName, promptText] of Object.entries(prompts)) {
                await client.query(`
                    INSERT INTO ai_prompts (agent_name, prompt_text, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (agent_name) 
                    DO UPDATE SET prompt_text = $2, updated_at = NOW()
                `, [agentName, promptText]);
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Промпты успешно обновлены'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка обновления промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления промптов',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/ai-recommendations/rerun-agent
 * Перезапуск отдельного агента с новым промптом
 */
router.post('/rerun-agent', async (req, res) => {
    try {
        const { analysis_id, agent_name, new_prompt } = req.body;

        if (!analysis_id || !agent_name || !new_prompt) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: analysis_id, agent_name, new_prompt'
            });
        }

        // Получение оригинальных данных анализа
        const originalQuery = `
            SELECT mcp_response FROM ai_recommendations 
            WHERE id = $1
        `;
        const originalResult = await pool.query(originalQuery, [analysis_id]);

        if (originalResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Анализ не найден'
            });
        }

        const mcpData = originalResult.rows[0].mcp_response;

        // Запуск отдельного агента
        const multiAgentSystem = new MultiAgentSystem();
        const agentResult = await multiAgentSystem.runSingleAgent(agent_name, mcpData, new_prompt);

        if (!agentResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Ошибка выполнения агента',
                details: agentResult.error
            });
        }

        res.json({
            success: true,
            data: {
                agent_name,
                result: agentResult.result,
                executed_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка перезапуска агента:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка перезапуска агента',
            details: error.message
        });
    }
});

/**
 * Сохранение результатов анализа в БД
 */
async function saveAnalysisResults(department_id, date_start, date_end, mcpResponse, agentResults) {
    const query = `
        INSERT INTO ai_recommendations (department_id, date_start, date_end, mcp_response, agent_results, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
    `;

    const result = await pool.query(query, [
        department_id,
        date_start,
        date_end,
        JSON.stringify(mcpResponse),
        JSON.stringify(agentResults)
    ]);

    return { analysis_id: result.rows[0].id };
}

/**
 * GET /api/admin/ai-recommendations/:id
 * Получение детального анализа по ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT * FROM ai_recommendations 
            WHERE id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Анализ не найден'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка получения анализа:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения анализа',
            details: error.message
        });
    }
});

module.exports = router;