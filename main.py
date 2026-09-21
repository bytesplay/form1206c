from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from datetime import datetime
from typing import List
import traceback

from models import FormData
from generator import generate_docx

app = FastAPI(
    title="FO-RUS-BUR-QHSE-1206C Generator",
    description="Генератор акта перевозки радиоактивных материалов",
    version="1.2.0"  # ← вставка фото в DOCX
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Раздача фронтенда ---
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# --- Лимиты на бэкенде (дублируют фронт, но защищают API) ---
MAX_PHOTOS = 15
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 МБ
ALLOWED_MIME_PREFIX = "image/"


@app.get("/")
async def root():
    return {
        "message": "FO-RUS-BUR-QHSE-1206C Generator API",
        "docs": "/docs",
        "endpoints": {
            "generate": "/generate_fo_1206c/"
        }
    }


@app.post("/generate_fo_1206c/")
async def generate_fo_1206c(
    # --- Простые поля (multipart/form-data) ---
    place_from: str = Form(...),
    place_to: str = Form(...),
    job_from: str = Form(...),
    job_to: str = Form(""),
    engineer_from_login: str = Form(...),
    engineer_to_login: str = Form(...),

    check_package: str = Form("yes"),
    check_classification: str = Form("yes"),
    check_dosimeter: str = Form("yes"),

    cab_radiation: float = Form(...),
    surface_radiation: float = Form(...),

    dosimeter_model: str = Form(...),
    dosimeter_sn: str = Form(...),
    dosimeter_calibration: str = Form(...),

    typeA_radiation: str = Form("yes"),
    typeA_ti: str = Form("yes"),
    typeA_address: str = Form("na"),
    typeA_emergency: str = Form("na"),
    typeA_label_radio: str = Form("yes"),
    typeA_label_radio_type: str = Form("Yellow III"),
    typeA_oon: str = Form("yes"),
    typeA_dot: str = Form("yes"),
    typeA_assay: str = Form("yes"),
    typeA_weight: str = Form("yes"),
    typeA_arrows: str = Form("na"),
    typeA_cargo: str = Form("na"),
    typeA_lock: str = Form("yes"),
    typeA_seal: str = Form("yes"),

    storage_place: str = Form(...),

    user_id_from: str = Form(...),
    engineer_from_name: str = Form(...),
    date_from: str = Form(...),
    user_id_to: str = Form(...),
    engineer_to_name: str = Form(...),
    date_to: str = Form(...),

    sources_json: str = Form("[]"),

    # --- Файлы ---
    photos: List[UploadFile] = File(default=[]),
):
    """
    Генерирует DOCX-файл на основе данных формы (multipart/form-data).
    Фотографии сжимаются через Pillow и вставляются в раздел приложения.
    """
    try:
        # --- Валидация фото на бэкенде ---
        if len(photos) > MAX_PHOTOS:
            raise HTTPException(
                status_code=400,
                detail=f"Слишком много фотографий: {len(photos)} (максимум {MAX_PHOTOS})"
            )

        photos_bytes: List[bytes] = []
        for idx, photo in enumerate(photos, 1):
            # Проверка MIME
            if not photo.content_type or not photo.content_type.startswith(ALLOWED_MIME_PREFIX):
                raise HTTPException(
                    status_code=400,
                    detail=f"Файл #{idx} ({photo.filename}) не является изображением "
                           f"(content_type={photo.content_type})"
                )

            raw = await photo.read()

            if len(raw) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Файл #{idx} ({photo.filename}) превышает "
                           f"{MAX_FILE_SIZE // (1024 * 1024)} МБ"
                )

            if len(raw) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Файл #{idx} ({photo.filename}) пустой"
                )

            photos_bytes.append(raw)

        print(f"📷 Получено фотографий: {len(photos_bytes)}")
        for i, photo in enumerate(photos, 1):
            print(f"   {i}. {photo.filename} ({photo.content_type})")

        # --- Собираем FormData ---
        data = FormData(
            place_from=place_from,
            place_to=place_to,
            job_from=job_from,
            job_to=job_to or "",
            engineer_from_login=engineer_from_login,
            engineer_to_login=engineer_to_login,
            check_package=check_package,
            check_classification=check_classification,
            check_dosimeter=check_dosimeter,
            cab_radiation=cab_radiation,
            surface_radiation=surface_radiation,
            dosimeter_model=dosimeter_model,
            dosimeter_sn=dosimeter_sn,
            dosimeter_calibration=dosimeter_calibration,
            typeA_radiation=typeA_radiation,
            typeA_ti=typeA_ti,
            typeA_address=typeA_address,
            typeA_emergency=typeA_emergency,
            typeA_label_radio=typeA_label_radio,
            typeA_label_radio_type=typeA_label_radio_type,
            typeA_oon=typeA_oon,
            typeA_dot=typeA_dot,
            typeA_assay=typeA_assay,
            typeA_weight=typeA_weight,
            typeA_arrows=typeA_arrows,
            typeA_cargo=typeA_cargo,
            typeA_lock=typeA_lock,
            typeA_seal=typeA_seal,
            storage_place=storage_place,
            user_id_from=user_id_from,
            engineer_from_name=engineer_from_name,
            date_from=date_from,
            user_id_to=user_id_to,
            engineer_to_name=engineer_to_name,
            date_to=date_to,
            sources_json=sources_json,
        )

        # --- Генерация DOCX с фото ---
        buffer = generate_docx(data, photos=photos_bytes)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"FO-RUS-BUR-QHSE-1206C_{timestamp}.docx"

        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)