/**
 * Модуль управления организациями
 * Эндпоинты: /admin/organizations
 */

const express = require('express');
const router = express.Router();
const db = require('../../database_pg');

/**
 * GET /admin/organizations
 * Получение списка организаций для выпадающего списка (из таблицы organizations)
 */
router.get('/', async (req, res) => {
    try {
        const rows = await db.queryRows(`
            SELECT
                id,
                object_bin,
                object_company,
                iiko_department_ids,
                is_active
            FROM organizations
            WHERE is_active = true
            ORDER BY object_company
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching organizations:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /admin/organizations/full
 * Получение полного списка организаций с iiko_department_ids
 */
router.get('/full', async (req, res) => {
    try {
        const rows = await db.queryRows(`
            SELECT
                o.id,
                o.object_bin,
                o.object_company,
                o.iiko_department_ids,
                o.is_active,
                o.created_at,
                o.updated_at,
                (SELECT COUNT(*) FROM departments d WHERE d.object_bin = o.object_bin) as departments_count
            FROM organizations o
            ORDER BY o.object_company
        `);
        res.json({
            success: true,
            organizations: rows,
            total: rows.length
        });
    } catch (err) {
        console.error('Error fetching full organizations:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /admin/organizations/:id
 * Получение организации по ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await db.queryRows(`
            SELECT
                o.id,
                o.object_bin,
                o.object_company,
                o.iiko_department_ids,
                o.is_active,
                o.created_at,
                o.updated_at,
                (SELECT COUNT(*) FROM departments d WHERE d.object_bin = o.object_bin) as departments_count
            FROM organizations o
            WHERE o.id = $1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Организация не найдена' });
        }

        res.json({
            success: true,
            organization: rows[0]
        });
    } catch (err) {
        console.error('Error fetching organization:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /admin/organizations
 * Создание новой организации
 */
router.post('/', async (req, res) => {
    try {
        const { object_bin, object_company, iiko_department_ids, is_active } = req.body;

        // Валидация обязательных полей
        if (!object_bin || !object_bin.trim()) {
            return res.status(400).json({
                success: false,
                error: 'БИН организации обязателен'
            });
        }

        if (!object_company || !object_company.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Название организации обязательно'
            });
        }

        // Проверка уникальности БИН
        const existing = await db.queryRow(
            'SELECT id FROM organizations WHERE object_bin = $1',
            [object_bin.trim()]
        );

        if (existing) {
            return res.status(400).json({
                success: false,
                error: `Организация с БИН ${object_bin} уже существует`
            });
        }

        // Валидация iiko_department_ids если есть
        let cleanedIds = [];
        if (iiko_department_ids && Array.isArray(iiko_department_ids)) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            for (const uuid of iiko_department_ids) {
                if (uuid && uuid.trim()) {
                    if (!uuidRegex.test(uuid.trim())) {
                        return res.status(400).json({
                            success: false,
                            error: `Некорректный UUID формат: ${uuid}`
                        });
                    }
                    cleanedIds.push(uuid.trim());
                }
            }
        }

        // Создание организации
        const result = await db.query(`
            INSERT INTO organizations (object_bin, object_company, iiko_department_ids, is_active)
            VALUES ($1, $2, $3::jsonb, $4)
            RETURNING *
        `, [
            object_bin.trim(),
            object_company.trim(),
            JSON.stringify(cleanedIds),
            is_active !== undefined ? is_active : true
        ]);

        console.log(`Organization created:`, result.rows[0]);

        res.status(201).json({
            success: true,
            message: 'Организация успешно создана',
            organization: result.rows[0]
        });
    } catch (err) {
        console.error('Error creating organization:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * PUT /admin/organizations/:id
 * Обновление организации
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { object_company, iiko_department_ids, is_active } = req.body;

        // Validate iiko_department_ids if provided
        if (iiko_department_ids !== undefined) {
            if (!Array.isArray(iiko_department_ids)) {
                return res.status(400).json({
                    success: false,
                    error: 'iiko_department_ids должен быть массивом UUID'
                });
            }

            // Validate each UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            for (const uuid of iiko_department_ids) {
                if (uuid && !uuidRegex.test(uuid)) {
                    return res.status(400).json({
                        success: false,
                        error: `Некорректный UUID формат: ${uuid}`
                    });
                }
            }
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (object_company !== undefined && object_company.trim()) {
            updates.push(`object_company = $${paramIndex}`);
            params.push(object_company.trim());
            paramIndex++;
        }

        if (iiko_department_ids !== undefined) {
            // Filter out empty strings and nulls
            const cleanedIds = iiko_department_ids.filter(id => id && id.trim() !== '');
            updates.push(`iiko_department_ids = $${paramIndex}::jsonb`);
            params.push(JSON.stringify(cleanedIds));
            paramIndex++;
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex}`);
            params.push(is_active);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        if (updates.length === 1) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных для обновления'
            });
        }

        params.push(id);

        const result = await db.query(`
            UPDATE organizations
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Организация не найдена' });
        }

        console.log(`Organization ${id} updated:`, { object_company, iiko_department_ids, is_active });

        res.json({
            success: true,
            message: 'Организация успешно обновлена',
            organization: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating organization:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * DELETE /admin/organizations/:id
 * Удаление организации (полное удаление)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования организации
        const org = await db.queryRow('SELECT * FROM organizations WHERE id = $1', [id]);
        if (!org) {
            return res.status(404).json({
                success: false,
                error: 'Организация не найдена'
            });
        }

        // Проверка связанных подразделений
        const deptCount = await db.queryRow(
            'SELECT COUNT(*) as count FROM departments WHERE object_bin = $1',
            [org.object_bin]
        );

        if (deptCount && parseInt(deptCount.count) > 0) {
            return res.status(400).json({
                success: false,
                error: `Невозможно удалить организацию. К ней привязано ${deptCount.count} подразделений. Сначала удалите или переназначьте подразделения.`
            });
        }

        // Удаление связей с графиками
        await db.query(
            'DELETE FROM schedule_organizations WHERE organization_bin = $1',
            [org.object_bin]
        );

        // Удаление организации
        const result = await db.query('DELETE FROM organizations WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Организация не найдена' });
        }

        console.log(`Organization ${id} (${org.object_company}) deleted`);

        res.json({
            success: true,
            message: 'Организация успешно удалена'
        });
    } catch (err) {
        console.error('Error deleting organization:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;



