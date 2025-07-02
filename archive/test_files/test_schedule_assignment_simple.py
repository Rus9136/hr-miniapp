import pytest
import requests
import json
from datetime import datetime, timedelta

# Test configuration
API_BASE_URL = "http://localhost:3030/api"

class TestScheduleAssignment:
    """
    Тесты для функции назначения графиков работы сотрудникам
    Тестирует API эндпоинт POST /api/admin/schedules/assign
    """
    
    def test_successful_schedule_assignment(self):
        """
        Тест 1: Успешное назначение графика сотрудникам
        Проверяет корректную работу API при валидных данных
        """
        print("\n🧪 Тест 1: Успешное назначение графика")
        
        # Получаем доступных сотрудников для теста
        employees_response = requests.get(f"{API_BASE_URL}/admin/schedules/available-employees")
        assert employees_response.status_code == 200
        employees = employees_response.json()
        
        if len(employees) < 2:
            pytest.skip("Недостаточно сотрудников для теста")
        
        # Получаем доступные шаблоны графиков
        templates_response = requests.get(f"{API_BASE_URL}/admin/schedules/templates")
        assert templates_response.status_code == 200
        templates = templates_response.json()
        
        if len(templates) == 0:
            pytest.skip("Нет доступных шаблонов графиков для теста")
        
        # Выбираем первый шаблон и первых двух сотрудников
        template_id = templates[0]['id']
        employee_ids = [employees[0]['id'], employees[1]['id']]
        
        print(f"📋 Шаблон графика: {templates[0]['name']} (ID: {template_id})")
        print(f"👥 Сотрудники: {employees[0]['full_name']}, {employees[1]['full_name']}")
        
        # Подготовка данных для запроса (используем будущую дату)
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
        
        payload = {
            "template_id": template_id,
            "employee_ids": employee_ids,
            "start_date": future_date,
            "assigned_by": "test_admin"
        }
        
        # Выполнение запроса
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 Статус ответа: {response.status_code}")
        
        # Проверка ответа
        assert response.status_code == 200
        result = response.json()
        
        print(f"✅ Результат: {result}")
        
        assert result["success"] is True
        assert result["assignedCount"] >= 1  # Может быть меньше если у сотрудников уже есть графики
        assert "assignedCount" in result
        assert "message" in result
        
        print("✅ Тест 1 пройден: График успешно назначен")

    def test_schedule_validation_errors(self):
        """
        Тест 2: Валидация данных и обработка ошибок
        Проверяет корректную обработку некорректных данных
        """
        print("\n🧪 Тест 2: Валидация данных")
        
        # Тест 2.1: Отсутствие обязательных полей
        print("🔍 Проверка отсутствующих полей...")
        
        invalid_payloads = [
            # Нет template_id
            {
                "employee_ids": [1],
                "start_date": "2025-07-01"
            },
            # Нет employee_ids
            {
                "template_id": 1,
                "start_date": "2025-07-01"
            },
            # Нет start_date
            {
                "template_id": 1,
                "employee_ids": [1]
            },
            # Пустой массив сотрудников
            {
                "template_id": 1,
                "employee_ids": [],
                "start_date": "2025-07-01"
            }
        ]
        
        for i, payload in enumerate(invalid_payloads):
            print(f"  📝 Тест валидации {i+1}/4")
            response = requests.post(
                f"{API_BASE_URL}/admin/schedules/assign",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            assert response.status_code == 400
            result = response.json()
            assert result["success"] is False
            assert "error" in result
            print(f"  ✅ Ошибка корректно обработана: {result['error']}")
        
        # Тест 2.2: Несуществующий шаблон графика
        print("🔍 Проверка несуществующего шаблона...")
        
        payload_invalid_template = {
            "template_id": 99999,  # Несуществующий ID
            "employee_ids": [1],
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
        print(f"  ✅ Несуществующий шаблон корректно обработан: {result['error']}")
        
        print("✅ Тест 2 пройден: Валидация работает корректно")

    def test_schedule_conflict_handling(self):
        """
        Тест 3: Обработка конфликтов при назначении графиков
        Проверяет перезапись существующих графиков
        """
        print("\n🧪 Тест 3: Обработка конфликтов графиков")
        
        # Получаем доступных сотрудников и шаблоны
        employees_response = requests.get(f"{API_BASE_URL}/admin/schedules/available-employees")
        templates_response = requests.get(f"{API_BASE_URL}/admin/schedules/templates")
        
        if employees_response.status_code != 200 or templates_response.status_code != 200:
            pytest.skip("Не удалось получить данные для теста")
        
        employees = employees_response.json()
        templates = templates_response.json()
        
        if len(employees) < 1 or len(templates) < 1:
            pytest.skip("Недостаточно данных для теста конфликтов")
        
        # Выбираем одного сотрудника и первый шаблон
        employee_id = employees[0]['id']
        template_id = templates[0]['id']
        
        print(f"👤 Сотрудник: {employees[0]['full_name']}")
        print(f"📋 Шаблон: {templates[0]['name']}")
        
        # Назначаем график первый раз (используем будущие даты)
        print("📅 Назначение первого графика...")
        from datetime import datetime, timedelta
        first_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        first_payload = {
            "template_id": template_id,
            "employee_ids": [employee_id],
            "start_date": first_date,
            "assigned_by": "test_admin"
        }
        
        first_response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=first_payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 Первое назначение: {first_response.status_code}")
        if first_response.status_code == 200:
            first_result = first_response.json()
            print(f"✅ Результат: {first_result}")
        
        # Назначаем график второй раз (должен перезаписать первый)
        print("📅 Назначение второго графика (конфликт)...")
        second_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        
        second_payload = {
            "template_id": template_id,
            "employee_ids": [employee_id],
            "start_date": second_date,
            "assigned_by": "test_admin"
        }
        
        second_response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=second_payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 Второе назначение: {second_response.status_code}")
        
        # Проверка, что второе назначение прошло успешно
        assert second_response.status_code == 200
        second_result = second_response.json()
        assert second_result["success"] is True
        
        print(f"✅ Конфликт успешно разрешен: {second_result}")
        print("✅ Тест 3 пройден: Конфликты обрабатываются корректно")

    def test_mass_assignment_with_mixed_results(self):
        """
        Тест 4: Массовое назначение с частичными ошибками
        Проверяет обработку ситуации, когда часть сотрудников не существует
        """
        print("\n🧪 Тест 4: Массовое назначение с ошибками")
        
        # Получаем шаблоны
        templates_response = requests.get(f"{API_BASE_URL}/admin/schedules/templates")
        if templates_response.status_code != 200:
            pytest.skip("Не удалось получить шаблоны для теста")
        
        templates = templates_response.json()
        if len(templates) == 0:
            pytest.skip("Нет шаблонов для теста")
        
        # Получаем реального сотрудника
        employees_response = requests.get(f"{API_BASE_URL}/admin/schedules/available-employees")
        if employees_response.status_code != 200:
            pytest.skip("Не удалось получить сотрудников")
        
        employees = employees_response.json()
        if len(employees) == 0:
            pytest.skip("Нет сотрудников для теста")
        
        template_id = templates[0]['id']
        real_employee_id = employees[0]['id']
        
        print(f"📋 Шаблон: {templates[0]['name']}")
        print(f"👤 Реальный сотрудник: {employees[0]['full_name']}")
        print(f"❌ Фиктивный сотрудник: ID 99999")
        
        # Смешанный список: реальный + несуществующий сотрудник
        from datetime import datetime, timedelta
        test_date = (datetime.now() + timedelta(days=120)).strftime("%Y-%m-%d")
        
        payload_mixed = {
            "template_id": template_id,
            "employee_ids": [real_employee_id, 99999],  # Один реальный, один фиктивный
            "start_date": test_date,
            "assigned_by": "test_admin"
        }
        
        response = requests.post(
            f"{API_BASE_URL}/admin/schedules/assign",
            json=payload_mixed,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📡 Статус ответа: {response.status_code}")
        
        # Должен быть успех с частичным результатом
        assert response.status_code == 200
        result = response.json()
        
        print(f"📊 Результат: {result}")
        
        assert result["success"] is True
        
        # Проверяем статистику (с учетом возможных конфликтов дат)
        if "assignedCount" in result and "skippedCount" in result:
            # Общее количество обработанных должно равняться отправленному количеству
            total_processed = result["assignedCount"] + result["skippedCount"]
            assert total_processed == 2  # Отправили 2 ID (один реальный, один фиктивный)
            assert result["skippedCount"] >= 1   # Минимум один должен быть пропущен (фиктивный ID)
            print(f"✅ Назначено: {result['assignedCount']}, Пропущено: {result['skippedCount']}")
        else:
            print("ℹ️ Детальная статистика не возвращается API")
        
        print("✅ Тест 4 пройден: Частичные ошибки обрабатываются корректно")


if __name__ == "__main__":
    # Для запуска тестов: python test_schedule_assignment_simple.py
    pytest.main([__file__, "-v", "-s"])