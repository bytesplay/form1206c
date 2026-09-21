/**
 * FO-RUS-BUR-QHSE-1206C — Генератор формы
 * Версия 3.1 — маска номера работы, select типа источника,
 *               автозаполнение места хранения, шаги полей
 */

document.addEventListener('DOMContentLoaded', function() {

    // ============================================================
    // 1. ЗАГРУЗКА ДАННЫХ ИНЖЕНЕРОВ
    // ============================================================
    let engineersData = [];

    async function loadEngineers() {
        try {
            const response = await fetch('/static/engineers.json');
            if (!response.ok) throw new Error('Не удалось загрузить engineers.json');
            const data = await response.json();
            engineersData = data.engineers || [];
            populateEngineerSelects();
        } catch (error) {
            console.error('Ошибка загрузки инженеров:', error);
            showAlert('❌ Не удалось загрузить список инженеров. Проверьте файл engineers.json', 'error');
        }
    }

    function populateEngineerSelects() {
        const selects = ['engineerFrom', 'engineerTo'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            const emptyOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (emptyOption) select.appendChild(emptyOption);
            
            engineersData.forEach(eng => {
                const option = document.createElement('option');
                option.value = eng.login;
                option.textContent = `${eng.name} (${eng.id})`;
                option.dataset.id = eng.id;
                option.dataset.name = eng.name;
                select.appendChild(option);
            });
        });
    }

    // ============================================================
    // 2. АВТОЗАПОЛНЕНИЕ ПОЛЕЙ ПОДПИСЕЙ
    // ============================================================
    function fillSignatureFields(selectId, userIdFieldId, nameFieldId) {
        const select = document.getElementById(selectId);
        const userIdField = document.getElementById(userIdFieldId);
        const nameField = document.getElementById(nameFieldId);

        select.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (this.value) {
                userIdField.value = selectedOption.dataset.id || '';
                nameField.value = selectedOption.dataset.name || '';
            } else {
                userIdField.value = '';
                nameField.value = '';
            }
        });

        if (select.value) {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption) {
                userIdField.value = selectedOption.dataset.id || '';
                nameField.value = selectedOption.dataset.name || '';
            }
        }
    }

    // ============================================================
    // 3. ПОДСТАНОВКА ТЕКУЩЕЙ ДАТЫ
    // ============================================================
    function setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateFrom').value = today;
        document.getElementById('dateTo').value = today;
    }

    // ============================================================
    // 4. МАСКА НОМЕРА РАБОТЫ: 7163 000 543
    // ============================================================
    /**
     * Оставляет только цифры, ограничивает 10 символами
     * и расставляет пробелы: 4 + 3 + 3.
     * Пример: "7163000543" -> "7163 000 543"
     */
    function formatJobNumber(digits) {
        const d = digits.slice(0, 10);
        if (d.length <= 4) return d;
        if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
        return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    }

    /**
     * Убирает все нецифровые символы — для отправки на сервер.
     */
    function normalizeJobNumber(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function setupJobNumberMask() {
        const jobFields = document.querySelectorAll('#jobFrom, #jobTo');
        jobFields.forEach(field => {
            field.addEventListener('input', function() {
                const digits = this.value.replace(/\D/g, '').slice(0, 10);
                const caretPos = this.selectionStart;
                const beforeLength = this.value.length;

                this.value = formatJobNumber(digits);

                // Корректируем позицию каретки после переформатирования
                const afterLength = this.value.length;
                const newPos = Math.max(0, caretPos + (afterLength - beforeLength));
                try {
                    this.setSelectionRange(newPos, newPos);
                } catch (_) { /* ignore */ }
            });

            field.addEventListener('blur', function() {
                const digits = this.value.replace(/\D/g, '');
                if (digits.length > 0 && digits.length !== 10) {
                    this.style.borderColor = '#dc2626';
                    showAlert('Номер работы должен содержать ровно 10 цифр (формат 7163 XXX XXX)', 'error');
                } else {
                    this.style.borderColor = '';
                }
            });
        });
    }

    // ============================================================
    // 5. АВТОЗАПОЛНЕНИЕ МЕСТА ХРАНЕНИЯ ИЗ МЕСТА ПОЛУЧЕНИЯ
    // ============================================================
    function setupStorageAutofill() {
        const placeTo = document.getElementById('placeTo');
        const storagePlace = document.getElementById('storagePlace');

        placeTo.addEventListener('input', function() {
            storagePlace.value = this.value;
        });

        // Если поле уже заполнено (например, автозаполнение браузера) — синхронизируем
        if (placeTo.value) {
            storagePlace.value = placeTo.value;
        }
    }

    // ============================================================
    // 6. ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ ИСТОЧНИКОВ
    // ============================================================
    const sourcesBody = document.getElementById('sourcesBody');
    const addSourceBtn = document.getElementById('addSourceBtn');

    // Доступные типы источников
    const SOURCE_TYPES = ['Cs-137', 'Am241 Be', 'Pu-238 Be'];

    // Количество строк по умолчанию
    const DEFAULT_SOURCE_ROWS = 3;

    function buildTypeSelect(selectedValue) {
        const options = ['<option value="">Тип источника</option>'];
        SOURCE_TYPES.forEach(type => {
            const selected = type === selectedValue ? ' selected' : '';
            options.push(`<option value="${type}"${selected}>${type}</option>`);
        });
        return `<select class="src-type">${options.join('')}</select>`;
    }

    function buildSourceRow(src) {
        return `
            <td>${buildTypeSelect(src.type)}</td>
            <td><input type="number" class="src-activity" value="${src.activity}" placeholder="Активность" step="1" min="0" /></td>
            <td><input type="text" class="src-serial" value="${src.serial}" placeholder="Номер" /></td>
            <td><input type="number" class="src-radiation" value="${src.radiation}" placeholder="µSv/hr" step="1" min="0" /></td>
            <td><input type="number" class="src-ti" value="${src.ti}" placeholder="ТИ" step="0.5" min="0" /></td>
            <td>
                <button type="button" class="btn-remove-row" title="Удалить строку">✕</button>
            </td>
        `;
    }

    function bindRemoveButtons() {
        sourcesBody.querySelectorAll('.btn-remove-row').forEach(btn => {
            // Чтобы не навешивать обработчик повторно — используем флаг
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function() {
                const row = this.closest('tr');
                const tbody = row.parentElement;
                if (tbody.children.length > 1) {
                    row.remove();
                } else {
                    showAlert('Нельзя удалить последнюю строку', 'error');
                }
            });
        });
    }

    function renderSources(data) {
        sourcesBody.innerHTML = '';
        data.forEach(src => {
            const tr = document.createElement('tr');
            tr.innerHTML = buildSourceRow(src);
            sourcesBody.appendChild(tr);
        });
        bindRemoveButtons();
    }

    // Стартовый набор: 3 пустые строки
    const defaultSources = Array.from({ length: DEFAULT_SOURCE_ROWS }, () => ({
        type: '', activity: '', serial: '', radiation: '', ti: ''
    }));

    renderSources(defaultSources);

    addSourceBtn.addEventListener('click', function() {
        const tr = document.createElement('tr');
        tr.innerHTML = buildSourceRow({ type: '', activity: '', serial: '', radiation: '', ti: '' });
        sourcesBody.appendChild(tr);
        bindRemoveButtons();
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // ============================================================
    // 7. УВЕДОМЛЕНИЯ (Alerts)
    // ============================================================
    const alertContainer = document.getElementById('alertContainer');

    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} show fade-in`;
        alert.innerHTML = `
            <span>${message}</span>
            <button class="close-alert">×</button>
        `;
        alertContainer.appendChild(alert);

        alert.querySelector('.close-alert').addEventListener('click', function() {
            alert.remove();
        });

        setTimeout(() => {
            if (alert.parentElement) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 400);
            }
        }, 8000);
    }

    // ============================================================
    // 8. ПРОГРЕСС-БАР
    // ============================================================
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    function setProgress(percent, text) {
        progressContainer.classList.add('show');
        progressFill.style.width = percent + '%';
        progressText.textContent = text;
    }

    function hideProgress() {
        progressContainer.classList.remove('show');
        progressFill.style.width = '0%';
    }

    // ============================================================
    // 9. ФОТОГРАФИИ — накопление, drag&drop, превью
    // ============================================================
    const MAX_PHOTOS = 15;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

    /** @type {File[]} */
    let selectedPhotos = [];

    const dropzone = document.getElementById('dropzone');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    const photoCounter = document.getElementById('photoCounter');
    const clearPhotosBtn = document.getElementById('clearPhotosBtn');

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function addFiles(fileList) {
        const files = Array.from(fileList);
        let added = 0;
        let skippedType = 0;
        let skippedSize = 0;
        let skippedLimit = 0;

        for (const file of files) {
            if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
                skippedType++;
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                skippedSize++;
                continue;
            }
            const duplicate = selectedPhotos.some(
                p => p.name === file.name && p.size === file.size
            );
            if (duplicate) continue;

            if (selectedPhotos.length >= MAX_PHOTOS) {
                skippedLimit++;
                continue;
            }

            selectedPhotos.push(file);
            added++;
        }

        if (skippedType > 0) showAlert(`⚠️ Пропущено не-изображений: ${skippedType}`, 'error');
        if (skippedSize > 0) showAlert(`⚠️ Пропущено файлов > 10 МБ: ${skippedSize}`, 'error');
        if (skippedLimit > 0) showAlert(`⚠️ Превышен лимит ${MAX_PHOTOS} фото. Пропущено: ${skippedLimit}`, 'error');

        if (added > 0) {
            renderPhotoPreview();
        }
        return added;
    }

    function removePhotoAt(index) {
        selectedPhotos.splice(index, 1);
        renderPhotoPreview();
    }

    function clearAllPhotos() {
        if (selectedPhotos.length === 0) return;
        if (!confirm('Удалить все выбранные фотографии?')) return;
        selectedPhotos = [];
        renderPhotoPreview();
    }

    function renderPhotoPreview() {
        photoPreview.innerHTML = '';

        selectedPhotos.forEach((file, index) => {
            const tile = document.createElement('div');
            tile.className = 'photo-tile';

            const img = document.createElement('img');
            const url = URL.createObjectURL(file);
            img.src = url;
            img.alt = file.name;
            img.onload = () => URL.revokeObjectURL(url);

            const name = document.createElement('div');
            name.className = 'photo-name';
            name.textContent = `${file.name} (${formatFileSize(file.size)})`;
            name.title = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'photo-remove';
            removeBtn.innerHTML = '✕';
            removeBtn.title = 'Удалить';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removePhotoAt(index);
            });

            tile.appendChild(img);
            tile.appendChild(name);
            tile.appendChild(removeBtn);
            photoPreview.appendChild(tile);
        });

        photoCounter.textContent = `${selectedPhotos.length} файл(ов)`;
    }

    dropzone.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
        addFiles(e.target.files);
        photoInput.value = '';
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (!dt) return;
        if (dt.files && dt.files.length > 0) {
            addFiles(dt.files);
        }
    });

    ['dragover', 'drop'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (!dropzone.contains(e.target)) {
                e.preventDefault();
            }
        });
    });

    clearPhotosBtn.addEventListener('click', clearAllPhotos);

    // ============================================================
    // 10. СБОР ДАННЫХ ИЗ ФОРМЫ
    // ============================================================
    function collectFormData() {
        const form = document.getElementById('reportForm');
        const fd = new FormData(form);

        // --- Нормализуем номера работ (убираем пробелы) ---
        const jobFrom = normalizeJobNumber(fd.get('job_from'));
        const jobTo = normalizeJobNumber(fd.get('job_to'));

        if (jobFrom && !/^\d{10}$/.test(jobFrom)) {
            showAlert('Номер работы (отправка) должен содержать 10 цифр', 'error');
            return null;
        }
        if (jobTo && !/^\d{10}$/.test(jobTo)) {
            showAlert('Номер работы (получение) должен содержать 10 цифр', 'error');
            return null;
        }

        // --- Чекбоксы ---
        const checkPackage = document.getElementById('check_package').checked ? 'yes' : 'no';
        const checkClassification = document.getElementById('check_classification').checked ? 'yes' : 'no';
        const checkDosimeter = document.getElementById('check_dosimeter').checked ? 'yes' : 'no';

        // --- Таблица источников ---
        const rows = sourcesBody.querySelectorAll('tr');
        const sources = [];
        rows.forEach(row => {
            const type = row.querySelector('.src-type')?.value || '';
            const activity = row.querySelector('.src-activity')?.value || '';
            const serial = row.querySelector('.src-serial')?.value || '';
            const radiation = row.querySelector('.src-radiation')?.value || '';
            const ti = row.querySelector('.src-ti')?.value || '';
            if (type.trim() || activity.trim() || serial.trim()) {
                sources.push({ type, activity, serial, radiation, ti });
            }
        });

        // --- Плоские поля ---
        const flat = {
            place_from: fd.get('place_from') || '',
            place_to: fd.get('place_to') || '',
            job_from: jobFrom,
            job_to: jobTo,
            engineer_from_login: fd.get('engineer_from_login') || '',
            engineer_to_login: fd.get('engineer_to_login') || '',
            check_package: checkPackage,
            check_classification: checkClassification,
            check_dosimeter: checkDosimeter,
            cab_radiation: parseFloat(fd.get('cab_radiation')) || 0,
            surface_radiation: parseFloat(fd.get('surface_radiation')) || 0,
            dosimeter_model: fd.get('dosimeter_model') || '',
            dosimeter_sn: fd.get('dosimeter_sn') || '',
            dosimeter_calibration: fd.get('dosimeter_calibration') || '',
            typeA_radiation: fd.get('typeA_radiation') || 'yes',
            typeA_ti: fd.get('typeA_ti') || 'yes',
            typeA_address: fd.get('typeA_address') || 'na',
            typeA_emergency: fd.get('typeA_emergency') || 'na',
            typeA_label_radio: fd.get('typeA_label_radio') || 'yes',
            typeA_label_radio_type: fd.get('typeA_label_radio_type') || 'Yellow III',
            typeA_oon: fd.get('typeA_oon') || 'yes',
            typeA_dot: fd.get('typeA_dot') || 'yes',
            typeA_assay: fd.get('typeA_assay') || 'yes',
            typeA_weight: fd.get('typeA_weight') || 'yes',
            typeA_arrows: fd.get('typeA_arrows') || 'na',
            typeA_cargo: fd.get('typeA_cargo') || 'na',
            typeA_lock: fd.get('typeA_lock') || 'yes',
            typeA_seal: fd.get('typeA_seal') || 'yes',
            storage_place: fd.get('storage_place') || '',
            user_id_from: fd.get('user_id_from') || '',
            engineer_from_name: fd.get('engineer_from_name') || '',
            date_from: fd.get('date_from') || '',
            user_id_to: fd.get('user_id_to') || '',
            engineer_to_name: fd.get('engineer_to_name') || '',
            date_to: fd.get('date_to') || '',
            sources_json: JSON.stringify(sources),
        };

        // --- Проверка обязательных полей ---
        const requiredFields = [
            'place_from', 'place_to', 'job_from', 'engineer_from_login',
            'engineer_to_login', 'cab_radiation', 'surface_radiation',
            'dosimeter_model', 'dosimeter_sn', 'dosimeter_calibration',
            'storage_place', 'user_id_from', 'engineer_from_name', 'date_from',
            'user_id_to', 'engineer_to_name', 'date_to'
        ];

        let isValid = true;
        requiredFields.forEach(field => {
            if (!flat[field] && flat[field] !== 0) {
                isValid = false;
                const input = form.querySelector(`[name="${field}"]`);
                if (input) {
                    input.style.borderColor = '#dc2626';
                    setTimeout(() => input.style.borderColor = '', 3000);
                }
            }
        });

        if (isNaN(flat.cab_radiation) || flat.cab_radiation < 0) {
            isValid = false;
            showAlert('Излучение в кабине должно быть неотрицательным числом', 'error');
        }
        if (isNaN(flat.surface_radiation) || flat.surface_radiation < 0) {
            isValid = false;
            showAlert('Излучение на поверхности должно быть неотрицательным числом', 'error');
        }

        if (!isValid) {
            showAlert('Пожалуйста, заполните все обязательные поля (отмечены звёздочкой)', 'error');
            return null;
        }

        // --- Собираем итоговый FormData ---
        const out = new FormData();

        Object.entries(flat).forEach(([key, value]) => {
            out.append(key, String(value));
        });

        selectedPhotos.forEach(file => {
            out.append('photos', file, file.name);
        });

        return out;
    }

    // ============================================================
    // 11. ОТПРАВКА НА СЕРВЕР (multipart/form-data)
    // ============================================================
    async function submitForm() {
        const formData = collectFormData();
        if (!formData) return;

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Генерация...';
        setProgress(10, 'Подготовка данных...');

        try {
            console.log('📤 Отправляем multipart/form-data:');
            for (const [key, value] of formData.entries()) {
                if (value instanceof File) {
                    console.log(`  ${key}: File(${value.name}, ${value.size} B, ${value.type})`);
                } else {
                    console.log(`  ${key}: ${value}`);
                }
            }

            const apiUrl = '/generate_fo_1206c/';

            setProgress(30, 'Отправка данных на сервер...');

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
            });

            setProgress(70, 'Обработка сервером...');

            if (!response.ok) {
                let errorMessage = `Ошибка сервера: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        if (Array.isArray(errorData.detail)) {
                            errorMessage += ' - ' + errorData.detail.map(err => {
                                const loc = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : '?';
                                return `${loc}: ${err.msg}`;
                            }).join(', ');
                        } else {
                            errorMessage += ` - ${errorData.detail}`;
                        }
                    }
                } catch (e) {
                    try {
                        const errorText = await response.text();
                        if (errorText) errorMessage += ` - ${errorText}`;
                    } catch (_) { /* ignore */ }
                }
                throw new Error(errorMessage);
            }

            setProgress(90, 'Генерация документа...');

            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'FO-RUS-BUR-QHSE-1206C.docx';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            setProgress(100, '✅ Готово! Документ скачан.');
            showAlert(`✅ Документ "${filename}" успешно сгенерирован и скачан!`, 'success');

            setTimeout(hideProgress, 2000);

        } catch (error) {
            console.error('❌ Ошибка:', error);
            showAlert(`❌ Ошибка: ${error.message}`, 'error');
            setProgress(0, '❌ Ошибка');
            setTimeout(hideProgress, 3000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '⚡ Сгенерировать DOCX';
        }
    }

    // ============================================================
    // 12. ПРИВЯЗКА КНОПОК
    // ============================================================
    document.getElementById('submitBtn').addEventListener('click', function(e) {
        e.preventDefault();
        submitForm();
    });

    // ============================================================
    // 13. СБРОС ФОРМЫ
    // ============================================================
    document.querySelector('button[type="reset"]').addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Вы уверены, что хотите сбросить все введённые данные?')) {
            document.getElementById('reportForm').reset();
            renderSources(defaultSources);
            hideProgress();
            setDefaultDates();
            document.getElementById('userIdFrom').value = '';
            document.getElementById('engineerFromName').value = '';
            document.getElementById('userIdTo').value = '';
            document.getElementById('engineerToName').value = '';
            document.getElementById('storagePlace').value = '';
            selectedPhotos = [];
            renderPhotoPreview();
            showAlert('Форма сброшена', 'info');
        }
    });

    // ============================================================
    // 14. ВАЛИДАЦИЯ ПРИ ВВОДЕ
    // ============================================================
    document.querySelectorAll('input[required], select[required]').forEach(field => {
        field.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.style.borderColor = '#dc2626';
            } else {
                this.style.borderColor = '';
            }
        });
        field.addEventListener('input', function() {
            if (this.value.trim()) {
                this.style.borderColor = '';
            }
        });
    });

    // ============================================================
    // 15. ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        await loadEngineers();
        setDefaultDates();
        
        fillSignatureFields('engineerFrom', 'userIdFrom', 'engineerFromName');
        fillSignatureFields('engineerTo', 'userIdTo', 'engineerToName');
        
        setupJobNumberMask();
        setupStorageAutofill();

        renderPhotoPreview();

        showAlert('🚀 Заполните форму и нажмите "Сгенерировать DOCX"', 'info');
    }

    init();

});