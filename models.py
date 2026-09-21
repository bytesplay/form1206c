from pydantic import BaseModel
from typing import List, Optional

class SourceItem(BaseModel):
    type: str = ""
    activity: str = ""
    serial: str = ""
    radiation: str = ""
    ti: str = ""

class FormData(BaseModel):
    # Передача РМ
    place_from: str
    place_to: str
    job_from: str
    job_to: Optional[str] = ""
    engineer_from_login: str
    engineer_to_login: str

    # Проверка упаковки
    check_package: str = "yes"
    check_classification: str = "yes"
    check_dosimeter: str = "yes"

    # Замеры ТС
    cab_radiation: float
    surface_radiation: float

    # Дозиметр
    dosimeter_model: str
    dosimeter_sn: str
    dosimeter_calibration: str

    # Упаковка типа А
    typeA_radiation: str = "yes"
    typeA_ti: str = "yes"
    typeA_address: str = "na"
    typeA_emergency: str = "na"
    typeA_label_radio: str = "yes"
    typeA_label_radio_type: str = "Yellow III"
    typeA_oon: str = "yes"
    typeA_dot: str = "yes"
    typeA_assay: str = "yes"
    typeA_weight: str = "yes"
    typeA_arrows: str = "na"
    typeA_cargo: str = "na"
    typeA_lock: str = "yes"
    typeA_seal: str = "yes"

    # Место хранения
    storage_place: str

    # Подписи
    user_id_from: str
    engineer_from_name: str
    date_from: str
    user_id_to: str
    engineer_to_name: str
    date_to: str

    # Таблица источников (JSON строка)
    sources_json: str