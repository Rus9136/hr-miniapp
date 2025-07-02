import pytest
import requests
import json
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

# Test configuration
API_BASE_URL = "http://localhost:3030/api"
DB_CONFIG = {
    'host': 'localhost',
    'database': 'hr_tracker',
    'user': 'hr_user',
    'password': 'hr_password',
    'port': 5432
}

class TestScheduleAssignment:
    """
    Тесты для функции назначения графиков работы сотрудникам
    Тестирует API эндпоинт POST /api/admin/schedules/assign
    """
    
    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self):
        """Подготовка тестовых данных и очистка после тестов"""
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.conn.autocommit = True
        self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        # Создаем тестовые данные
        self.setup_test_data()
        
        yield
        
        # Очистка после тестов
        self.cleanup_test_data()
        self.cursor.close()
        self.conn.close()
    
    def setup_test_data(self):
        """Создание тестовых данных"""
        # Создаем тестовое подразделение
        self.cursor.execute("""
            INSERT INTO departments (object_code, object_name, object_company, object_bin)
            VALUES ('TEST_DEPT_001', 'Тестовое подразделение', 'Тестовая компания', '123456789012')
            ON CONFLICT (object_code) DO NOTHING
        """)
        
        # Создаем тестовую должность
        self.cursor.execute("""
            INSERT INTO positions (staff_position_code, staff_position_name, object_bin)
            VALUES ('TEST_POS_001', 'Тестовая должность', '123456789012')
            ON CONFLICT (staff_position_code) DO NOTHING
        """)
        
        # Создаем тестовых сотрудников
        test_employees = [
            ('TEST_EMP_001', 'Иванов Иван Иванович'),
            ('TEST_EMP_002', 'Петров Петр Петрович'),
            ('TEST_EMP_003', 'Сидоров Сидор Сидорович')
        ]
        
        for table_number, full_name in test_employees:
            self.cursor.execute("""
                INSERT INTO employees (object_code, staff_position_code, table_number, full_name, status, object_bin)
                VALUES ('TEST_DEPT_001', 'TEST_POS_001', %s, %s, 1, '123456789012')
                ON CONFLICT (table_number) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    status = EXCLUDED.status
            """, (table_number, full_name))
        
        # Получаем ID созданных сотрудников
        self.cursor.execute("""
            SELECT id, table_number FROM employees 
            WHERE table_number IN ('TEST_EMP_001', 'TEST_EMP_002', 'TEST_EMP_003')
        """)
        self.test_employees = {row['table_number']: row['id'] for row in self.cursor.fetchall()}
        
        # Создаем тестовый шаблон графика
        self.cursor.execute("""
            INSERT INTO work_schedule_templates (name, description, check_in_time, check_out_time, is_active)
            VALUES ('Тестовый график', 'График для тестирования', '09:00', '18:00', true)
            RETURNING id
        """)
        self.test_template_id = self.cursor.fetchone()['id']
        
        # Создаем второй тестовый шаблон для тестов конфликтов
        self.cursor.execute("""
            INSERT INTO work_schedule_templates (name, description, check_in_time, check_out_time, is_active)
            VALUES ('Старый тестовый график', 'Старый график для тестов конфликтов', '08:00', '17:00', true)
            RETURNING id
        """)
        self.old_template_id = self.cursor.fetchone()['id']
    
    def cleanup_test_data(self):
        """Очистка тестовых данных"""
        # Удаляем в правильном порядке из-за внешних ключей
        self.cursor.execute("DELETE FROM employee_schedule_history WHERE employee_id IN %s", 
                          (tuple(self.test_employees.values()),))
        self.cursor.execute("DELETE FROM work_schedule_dates WHERE template_id IN %s", 
                          (self.test_template_id, self.old_template_id))
        self.cursor.execute("DELETE FROM work_schedule_templates WHERE id IN %s", 
                          (self.test_template_id, self.old_template_id))
        self.cursor.execute("DELETE FROM employees WHERE table_number LIKE 'TEST_EMP_%'")
        self.cursor.execute("DELETE FROM positions WHERE staff_position_code = 'TEST_POS_001'")
        self.cursor.execute("DELETE FROM departments WHERE object_code = 'TEST_DEPT_001'")

    def test_successful_schedule_assignment(self):
        """
        Тест 1: Успешное назначение графика нескольким сотрудникам
        """
        # Подготовка данных для запроса
        payload = {
            "template_id": self.test_template_id,
            "employee_ids": [
                self.test_employees['TEST_EMP_001'],
                self.test_employees['TEST_EMP_002']
            ],
            "start_date": "2025-07-01",
            "assigned_by": "test_admin"
        }
        
        # Выполнение запроса
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Проверка ответа
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert result["assignedCount"] == 2
        assert result["skippedCount"] == 0
        assert "Тестовый график" in result["message"]
        assert "назначен 2 сотрудникам" in result["message"]
        
        # Проверка данных в базе
        self.cursor.execute("""
            SELECT esh.*, e.table_number, wst.name as template_name
            FROM employee_schedule_history esh
            JOIN employees e ON esh.employee_id = e.id
            JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE esh.template_id = %s AND e.table_number IN ('TEST_EMP_001', 'TEST_EMP_002')
        """, (self.test_template_id,))
        
        assignments = self.cursor.fetchall()
        assert len(assignments) == 2
        
        for assignment in assignments:
            assert assignment['template_name'] == 'Тестовый график'
            assert assignment['start_date'].strftime('%Y-%m-%d') == '2025-07-01'
            assert assignment['end_date'] is None  # Активный график
            assert assignment['assigned_by'] == 'test_admin'

    def test_schedule_conflict_resolution(self):
        """
        Тест 2: Корректная обработка конфликтов при перезаписи существующих графиков
        """
        # Сначала назначаем старый график одному сотруднику
        old_payload = {
            "template_id": self.old_template_id,
            "employee_ids": [self.test_employees['TEST_EMP_001']],
            "start_date": "2025-06-15",
            "assigned_by": "test_admin"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=old_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        # Теперь назначаем новый график, который должен перезаписать старый
        new_payload = {
            "template_id": self.test_template_id,
            "employee_ids": [self.test_employees['TEST_EMP_001']],
            "start_date": "2025-07-01",
            "assigned_by": "test_admin"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=new_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Проверка ответа
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["assignedCount"] == 1
        
        # Проверка, что старый график завершен, а новый активен
        self.cursor.execute("""
            SELECT esh.*, wst.name as template_name
            FROM employee_schedule_history esh
            JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE esh.employee_id = %s
            ORDER BY esh.start_date
        """, (self.test_employees['TEST_EMP_001'],))
        
        schedules = self.cursor.fetchall()
        assert len(schedules) == 2
        
        # Старый график должен быть завершен
        old_schedule = schedules[0]
        assert old_schedule['template_name'] == 'Старый тестовый график'
        assert old_schedule['end_date'] is not None
        assert old_schedule['end_date'].strftime('%Y-%m-%d') == '2025-06-30'  # Завершен за день до нового
        
        # Новый график должен быть активен
        new_schedule = schedules[1]
        assert new_schedule['template_name'] == 'Тестовый график'
        assert new_schedule['start_date'].strftime('%Y-%m-%d') == '2025-07-01'
        assert new_schedule['end_date'] is None  # Активный

    def test_validation_and_error_handling(self):
        """
        Тест 3: Валидация данных и обработка ошибок
        """
        # Тест 3.1: Отсутствующие обязательные поля
        invalid_payloads = [
            # Нет template_id
            {
                "employee_ids": [self.test_employees['TEST_EMP_001']],
                "start_date": "2025-07-01"
            },
            # Нет employee_ids
            {
                "template_id": self.test_template_id,
                "start_date": "2025-07-01"
            },
            # Нет start_date
            {
                "template_id": self.test_template_id,
                "employee_ids": [self.test_employees['TEST_EMP_001']]
            },
            # Пустой массив сотрудников
            {
                "template_id": self.test_template_id,
                "employee_ids": [],
                "start_date": "2025-07-01"
            }
        ]
        
        for payload in invalid_payloads:
            response = requests.post(
                f"{API_BASE_URL}/admin/schedules/assign",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            assert response.status_code == 400
            result = response.json()
            assert result["success"] is False
            assert "error" in result
        
        # Тест 3.2: Несуществующий шаблон графика
        payload_invalid_template = {
            "template_id": 99999,  # Несуществующий ID
            "employee_ids": [self.test_employees['TEST_EMP_001']],
            "start_date": "2025-07-01"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=payload_invalid_template,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400
        result = response.json()
        assert result["success"] is False
        assert "не найден" in result["error"]
        
        # Тест 3.3: Частично несуществующие сотрудники
        payload_mixed_employees = {
            "template_id": self.test_template_id,
            "employee_ids": [
                self.test_employees['TEST_EMP_001'],  # Существующий
                99999  # Несуществующий
            ],
            "start_date": "2025-07-01"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=payload_mixed_employees,
            headers={"Content-Type": "application/json"}
        )
        
        # Должен быть успех с частичным результатом
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["assignedCount"] == 1
        assert result["skippedCount"] == 1
        assert "пропущено 1 сотрудников" in result["message"]
        
        # Проверяем, что успешный сотрудник получил график
        self.cursor.execute("""
            SELECT COUNT(*) as count FROM employee_schedule_history 
            WHERE employee_id = %s AND template_id = %s
        """, (self.test_employees['TEST_EMP_001'], self.test_template_id))
        
        assert self.cursor.fetchone()['count'] == 1


if __name__ == "__main__":
    # Для запуска тестов: python test_schedule_assignment.py
    pytest.main([__file__, "-v"])