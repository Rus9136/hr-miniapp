const axios = require('axios');
require('dotenv').config();

class MCPClient {
    constructor() {
        this.baseURL = process.env.MCP_API_BASE_URL || 'https://mcp.madlen.space/api/v1';
        this.timeout = 30000; // 30 секунд
    }

    /**
     * Получение данных dashboard от MCP API
     * @param {string} department_id - ID подразделения
     * @param {string} date_start - Начальная дата (YYYY-MM-DD)
     * @param {string} date_end - Конечная дата (YYYY-MM-DD)
     * @param {number} reviews_count - Количество отзывов (по умолчанию 50)
     * @returns {object} Результат запроса с данными или ошибкой
     */
    async getDashboardData(department_id, date_start, date_end, reviews_count = 50) {
        try {
            console.log(`[MCP-Client] Запрос данных для подразделения ${department_id}, период: ${date_start} - ${date_end}`);

            const requestPayload = {
                department_id,
                date_start,
                date_end,
                reviews_count
            };

            const response = await axios.post(
                `${this.baseURL}/mcp/dashboard`,
                requestPayload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            // Проверка успешности ответа
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = response.data;

            // Логирование метаданных ответа
            if (data.metadata) {
                console.log(`[MCP-Client] Успешно получены данные:`, {
                    successful_requests: data.metadata.successful_requests,
                    failed_requests: data.metadata.failed_requests,
                    total_requests: data.metadata.total_requests
                });
            }

            // Проверка наличия основных секций данных
            const requiredSections = ['forecast', 'plan_vs_fact', 'hourly_sales', 'payroll', 'department_info'];
            const missingSections = requiredSections.filter(section => !data[section]);

            if (missingSections.length > 0) {
                console.warn(`[MCP-Client] Отсутствуют секции данных: ${missingSections.join(', ')}`);
            }

            // Проверка ошибок в секциях
            const sectionsWithErrors = Object.keys(data)
                .filter(key => data[key] && data[key].error)
                .map(key => ({ section: key, error: data[key].error }));

            if (sectionsWithErrors.length > 0) {
                console.warn(`[MCP-Client] Ошибки в секциях:`, sectionsWithErrors);
            }

            return {
                success: true,
                data: data,
                metadata: {
                    request_time: new Date().toISOString(),
                    department_id,
                    period: { start: date_start, end: date_end },
                    reviews_count,
                    sections_with_errors: sectionsWithErrors.length > 0 ? sectionsWithErrors : null
                }
            };

        } catch (error) {
            console.error('[MCP-Client] Ошибка запроса к MCP API:', error.message);

            // Детальная обработка различных типов ошибок
            let errorDetails = {
                type: 'unknown_error',
                message: error.message
            };

            if (error.response) {
                // Ошибка HTTP ответа
                errorDetails = {
                    type: 'http_error',
                    status: error.response.status,
                    statusText: error.response.statusText,
                    message: error.response.data?.message || error.message,
                    data: error.response.data
                };
            } else if (error.request) {
                // Ошибка сети (нет ответа)
                errorDetails = {
                    type: 'network_error',
                    message: 'Нет ответа от MCP API',
                    timeout: error.code === 'ECONNABORTED'
                };
            } else {
                // Ошибка настройки запроса
                errorDetails = {
                    type: 'request_error',
                    message: error.message
                };
            }

            return {
                success: false,
                error: errorDetails,
                metadata: {
                    request_time: new Date().toISOString(),
                    department_id,
                    period: { start: date_start, end: date_end },
                    reviews_count
                }
            };
        }
    }

    /**
     * Тест соединения с MCP API
     * @returns {object} Результат теста соединения
     */
    async testConnection() {
        try {
            const testDepartmentId = '4cb558ca-a8bc-4b81-871e-043f65218c50';
            const testDateStart = '2025-07-10';
            const testDateEnd = '2025-07-11';

            console.log('[MCP-Client] Тестирование соединения с MCP API...');

            const result = await this.getDashboardData(testDepartmentId, testDateStart, testDateEnd, 5);

            if (result.success) {
                console.log('[MCP-Client] ✅ Соединение с MCP API успешно');
                return {
                    success: true,
                    message: 'Соединение с MCP API успешно',
                    test_data: result.metadata
                };
            } else {
                console.log('[MCP-Client] ❌ Ошибка соединения с MCP API');
                return {
                    success: false,
                    message: 'Ошибка соединения с MCP API',
                    error: result.error
                };
            }

        } catch (error) {
            console.error('[MCP-Client] Критическая ошибка тестирования:', error);
            return {
                success: false,
                message: 'Критическая ошибка тестирования соединения',
                error: error.message
            };
        }
    }

    /**
     * Получение списка доступных подразделений (если такой endpoint существует)
     * @returns {object} Список подразделений или ошибка
     */
    async getDepartments() {
        try {
            console.log('[MCP-Client] Запрос списка подразделений...');

            // Это предполагаемый endpoint - может не существовать
            const response = await axios.get(
                `${this.baseURL}/departments`,
                {
                    timeout: this.timeout
                }
            );

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.warn('[MCP-Client] Endpoint departments недоступен:', error.message);
            return {
                success: false,
                error: 'Endpoint для получения списка подразделений недоступен',
                details: error.message
            };
        }
    }
}

module.exports = MCPClient;