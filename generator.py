import os
import json
from io import BytesIO
from typing import List, Optional

from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm

from PIL import Image, ImageOps

from models import FormData


# --- Параметры сжатия ---
MAX_IMAGE_SIDE = 800           # максимальная сторона в пикселях
JPEG_QUALITY = 80              # качество JPEG
PHOTO_WIDTH_MM = 86            # ширина вставки в DOCX (мм)
PHOTOS_PER_ROW = 2             # таблица 2×N


def _compress_image(raw: bytes, max_side: int = MAX_IMAGE_SIDE,
                    quality: int = JPEG_QUALITY) -> BytesIO:
    """
    Сжимает изображение: ресайз по длинной стороне + JPEG-перекодирование.
    Возвращает BytesIO с JPEG-байтами, готовый для InlineImage.

    Если Pillow не может открыть файл — выбрасывает исключение,
    вызывающий код должен обработать.
    """
    img = Image.open(BytesIO(raw))

    # EXIF-ориентация (чтобы фото с телефона не были повёрнуты)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # Приводим к RGB (JPEG не поддерживает RGBA/P)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # Ресайз по длинной стороне с сохранением пропорций
    w, h = img.size
    if max(w, h) > max_side:
        if w >= h:
            new_w = max_side
            new_h = int(h * max_side / w)
        else:
            new_h = max_side
            new_w = int(w * max_side / h)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    # Сохраняем в BytesIO как JPEG
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=quality, optimize=True)
    buffer.seek(0)
    return buffer


def _build_photo_rows(doc, photos: List[bytes]) -> List[List]:
    """
    Готовит построчную раскладку для шаблона:
        {%tr for row in photo_rows %}
        | {{ row[0] }} | {{ row[1] }} |
        {%tr endfor %}

    Возвращает список строк, каждая строка — список из PHOTOS_PER_ROW
    элементов (InlineImage или пустая строка для нечётного количества).
    """
    inline_photos: List[InlineImage] = []

    for idx, raw in enumerate(photos):
        try:
            compressed = _compress_image(raw)
            inline = InlineImage(doc, compressed, width=Mm(PHOTO_WIDTH_MM))
            inline_photos.append(inline)
        except Exception as e:
            # Одно битое фото не должно ломать весь документ
            print(f"⚠️ Не удалось обработать фото #{idx + 1}: {e}")
            continue

    # Раскладываем по строкам по PHOTOS_PER_ROW штук
    rows: List[List] = []
    for i in range(0, len(inline_photos), PHOTOS_PER_ROW):
        chunk = inline_photos[i:i + PHOTOS_PER_ROW]
        # Добиваем строку пустыми ячейками, если фото нечётное
        while len(chunk) < PHOTOS_PER_ROW:
            chunk.append("")
        rows.append(chunk)

    return rows


def generate_docx(data: FormData, photos: Optional[List[bytes]] = None) -> BytesIO:
    """
    Генерирует DOCX-файл из шаблона, заполняя его данными формы.

    :param data:   данные формы
    :param photos: список сырых байтов изображений (уже прочитанных из UploadFile).
                   Каждое фото сжимается и вставляется в таблицу 2×N
                   раздела приложения через плейсхолдер photo_rows.
    """
    # 1. Загружаем шаблон
    template_path = os.path.join(
        os.path.dirname(__file__),
        "templates",
        "template.docx"
    )

    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Шаблон не найден: {template_path}")

    doc = DocxTemplate(template_path)

    # 2. Преобразуем чекбоксы в понятный текст
    status_map = {"yes": "✅ Да", "no": "❌ НЕТ", "na": "— НП"}

    # 3. Парсим источники из JSON
    try:
        sources = json.loads(data.sources_json)
    except Exception:
        sources = []

    # 4. Готовим построчную раскладку фото для шаблона
    photo_rows = _build_photo_rows(doc, photos or [])

    # 5. Контекст для шаблона
    context = {
        # Передача РМ
        "place_from": data.place_from,
        "place_to": data.place_to,
        "job_from": data.job_from,
        "job_to": data.job_to or "—",
        "engineer_from_name": data.engineer_from_name,
        "engineer_to_name": data.engineer_to_name,
        "user_id_from": data.user_id_from,
        "user_id_to": data.user_id_to,

        # Проверка упаковки
        "check_package": status_map.get(data.check_package, data.check_package),
        "check_classification": status_map.get(data.check_classification, data.check_classification),
        "check_dosimeter": status_map.get(data.check_dosimeter, data.check_dosimeter),

        # Замеры ТС
        "cab_radiation": data.cab_radiation,
        "surface_radiation": data.surface_radiation,

        # Дозиметр
        "dosimeter_model": data.dosimeter_model,
        "dosimeter_sn": data.dosimeter_sn,
        "dosimeter_calibration": data.dosimeter_calibration,

        # Упаковка типа А
        "typeA_radiation": status_map.get(data.typeA_radiation, data.typeA_radiation),
        "typeA_ti": status_map.get(data.typeA_ti, data.typeA_ti),
        "typeA_address": status_map.get(data.typeA_address, data.typeA_address),
        "typeA_emergency": status_map.get(data.typeA_emergency, data.typeA_emergency),
        "typeA_label_radio": status_map.get(data.typeA_label_radio, data.typeA_label_radio),
        "typeA_label_radio_type": data.typeA_label_radio_type,
        "typeA_oon": status_map.get(data.typeA_oon, data.typeA_oon),
        "typeA_dot": status_map.get(data.typeA_dot, data.typeA_dot),
        "typeA_assay": status_map.get(data.typeA_assay, data.typeA_assay),
        "typeA_weight": status_map.get(data.typeA_weight, data.typeA_weight),
        "typeA_arrows": status_map.get(data.typeA_arrows, data.typeA_arrows),
        "typeA_cargo": status_map.get(data.typeA_cargo, data.typeA_cargo),
        "typeA_lock": status_map.get(data.typeA_lock, data.typeA_lock),
        "typeA_seal": status_map.get(data.typeA_seal, data.typeA_seal),

        # Место хранения
        "storage_place": data.storage_place,

        # Подписи
        "date_from": data.date_from,
        "date_to": data.date_to,

        # Таблица источников
        "sources": sources,

        # Фотографии — построчная раскладка 2×N для {%tr for row in photo_rows %}
        "photo_rows": photo_rows,
        "photos_count": sum(1 for row in photo_rows for cell in row if cell != ""),
    }

    # 6. Заполняем шаблон
    doc.render(context)

    # 7. Сохраняем в BytesIO
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return buffer