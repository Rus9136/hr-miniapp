-- Таблица для логирования автоматической загрузки табелей
CREATE TABLE IF NOT EXISTS cron_timesheet_logs (
    id SERIAL PRIMARY KEY,
    run_date TIMESTAMP DEFAULT NOW(),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    organization_bin VARCHAR(50),
    organization_name VARCHAR(255),
    events_loaded INTEGER DEFAULT 0,
    records_processed INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'partial', 'running')),
    error_message TEXT,
    duration_seconds INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cron_logs_run_date ON cron_timesheet_logs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_timesheet_logs(status);
CREATE INDEX IF NOT EXISTS idx_cron_logs_org ON cron_timesheet_logs(organization_bin);

-- Комментарии
COMMENT ON TABLE cron_timesheet_logs IS 'Логи автоматической загрузки табельных данных';
COMMENT ON COLUMN cron_timesheet_logs.status IS 'Статус выполнения: success, error, partial, running';
COMMENT ON COLUMN cron_timesheet_logs.duration_seconds IS 'Длительность выполнения в секундах';
