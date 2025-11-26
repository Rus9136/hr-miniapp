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
        const { department_id, date_start, date_end, reviews_count = 50, provider = 'claude' } = req.body;

        // Валидация входных данных
        if (!department_id || !date_start || !date_end) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: department_id, date_start, date_end'
            });
        }

        // Валидация провайдера AI
        const supportedProviders = ['claude', 'openai', 'gemini'];
        if (!supportedProviders.includes(provider)) {
            return res.status(400).json({
                success: false,
                error: `Неподдерживаемый AI-провайдер: ${provider}. Доступные: ${supportedProviders.join(', ')}`
            });
        }

        console.log(`[AI-Recommendations] Запуск анализа для подразделения ${department_id}, период: ${date_start} - ${date_end}, провайдер: ${provider}`);

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

        // 2. Создание записи анализа в БД для получения ID
        const initialAnalysis = await createAnalysisRecord(
            department_id,
            date_start,
            date_end,
            mcpData.data,
            provider
        );

        // 3. Запуск мультиагентного анализа с выбранным провайдером
        const multiAgentSystem = new MultiAgentSystem();
        const analysisResult = await multiAgentSystem.runAnalysis(mcpData.data, { 
            provider,
            analysisId: initialAnalysis.analysis_id 
        });

        if (!analysisResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Ошибка мультиагентного анализа',
                details: analysisResult.error
            });
        }

        // 4. Обновление результатов анализа в БД
        console.log('[AI-Recommendations] 🔍 Результаты анализа для сохранения:', JSON.stringify(analysisResult.results, null, 2));
        const saveResult = await updateAnalysisResults(
            initialAnalysis.analysis_id,
            analysisResult.results
        );

        res.json({
            success: true,
            data: {
                analysis_id: initialAnalysis.analysis_id,
                department_id,
                period: { start: date_start, end: date_end },
                mcp_data: mcpData.data,
                agent_results: analysisResult.results,
                provider: provider,
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
            SELECT id, department_id, date_start, date_end, created_at, provider,
                   jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name') as department_name,
                   jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_company') as organization_name,
                   CASE provider
                       WHEN 'claude' THEN 'CLAUDE'
                       WHEN 'openai' THEN 'CHAT GPT'
                       WHEN 'gemini' THEN 'GEMINI'
                       ELSE UPPER(provider)
                   END as provider_label
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
 * GET /api/admin/ai-recommendations/prompts/:analysisId
 * Получение залогированных промптов для анализа в формате для вкладок
 */
router.get('/prompts/:analysisId', async (req, res) => {
    try {
        const { analysisId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        console.log(`[AI-Recommendations] Запрос логов промптов для анализа ID: ${analysisId}`);

        const query = `
            SELECT 
                id, agent_name, provider, full_prompt, prompt_length,
                system_prompt, response_text, response_length, success, tokens_used,
                request_timestamp, response_timestamp,
                EXTRACT(EPOCH FROM (response_timestamp - request_timestamp)) as response_time_seconds
            FROM ai_prompt_logs 
            WHERE analysis_id = $1
            ORDER BY request_timestamp ASC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [analysisId, limit, offset]);

        // Получаем также информацию об анализе
        const analysisQuery = `
            SELECT id, department_id, date_start, date_end, provider, created_at, agent_results
            FROM ai_recommendations 
            WHERE id = $1
        `;
        const analysisResult = await pool.query(analysisQuery, [analysisId]);

        if (analysisResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Анализ не найден'
            });
        }

        const analysis = analysisResult.rows[0];
        const agentResults = analysis.agent_results || {};

        console.log(`[AI-Recommendations] Agent results type: ${typeof agentResults}`);
        console.log(`[AI-Recommendations] Agent results keys: ${Object.keys(agentResults)}`);

        // Группируем промпты по агентам
        const agentPrompts = {};
        result.rows.forEach(row => {
            agentPrompts[row.agent_name] = {
                id: row.id,
                agent_name: row.agent_name,
                provider: row.provider,
                full_prompt: row.full_prompt,
                system_prompt: row.system_prompt,
                response_text: row.response_text,
                success: row.success,
                tokens_used: row.tokens_used,
                request_timestamp: row.request_timestamp,
                response_timestamp: row.response_timestamp,
                response_time_seconds: row.response_time_seconds
            };
        });

        console.log(`[AI-Recommendations] Agent prompts keys: ${Object.keys(agentPrompts)}`);

        // Конфигурация агентов для UI
        const agentConfig = {
            SalesAnalysisAgent: { icon: '📈', title: 'Аналитик продаж', description: 'Анализ прогнозов и динамики продаж' },
            PayrollAnalysisAgent: { icon: '💰', title: 'Аналитик затрат', description: 'Анализ ФОТ и эффективности персонала' },
            StaffingAgent: { icon: '👥', title: 'Оптимизация смен', description: 'Распределение персонала по часам' },
            ReputationAgent: { icon: '⭐', title: 'Анализ репутации', description: 'Отзывы клиентов и проблемы сервиса' },
            OptimizationAgent: { icon: '🎯', title: 'Консультант оптимизации', description: 'Конкретные шаги улучшения' },
            NarrativeAgent: { icon: '📊', title: 'Бизнес-консультант', description: 'Итоговый отчет для управляющего' }
        };

        // Формируем данные для каждого агента
        let agents = [];
        
        try {
            // Проверяем, что agentResults это объект и не пустой
            if (agentResults && typeof agentResults === 'object' && Object.keys(agentResults).length > 0) {
                agents = Object.entries(agentResults).map(([agentName, result]) => {
                    const config = agentConfig[agentName] || { icon: '🤖', title: agentName, description: 'AI агент' };
                    const prompt = agentPrompts[agentName];
                    const isError = result && result.error || false;
                    const resultText = isError ? (result.message || 'Ошибка выполнения агента') : result;

                    return {
                        id: agentName,
                        name: agentName,
                        title: config.title,
                        icon: config.icon,
                        description: config.description,
                        result: resultText,
                        error: isError,
                        prompt: prompt ? {
                            full_prompt: prompt.full_prompt,
                            system_prompt: prompt.system_prompt,
                            provider: prompt.provider,
                            success: prompt.success,
                            tokens_used: prompt.tokens_used,
                            request_timestamp: prompt.request_timestamp,
                            response_timestamp: prompt.response_timestamp,
                            response_time_seconds: prompt.response_time_seconds
                        } : null
                    };
                });
            } else {
                console.warn('[AI-Recommendations] Agent results is empty or invalid, creating from prompts');
                // Если agentResults пустой, создаем агентов на основе промптов
                agents = Object.entries(agentPrompts).map(([agentName, prompt]) => {
                    const config = agentConfig[agentName] || { icon: '🤖', title: agentName, description: 'AI агент' };
                    
                    return {
                        id: agentName,
                        name: agentName,
                        title: config.title,
                        icon: config.icon,
                        description: config.description,
                        result: prompt.response_text || 'Результат анализа недоступен',
                        error: !prompt.success,
                        prompt: {
                            full_prompt: prompt.full_prompt,
                            system_prompt: prompt.system_prompt,
                            provider: prompt.provider,
                            success: prompt.success,
                            tokens_used: prompt.tokens_used,
                            request_timestamp: prompt.request_timestamp,
                            response_timestamp: prompt.response_timestamp,
                            response_time_seconds: prompt.response_time_seconds
                        }
                    };
                });
            }
        } catch (error) {
            console.error('[AI-Recommendations] Error creating agents array:', error);
            agents = [];
        }

        console.log(`[AI-Recommendations] Final agents count: ${agents.length}`);

        res.json({
            success: true,
            data: {
                analysis: {
                    id: analysis.id,
                    department_id: analysis.department_id,
                    date_start: analysis.date_start,
                    date_end: analysis.date_end,
                    provider: analysis.provider,
                    created_at: analysis.created_at
                },
                agents: agents,
                total: agents.length,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка получения промптов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения залогированных промптов',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/ai-recommendations/providers
 * Получение информации о доступных AI провайдерах
 */
router.get('/providers', async (req, res) => {
    try {
        const { EngineDispatcher } = require('../engines');
        const dispatcher = new EngineDispatcher();
        
        // Получение информации о провайдерах
        const providersInfo = dispatcher.getProvidersInfo();
        
        // Проверка доступности всех провайдеров
        const validation = await dispatcher.validateAllProviders();
        
        res.json({
            success: true,
            data: {
                ...providersInfo,
                availability: validation.results,
                summary: {
                    total_providers: validation.total_providers,
                    available_providers: validation.available_providers,
                    default_provider: validation.default_provider
                }
            }
        });

    } catch (error) {
        console.error('[AI-Recommendations] Ошибка получения информации о провайдерах:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения информации о провайдерах',
            details: error.message
        });
    }
});

/**
 * GET /api/admin/ai-recommendations/prompts
 * Получение промптов агентов
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
 * Создание записи анализа в БД для получения ID
 */
async function createAnalysisRecord(department_id, date_start, date_end, mcpResponse, provider = 'claude') {
    try {
        const query = `
            INSERT INTO ai_recommendations (department_id, date_start, date_end, mcp_response, agent_results, provider, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
        `;
        
        const values = [
            department_id,
            date_start,
            date_end,
            JSON.stringify(mcpResponse),
            JSON.stringify({}), // Пустые результаты агентов пока
            provider
        ];
        
        const result = await pool.query(query, values);
        return { analysis_id: result.rows[0].id };
        
    } catch (error) {
        console.error('[AI-Recommendations] Ошибка создания записи анализа:', error);
        throw error;
    }
}

/**
 * Обновление результатов анализа в БД
 */
async function updateAnalysisResults(analysisId, agentResults) {
    try {
        console.log(`[AI-Recommendations] 💾 Сохранение результатов для анализа ID ${analysisId}`);
        console.log(`[AI-Recommendations] 📋 Данные для сохранения (тип: ${typeof agentResults}):`, agentResults);
        
        const query = `
            UPDATE ai_recommendations 
            SET agent_results = $1
            WHERE id = $2
        `;
        
        const values = [
            JSON.stringify(agentResults),
            analysisId
        ];
        
        const result = await pool.query(query, values);
        console.log(`[AI-Recommendations] ✅ Результат обновления: ${result.rowCount} строк обновлено`);
        return { analysis_id: analysisId };
        
    } catch (error) {
        console.error('[AI-Recommendations] Ошибка обновления результатов анализа:', error);
        throw error;
    }
}

/**
 * Сохранение результатов анализа в БД (устаревшая функция)
 */
async function saveAnalysisResults(department_id, date_start, date_end, mcpResponse, agentResults, provider = 'claude') {
    // Проверяем, есть ли колонка provider в таблице
    let query, values;
    
    try {
        // Пытаемся использовать новый формат с provider
        query = `
            INSERT INTO ai_recommendations (department_id, date_start, date_end, mcp_response, agent_results, provider, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id
        `;
        
        values = [
            department_id,
            date_start,
            date_end,
            JSON.stringify(mcpResponse),
            JSON.stringify(agentResults),
            provider
        ];
        
        const result = await pool.query(query, values);
        return { analysis_id: result.rows[0].id };
        
    } catch (error) {
        // Если колонка provider не существует, используем старый формат
        if (error.message.includes('provider') && error.message.includes('does not exist')) {
            console.log('[AI-Recommendations] Колонка provider не найдена, используем старый формат БД');
            
            query = `
                INSERT INTO ai_recommendations (department_id, date_start, date_end, mcp_response, agent_results, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING id
            `;
            
            values = [
                department_id,
                date_start,
                date_end,
                JSON.stringify(mcpResponse),
                JSON.stringify(agentResults)
            ];
            
            const result = await pool.query(query, values);
            return { analysis_id: result.rows[0].id };
        } else {
            throw error;
        }
    }
}

/**
 * GET /api/admin/ai-recommendations/analysis/:id
 * Получение детального анализа по ID
 */
router.get('/analysis/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT *,
                   jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_name') as department_name,
                   jsonb_extract_path_text(mcp_response, 'department_info', 'data', 'object_company') as organization_name
            FROM ai_recommendations 
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