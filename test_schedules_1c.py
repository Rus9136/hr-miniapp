#!/usr/bin/env python3
"""
Тесты для проверки функциональности графиков работы из 1С
Production URL: https://madlen.space
"""

import requests
import json
from datetime import datetime

# Base URL для тестирования
BASE_URL = "https://madlen.space/api"

# Тестовые данные
TEST_SCHEDULE_CODE = "76c06530-1aad-11f0-90de-3cecef8cc60b"  # 05:00-17:00/MG 1 смена
TEST_EMPLOYEE_NUMBER = "АП00-00358"  # Суиндикова Сайраш Агабековна


class TestSchedules1C:
    """Тесты для работы с графиками из 1С"""
    
    def test_get_schedules_list(self):
        """Тест 1: Проверка получения списка всех графиков из 1С"""
        # Отправляем запрос
        response = requests.get(f"{BASE_URL}/admin/schedules/1c/list")
        
        # Проверяем статус код
        assert response.status_code == 200, f"Ожидался статус 200, получен {response.status_code}"
        
        # Проверяем что ответ в формате JSON
        data = response.json()
        assert isinstance(data, list), "Ответ должен быть массивом"
        
        # Проверяем что есть графики
        assert len(data) > 0, "Список графиков не должен быть пустым"
        
        # Проверяем структуру первого графика
        first_schedule = data[0]
        required_fields = ['schedule_name', 'schedule_code', 'work_days_count', 
                          'start_date', 'end_date', 'avg_hours']
        
        for field in required_fields:
            assert field in first_schedule, f"Поле '{field}' отсутствует в графике"
        
        # Проверяем что есть наш тестовый график
        test_schedule = next((s for s in data if s['schedule_code'] == TEST_SCHEDULE_CODE), None)
        assert test_schedule is not None, f"Тестовый график {TEST_SCHEDULE_CODE} не найден"
        assert test_schedule['schedule_name'] == "05:00-17:00/MG 1 смена"
        
        print(f"✅ Тест 1 пройден: Получено {len(data)} графиков из 1С")
        print(f"   Пример графика: {first_schedule['schedule_name']}")
        
    def test_get_schedule_details(self):
        """Тест 2: Проверка получения детальной информации о конкретном графике"""
        # Отправляем запрос
        response = requests.get(f"{BASE_URL}/admin/schedules/1c", 
                              params={'scheduleCode': TEST_SCHEDULE_CODE})
        
        # Проверяем статус код
        assert response.status_code == 200, f"Ожидался статус 200, получен {response.status_code}"
        
        # Проверяем структуру ответа
        data = response.json()
        assert 'schedules' in data, "В ответе должно быть поле 'schedules'"
        
        schedules = data['schedules']
        assert isinstance(schedules, list), "schedules должен быть массивом"
        assert len(schedules) > 0, "Список рабочих дней не должен быть пустым"
        
        # Проверяем структуру рабочего дня
        first_day = schedules[0]
        required_fields = ['schedule_name', 'schedule_code', 'work_date', 
                          'work_month', 'time_type', 'work_hours']
        
        for field in required_fields:
            assert field in first_day, f"Поле '{field}' отсутствует в рабочем дне"
        
        # Проверяем данные
        assert first_day['schedule_code'] == TEST_SCHEDULE_CODE
        assert first_day['schedule_name'] == "05:00-17:00/MG 1 смена"
        assert first_day['work_hours'] == 11, "Ожидалось 11 часов работы"
        assert first_day['time_type'] == "Рабочее время"
        
        # Проверяем что есть статистика если она возвращается
        if 'statistics' in data:
            stats = data['statistics']
            print(f"   Статистика: всего записей - {stats.get('total_work_days', len(schedules))}")
        
        print(f"✅ Тест 2 пройден: Получено {len(schedules)} рабочих дней для графика")
        print(f"   График: {first_day['schedule_name']}")
        print(f"   Период: с {schedules[0]['work_date'][:10]} по {schedules[-1]['work_date'][:10]}")
        
    def test_employee_schedule_assignment(self):
        """Тест 3: Проверка назначения графика сотруднику и получения текущего графика"""
        # Часть 1: Назначаем график сотруднику
        # Используем текущую дату + 10 дней для избежания конфликтов
        from datetime import timedelta
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        
        assignment_data = {
            "employee_number": TEST_EMPLOYEE_NUMBER,
            "schedule_code": TEST_SCHEDULE_CODE,
            "start_date": future_date
        }
        
        response = requests.post(f"{BASE_URL}/admin/schedules/assign-employee",
                               json=assignment_data,
                               headers={'Content-Type': 'application/json'})
        
        # Проверяем результат назначения
        assert response.status_code == 200, f"Ожидался статус 200, получен {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, "Назначение должно быть успешным"
        assert 'assignment' in data, "В ответе должна быть информация о назначении"
        
        assignment = data['assignment']
        assert assignment['employee_number'] == TEST_EMPLOYEE_NUMBER
        assert assignment['schedule_code'] == TEST_SCHEDULE_CODE
        
        print(f"✅ Тест 3.1 пройден: График успешно назначен сотруднику")
        print(f"   Сотрудник: {assignment.get('employee_name', TEST_EMPLOYEE_NUMBER)}")
        print(f"   График: {assignment.get('schedule_name', TEST_SCHEDULE_CODE)}")
        
        # Часть 2: Проверяем текущий график сотрудника
        response = requests.get(f"{BASE_URL}/admin/employees/{TEST_EMPLOYEE_NUMBER}/current-schedule")
        
        assert response.status_code == 200, f"Ожидался статус 200, получен {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, "Запрос должен быть успешным"
        assert 'schedule' in data, "В ответе должна быть информация о графике"
        
        current_schedule = data['schedule']
        assert current_schedule['employee_number'] == TEST_EMPLOYEE_NUMBER
        assert current_schedule['schedule_code'] == TEST_SCHEDULE_CODE
        
        print(f"✅ Тест 3.2 пройден: Текущий график сотрудника получен")
        print(f"   Начало действия: {current_schedule['start_date'][:10]}")
        
        # Часть 3: Проверяем историю графиков
        response = requests.get(f"{BASE_URL}/admin/employees/{TEST_EMPLOYEE_NUMBER}/schedule-history")
        
        assert response.status_code == 200, f"Ожидался статус 200, получен {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True, "Запрос должен быть успешным"
        assert 'history' in data, "В ответе должна быть история графиков"
        
        history = data['history']
        assert len(history) > 0, "История не должна быть пустой"
        
        # Проверяем что есть активный график
        active_schedules = [h for h in history if h.get('status') == 'active']
        assert len(active_schedules) > 0, "Должен быть хотя бы один активный график"
        
        print(f"✅ Тест 3.3 пройден: История графиков получена")
        print(f"   Всего записей в истории: {len(history)}")
        print(f"   Активных графиков: {len(active_schedules)}")


def run_tests():
    """Запуск всех тестов"""
    print("🚀 Запуск тестов для графиков работы из 1С")
    print(f"📍 Тестируемый URL: {BASE_URL}")
    print(f"📅 Время запуска: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    test_suite = TestSchedules1C()
    
    try:
        # Тест 1
        print("\n📋 Тест 1: Получение списка графиков")
        test_suite.test_get_schedules_list()
        
        # Тест 2
        print("\n📋 Тест 2: Получение детальной информации о графике")
        test_suite.test_get_schedule_details()
        
        # Тест 3
        print("\n📋 Тест 3: Назначение графика сотруднику")
        test_suite.test_employee_schedule_assignment()
        
        print("\n" + "=" * 60)
        print("✅ Все тесты успешно пройдены!")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ Тест провален: {str(e)}")
        raise
    except Exception as e:
        print(f"\n❌ Ошибка при выполнении теста: {str(e)}")
        raise


if __name__ == "__main__":
    # Запускаем тесты напрямую
    run_tests()