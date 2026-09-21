# FO-RUS-BUR-QHSE-1206C Generator

Веб-приложение для автоматического формирования акта перевозки
радиоактивных материалов (форма FO-RUS-BUR-QHSE-1206C).

## Что делает

- Форма ввода данных о передаче РМ, замерах ТУК и ТС, упаковке типа А.
- Радиологические замеры с таблицей источников.
- Загрузка фотографий (drag & drop, до 15 шт., до 10 МБ каждая).
- Генерация DOCX по шаблону `templates/template.docx`.

## Стек

- **Backend:** FastAPI, docxtpl, Pillow
- **Frontend:** HTML + CSS + vanilla JS (без сборки)
- **Раздача:** FastAPI отдаёт статику из `static/` на том же порту

## Локальный запуск

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux / macOS
pip install -r requirements.txt
uvicorn main:app --reload