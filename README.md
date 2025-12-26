# Техническое задание: Микросервис аутентификации (auth-service)
## 1. Общие сведения
### Название: Auth Service
Назначение: Централизованный сервис аутентификации и авторизации пользователей
Стек: NestJS, PostgreSQL, Prisma, TypeScript, RabbitMQ, bcrypt, passport-jwt, uuid, Jest
Статус: В разработке

## 2. Бизнес-требования
Регистрация новых пользователей
Аутентификация по email/паролю
Выдача и валидация JWT-токенов
Управление пользовательскими сессиями
Интеграция с другими сервисами через RabbitMQ
Безопасное хранение паролей

## 3. Функциональные требования
### 3.1. Модуль пользователей (User Module)
Создание пользователя с полями: email, password, name, id (uuid)
Валидация уникальности email
Хеширование пароля с использованием bcrypt
Получение профиля пользователя
Обновление профиля (кроме email)
Мягкое удаление пользователя

### 3.2. Модуль аутентификации (Auth Module)
Эндпоинт /auth/register (POST)
Эндпоинт /auth/login (POST) → возвращает JWT
Эндпоинт /auth/logout (POST) → инвалидация токена
Эндпоинт /auth/refresh (POST) → обновление access token
Генерация Access Token (короткоживущий) и Refresh Token
Валидация JWT через passport-jwt стратегию

### 3.3. Модуль событий (Event Module)
Отправка событий через RabbitMQ:
user.created
user.updated
user.deleted
user.logged_in
Конфигурируемые очереди и exchange
Retry логика для обработки ошибок отправки

## 4. Нефункциональные требования
### 4.1. Производительность
Время ответа API < 200 мс (p95)
Поддержка до 1000 RPS на инстанс
Кэширование частых запросов (задел на будущее)

### 4.2. Безопасность
Пароли хешируются с salt (bcrypt, cost factor 12)
JWT секрет хранится в environment variables
Access Token TTL: 15 минут
Refresh Token TTL: 7 дней (хранится в БД)
Защита от brute-force (лимит попыток входа)
Валидация входных данных (DTO)

### 4.3. Надежность
Транзакционность операций (Prisma)
Обработка ошибок с понятными кодами
Логирование ключевых событий и ошибок
Health-check эндпоинт

## 5. Структура проекта

```bash
src/
├── modules/
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   └── events/
│       ├── events.module.ts
│       ├── events.service.ts
│       └── producers/
│           └── user-event.producer.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   ├── decorators/
│   └── constants/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── config/
    └── configuration.ts
```

6. Схема базы данных
```bash
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
}
```

## 7. API спецификация
### POST /auth/register
```bash
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}

Response (201):
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```
### POST /auth/login
```bash
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "expiresIn": 900
}
```
## 8. Тестирование
### 8.1. Юнит-тесты (Jest)
Тестирование сервисов (UserService, AuthService)

Тестирование утилит (хеширование, валидация)

Mocking зависимостей (Prisma, RabbitMQ)

### 8.2. Интеграционные тесты
Тестирование API эндпоинтов

Тестирование взаимодействия с БД

Тестирование JWT стратегии

Тестирование отправки событий

### 8.3. Покрытие кода
Минимальное покрытие: 80% для бизнес-логики

Обязательное покрытие критических путей

## 9. Конфигурация и развертывание
```bash
env
# Environment variables
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_EXPIRATION=900
RABBITMQ_URL=amqp://...
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```
## 10. Этапы разработки
### Этап 1 (Неделя 1): Базовая структура
Инициализация NestJS проекта
Настройка Prisma + PostgreSQL
Создание моделей и миграций
Базовый CRUD для пользователей
### Этап 2 (Неделя 2): Аутентификация
Реализация регистрации и логина

Интеграция JWT

Стратегия passport-jwt

Refresh token механика

### Этап 3 (Неделя 3): Интеграции и события
Настройка RabbitMQ

Реализация event producers

Документация API

### Этап 4 (Неделя 4): Тестирование и оптимизация
Написание unit и интеграционных тестов

Рефакторинг и оптимизация
Проверка безопасности

## 11. Критерии приемки
Все эндпоинты работают согласно спецификации

Покрытие тестами ≥ 80%

Нет уязвимостей безопасности (пароли хешированы, JWT защищен)

Интеграция с RabbitMQ работает стабильно

Код соответствует кодстайлу проекта

Документация API обновлена

Миграции БД протестированы

Логирование настроено корректно

## 12. Известные ограничения и будущие улучшения
Нет поддержки OAuth провайдеров (планируется в v2)

Нет механизма восстановления пароля (планируется в v2)

Нет верификации email (планируется в v2)

Нет rate limiting (можно добавить через middleware)

Нет кэширования (можно добавить Redis)
