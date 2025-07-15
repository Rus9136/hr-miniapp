-- Добавление колонки provider в таблицу ai_recommendations
-- Для поддержки мультипровайдерной AI системы

-- Проверяем существование колонки provider
DO $$
BEGIN
    -- Добавляем колонку provider если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ai_recommendations' 
        AND column_name = 'provider'
    ) THEN
        ALTER TABLE ai_recommendations 
        ADD COLUMN provider VARCHAR(50) DEFAULT 'claude';
        
        -- Обновляем существующие записи
        UPDATE ai_recommendations 
        SET provider = 'claude' 
        WHERE provider IS NULL;
        
        RAISE NOTICE 'Колонка provider добавлена в таблицу ai_recommendations';
    ELSE
        RAISE NOTICE 'Колонка provider уже существует в таблице ai_recommendations';
    END IF;
END
$$;