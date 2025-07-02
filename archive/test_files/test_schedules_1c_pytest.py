#!/usr/bin/env python3
"""
Pytest тесты для проверки функциональности графиков работы из 1С
Production URL: https://madlen.space

Запуск: pytest test_schedules_1c_pytest.py -v
"""

import pytest
import requests
from datetime import datetime, timedelta

# Base URL для тестирования
BASE_URL = "https://madlen.space/api"

# Тестовые данные
TEST_SCHEDULE_CODE = "76c06530-1aad-11f0-90de-3cecef8cc60b"  # 05:00-17:00/MG 1 смена
TEST_EMPLOYEE_NUMBER = "АП00-00358"  # Суиндикова Сайраш Агабековна


class TestSchedules1CAPI:
    """Тесты для API графиков работы из 1С"""
    
    def test_get_schedules_list_returns_valid_data(self):
        """
        Тест 1: API /admin/schedules/1c/list должен возвращать список графиков
        
        Проверяет:
        - Статус код 200
        - Ответ является массивом
        - Массив не пустой
        - Каждый элемент содержит обязательные поля
        - Существует тестовый график
        """
        # Act
        response = requests.get(f"{BASE_URL}/admin/schedules/1c/list")
        
        # Assert
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Проверяем структуру первого графика
        first_schedule = data[0]
        required_fields = [
            'schedule_name', 'schedule_code', 'work_days_count', 
            'start_date', 'end_date', 'avg_hours'
        ]
        
        for field in required_fields:
            assert field in first_schedule, f"Поле '{field}' отсутствует"
        
        # Проверяем наличие тестового графика
        test_schedule = next(
            (s for s in data if s['schedule_code'] == TEST_SCHEDULE_CODE), 
            None
        )
        assert test_schedule is not None
        assert test_schedule['schedule_name'] == "05:00-17:00/MG 1 смена"
    
    def test_get_schedule_details_returns_work_days(self):
        """
        Тест 2: API /admin/schedules/1c должен возвращать рабочие дни графика
        
        Проверяет:
        - Статус код 200
        - Наличие поля schedules в ответе
        - schedules является массивом с данными
        - Каждый рабочий день содержит обязательные поля
        - Данные соответствуют запрошенному графику
        """
        # Act
        response = requests.get(
            f"{BASE_URL}/admin/schedules/1c",
            params={'scheduleCode': TEST_SCHEDULE_CODE}
        )
        
        # Assert
        assert response.status_code == 200
        
        data = response.json()
        assert 'schedules' in data
        
        schedules = data['schedules']
        assert isinstance(schedules, list)
        assert len(schedules) > 0
        
        # Проверяем первый рабочий день
        first_day = schedules[0]
        required_fields = [
            'schedule_name', 'schedule_code', 'work_date', 
            'work_month', 'time_type', 'work_hours'
        ]
        
        for field in required_fields:
            assert field in first_day, f"Поле '{field}' отсутствует"
        
        # Проверяем соответствие данных
        assert first_day['schedule_code'] == TEST_SCHEDULE_CODE
        assert first_day['schedule_name'] == "05:00-17:00/MG 1 смена"
        assert first_day['work_hours'] == 11
        assert first_day['time_type'] == "Рабочее время"
    
    def test_assign_schedule_and_get_current_schedule(self):
        """
        Тест 3: Назначение графика сотруднику и проверка API истории
        
        Проверяет:
        - Успешное назначение графика (статус 200)
        - Получение текущего графика сотрудника
        - Получение истории графиков
        - Корректность данных в ответах
        """
        # Arrange
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        assignment_data = {
            "employee_number": TEST_EMPLOYEE_NUMBER,
            "schedule_code": TEST_SCHEDULE_CODE,
            "start_date": future_date
        }
        
        # Act 1: Назначаем график
        response = requests.post(
            f"{BASE_URL}/admin/schedules/assign-employee",
            json=assignment_data,
            headers={'Content-Type': 'application/json'}
        )
        
        # Assert 1: Проверяем назначение
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') is True
        assert 'assignment' in data
        
        assignment = data['assignment']
        assert assignment['employee_number'] == TEST_EMPLOYEE_NUMBER
        assert assignment['schedule_code'] == TEST_SCHEDULE_CODE
        
        # Act 2: Получаем текущий график
        response = requests.get(
            f"{BASE_URL}/admin/employees/{TEST_EMPLOYEE_NUMBER}/current-schedule"
        )
        
        # Assert 2: Проверяем текущий график
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') is True
        assert 'schedule' in data
        
        current_schedule = data['schedule']
        assert current_schedule['employee_number'] == TEST_EMPLOYEE_NUMBER
        assert current_schedule['schedule_code'] == TEST_SCHEDULE_CODE
        
        # Act 3: Получаем историю
        response = requests.get(
            f"{BASE_URL}/admin/employees/{TEST_EMPLOYEE_NUMBER}/schedule-history"
        )
        
        # Assert 3: Проверяем историю
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') is True
        assert 'history' in data
        
        history = data['history']
        assert len(history) > 0
        
        # Проверяем наличие активного графика
        active_schedules = [h for h in history if h.get('status') == 'active']
        assert len(active_schedules) > 0


# Фикстуры pytest для настройки тестов
@pytest.fixture(scope="session")
def base_url():
    """Базовый URL для тестов"""
    return BASE_URL


@pytest.fixture
def schedule_code():
    """Тестовый код графика"""
    return TEST_SCHEDULE_CODE


@pytest.fixture
def employee_number():
    """Тестовый табельный номер сотрудника"""
    return TEST_EMPLOYEE_NUMBER