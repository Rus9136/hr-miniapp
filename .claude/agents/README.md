# HR Time Tracking - Claude Code Agents

Система специализированных субагентов для автоматизации разработки и поддержки HR Time Tracking системы.

## 🎯 Обзор системы агентов

Каждый агент специализируется на определенной области и содержит:
- **Роль и ответственности** - четкое определение задач
- **Специализация** - технические области экспертизы  
- **Процедуры** - пошаговые инструкции выполнения задач
- **Шаблоны отчетов** - стандартизированные форматы результатов
- **Контекст проекта** - специфические знания о HR системе

## 📋 Доступные агенты

### 1. 🔍 Code Review Agent (`code-reviewer.md`)
**Цель**: Обеспечение качества кода и соответствия best practices

**Основные функции**:
- Ревью безопасности (SQL injection, XSS защита)
- Архитектурный анализ (separation of concerns, error handling)
- Производительность (query optimization, async/await)
- Качество кода (DRY, readability, type safety)

**Когда использовать**:
```bash
# Пример вызова
/code-review backend/routes/ai-recommendations.js
/code-review --security frontend/admin.js  
/code-review --performance backend/database.js
```

### 2. 🛡️ Security Audit Agent (`security-auditor.md`)
**Цель**: Комплексный аудит безопасности системы

**Основные функции**:
- Authentication & Authorization (ИИН-based auth, admin access)
- API Security (input validation, rate limiting)
- Data Protection (ПДн защита, encryption)
- Infrastructure Security (Docker, nginx, HTTPS)

**Когда использовать**:
```bash
# Примеры вызова
/security-audit --full-scan
/security-audit --api-endpoints /api/admin/*
/security-audit --data-protection employees table
```

### 3. 🗄️ Database Migration Manager (`database-migration-manager.md`)
**Цель**: Безопасное управление схемой БД и миграциями

**Основные функции**:
- Migration planning (impact assessment, rollback strategy)
- Schema evolution (backward compatibility, constraints)
- Data quality (integrity, consistency, validation)
- Performance optimization (indexing, query analysis)

**Когда использовать**:
```bash
# Примеры вызова
/db-migrate --plan add_ai_provider_column
/db-migrate --analyze performance_issues
/db-migrate --rollback 015_last_migration
```

### 4. 🤖 AI System Optimizer (`ai-system-optimizer.md`)
**Цель**: Оптимизация мультиагентной AI системы

**Основные функции**:
- Prompt engineering (optimization, consistency, token management)
- Performance optimization (response time, cost optimization)
- Provider management (load balancing, failover)
- Error handling (circuit breakers, retry strategies)

**Когда использовать**:
```bash
# Примеры вызова
/ai-optimize --prompt-analysis SalesAnalysisAgent
/ai-optimize --cost-reduction claude provider
/ai-optimize --performance-tuning all-agents
```

### 5. 🐳 Docker Deployment Manager (`docker-deployment-manager.md`)
**Цель**: Управление контейнеризацией и развертыванием

**Основные функции**:
- Container optimization (image size, build performance)
- Orchestration (service dependencies, networking)
- Production operations (zero-downtime deployment, rollback)
- Security (container security, secrets management)

**Когда использовать**:
```bash
# Примеры вызова
/docker-deploy --production madlen.space
/docker-deploy --optimize container-size
/docker-deploy --rollback previous-version
```

### 6. 🧪 API Testing Specialist (`api-testing-specialist.md`)
**Цель**: Автоматизация тестирования REST API

**Основные функции**:
- Functional testing (authentication, employee data, AI system)
- Performance testing (load testing, benchmarks)
- Security testing (input validation, authorization)
- Integration testing (external APIs, database)

**Когда использовать**:
```bash
# Примеры вызова
/api-test --functional /api/login
/api-test --performance --load=50rps
/api-test --security --scan-endpoints
```

### 7. 📚 Documentation Maintainer (`documentation-maintainer.md`)
**Цель**: Поддержание качественной документации

**Основные функции**:
- Content management (accuracy, completeness, consistency)
- API documentation (OpenAPI generation, examples)
- User guides (step-by-step instructions)
- Documentation automation (validation, deployment)

**Когда использовать**:
```bash
# Примеры вызова
/docs-update --api-changes backend/routes/
/docs-update --validate broken-links
/docs-update --generate api-reference
```

### 8. 📊 Performance Monitor (`performance-monitor.md`)
**Цель**: Мониторинг производительности и оптимизация

**Основные функции**:
- Application monitoring (Node.js, memory, event loop)
- Database performance (PostgreSQL queries, connections)
- Infrastructure monitoring (Docker, nginx, resources)
- AI system performance (response times, token usage, costs)

**Когда использовать**:
```bash
# Примеры вызова
/perf-monitor --analyze-bottlenecks
/perf-monitor --database-optimization
/perf-monitor --ai-cost-analysis
```

## 🚀 Как использовать агентов

### 1. Прямой вызов через Claude Code
```bash
# Активация агента с конкретной задачей
/code-review Проанализируй безопасность в backend/routes/auth.js
/security-audit Проведи аудит API эндпоинтов админ-панели
/db-migrate Создай план миграции для добавления индексов
```

### 2. Использование в рабочем процессе

#### Pull Request Review
```bash
# Автоматический ревью при создании PR
git checkout feature/new-ai-provider
/code-review --diff main..feature/new-ai-provider
/security-audit --changed-files
/api-test --affected-endpoints
```

#### Deployment Pipeline
```bash
# Пре-деплой проверки
/perf-monitor --pre-deployment-check
/db-migrate --validate pending-migrations
/docker-deploy --pre-flight-checks

# Пост-деплой мониторинг  
/perf-monitor --post-deployment-analysis
/api-test --smoke-tests production
```

#### Регулярное обслуживание
```bash
# Еженедельные задачи
/perf-monitor --weekly-report
/security-audit --vulnerability-scan
/docs-update --content-review

# Ежемесячные задачи
/ai-optimize --cost-analysis monthly
/db-migrate --performance-review
/docker-deploy --security-updates
```

## 🎨 Интеграция с рабочим процессом

### GitHub Actions Integration
```yaml
# .github/workflows/claude-agents.yml
name: Claude Agents

on:
  pull_request:
    branches: [ main ]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Code Review
        run: claude-code "/code-review --pr ${{ github.event.number }}"
        
  security-audit:
    runs-on: ubuntu-latest  
    steps:
      - name: Security Audit
        run: claude-code "/security-audit --changed-files"
```

### VS Code Integration
```json
// .vscode/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Code Review Current File",
            "type": "shell",
            "command": "claude-code",
            "args": ["/code-review ${file}"],
            "group": "build"
        },
        {
            "label": "Performance Analysis",
            "type": "shell", 
            "command": "claude-code",
            "args": ["/perf-monitor --analyze-current-state"],
            "group": "test"
        }
    ]
}
```

## 📋 Шаблон создания нового агента

При необходимости создания нового специализированного агента используйте следующий шаблон:

```markdown
# [Agent Name] Agent

Специализированный агент для [specific purpose] HR Time Tracking системы.

## Роль и ответственности
[Clear definition of the agent's role]

## Специализация
- **[Area 1]**: [Description]
- **[Area 2]**: [Description]

## [Specific context sections relevant to the agent]

## Процесс [main process]
[Step-by-step procedure]

## Формат отчета
[Standardized report template]

## [Agent-specific sections]

Помни: [key reminders specific to this agent's domain]
```

## 🔧 Настройка и конфигурация

### Переменные окружения для агентов
```bash
# .env.agents
CLAUDE_AGENTS_LOG_LEVEL=info
CLAUDE_AGENTS_REPORT_FORMAT=markdown
CLAUDE_AGENTS_AUTO_DOCS=true
CLAUDE_AGENTS_NOTIFICATIONS=slack

# Specific agent configurations
CODE_REVIEW_RULES=.claude/agents/code-review-rules.json
SECURITY_AUDIT_SCOPE=.claude/agents/security-scope.json  
PERF_MONITOR_THRESHOLDS=.claude/agents/perf-thresholds.json
```

### Конфигурационные файлы
```json
// .claude/agents/config.json
{
  "agents": {
    "code-reviewer": {
      "enabled": true,
      "auto_trigger": ["*.js", "*.sql"],
      "report_format": "markdown",
      "severity_levels": ["critical", "warning", "info"]
    },
    "security-auditor": {
      "enabled": true,
      "scan_schedule": "weekly",
      "compliance_standards": ["OWASP", "GDPR"],
      "alert_channels": ["slack", "email"]
    }
  }
}
```

## 📊 Метрики эффективности агентов

### Отслеживаемые метрики
- **Code Review**: Количество найденных проблем, время ревью
- **Security Audit**: Найденные уязвимости, время устранения  
- **Performance Monitor**: Время выявления bottlenecks, улучшения производительности
- **Documentation**: Покрытие документации, актуальность контента

### Дашборд агентов
```bash
# Просмотр статистики использования агентов
/agents-stats --last-30-days
/agents-effectiveness --by-category
/agents-report --summary
```

---

## 🎯 Заключение

Система агентов Claude Code для HR Time Tracking обеспечивает:

✅ **Автоматизацию** рутинных задач разработки  
✅ **Стандартизацию** процессов качества  
✅ **Специализацию** знаний в контексте проекта  
✅ **Масштабируемость** команды разработки  
✅ **Консистентность** результатов работы  

Каждый агент содержит глубокие знания о специфике HR системы и может быть использован как опытный коллега-специалист в соответствующей области.

**Помните**: Агенты созданы для усиления человеческих возможностей, а не их замещения. Они предоставляют экспертные рекомендации, которые должны быть проверены и адаптированы под конкретную ситуацию.