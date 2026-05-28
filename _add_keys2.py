import json
import os

# Translations for the 6 new keys per language
keys_data = {
    'en-US': {
        'subXrayUpdates':        'Xray Updates',
        'subKeepUpdated':        'Keep Xray Updated',
        'subAutoUpdateDesc':     'Automatically check for and update Xray to the latest version',
        'subScheduledUpdate':    'Scheduled Update Time',
        'subCronExpr':           'Cron expression',
        'subCronFormatHint':     'Format: second minute hour day month weekday',
    },
    'zh-CN': {
        'subXrayUpdates':        'Xray 更新',
        'subKeepUpdated':        '保持 Xray 更新',
        'subAutoUpdateDesc':     '自动检测并更新 Xray 到最新版本',
        'subScheduledUpdate':    '定时更新时间',
        'subCronExpr':           'Cron 表达式',
        'subCronFormatHint':     '格式：秒 分 时 日 月 星期',
    },
    'zh-TW': {
        'subXrayUpdates':        'Xray 更新',
        'subKeepUpdated':        '保持 Xray 更新',
        'subAutoUpdateDesc':     '自動檢測並更新 Xray 到最新版本',
        'subScheduledUpdate':    '定時更新時間',
        'subCronExpr':           'Cron 表達式',
        'subCronFormatHint':     '格式：秒 分 時 日 月 星期',
    },
    'ar-EG': {
        'subXrayUpdates':        'تحديثات Xray',
        'subKeepUpdated':        'حافظ على تحديث Xray',
        'subAutoUpdateDesc':     'التحقق تلقائيًا من وجود تحديثات لـ Xray وتثبيت أحدث إصدار',
        'subScheduledUpdate':    'وقت التحديث المجدول',
        'subCronExpr':           'تعبير Cron',
        'subCronFormatHint':     'الصيغة: ثانية دقيقة ساعة يوم شهر يوم_الأسبوع',
    },
    'es-ES': {
        'subXrayUpdates':        'Actualizaciones de Xray',
        'subKeepUpdated':        'Mantener Xray Actualizado',
        'subAutoUpdateDesc':     'Buscar y actualizar automáticamente Xray a la última versión',
        'subScheduledUpdate':    'Hora de Actualización Programada',
        'subCronExpr':           'Expresión Cron',
        'subCronFormatHint':     'Formato: segundo minuto hora día mes día_semana',
    },
    'fa-IR': {
        'subXrayUpdates':        'بروزرسانی‌های Xray',
        'subKeepUpdated':        'Xray را بروز نگه دار',
        'subAutoUpdateDesc':     'بررسی خودکار و بروزرسانی Xray به آخرین نسخه',
        'subScheduledUpdate':    'زمان بروزرسانی برنامه‌ریزی شده',
        'subCronExpr':           'عبارت Cron',
        'subCronFormatHint':     'قالب: ثانیه دقیقه ساعت روز ماه روز_هفته',
    },
    'id-ID': {
        'subXrayUpdates':        'Pembaruan Xray',
        'subKeepUpdated':        'Jaga Xray Tetap Terbaru',
        'subAutoUpdateDesc':     'Periksa dan perbarui Xray ke versi terbaru secara otomatis',
        'subScheduledUpdate':    'Waktu Pembaruan Terjadwal',
        'subCronExpr':           'Ekspresi Cron',
        'subCronFormatHint':     'Format: detik menit jam hari bulan hari_minggu',
    },
    'ja-JP': {
        'subXrayUpdates':        'Xray 更新',
        'subKeepUpdated':        'Xray を最新に保つ',
        'subAutoUpdateDesc':     'Xray の最新バージョンを自動的に確認して更新する',
        'subScheduledUpdate':    '定期更新時間',
        'subCronExpr':           'Cron 式',
        'subCronFormatHint':     '形式: 秒 分 時 日 月 曜日',
    },
    'pt-BR': {
        'subXrayUpdates':        'Atualizações do Xray',
        'subKeepUpdated':        'Manter o Xray Atualizado',
        'subAutoUpdateDesc':     'Verificar e atualizar automaticamente o Xray para a versão mais recente',
        'subScheduledUpdate':    'Horário de Atualização Agendada',
        'subCronExpr':           'Expressão Cron',
        'subCronFormatHint':     'Formato: segundo minuto hora dia mês dia_da_semana',
    },
    'ru-RU': {
        'subXrayUpdates':        'Обновления Xray',
        'subKeepUpdated':        'Поддерживать Xray в актуальном состоянии',
        'subAutoUpdateDesc':     'Автоматически проверять и обновлять Xray до последней версии',
        'subScheduledUpdate':    'Запланированное время обновления',
        'subCronExpr':           'Cron выражение',
        'subCronFormatHint':     'Формат: секунда минута час день месяц день_недели',
    },
    'tr-TR': {
        'subXrayUpdates':        'Xray Güncellemeleri',
        'subKeepUpdated':        "Xray'i Güncel Tut",
        'subAutoUpdateDesc':     "Xray'i otomatik olarak kontrol et ve en son sürüme güncelle",
        'subScheduledUpdate':    'Planlanmış Güncelleme Zamanı',
        'subCronExpr':           'Cron ifadesi',
        'subCronFormatHint':     'Format: saniye dakika saat gün ay haftanın_günü',
    },
    'uk-UA': {
        'subXrayUpdates':        'Оновлення Xray',
        'subKeepUpdated':        'Підтримувати Xray оновленим',
        'subAutoUpdateDesc':     'Автоматично перевіряти та оновлювати Xray до останньої версії',
        'subScheduledUpdate':    'Запланований час оновлення',
        'subCronExpr':           'Cron вираз',
        'subCronFormatHint':     'Формат: секунда хвилина година день місяць день_тижня',
    },
    'vi-VN': {
        'subXrayUpdates':        'Cập nhật Xray',
        'subKeepUpdated':        'Luôn Cập Nhật Xray',
        'subAutoUpdateDesc':     'Tự động kiểm tra và cập nhật Xray lên phiên bản mới nhất',
        'subScheduledUpdate':    'Thời gian Cập nhật Định kỳ',
        'subCronExpr':           'Biểu thức Cron',
        'subCronFormatHint':     'Định dạng: giây phút giờ ngày tháng thứ',
    },
}

base = 'web/translation'

# Alphabetical order of all keys
key_order = [
    'subAutoUpdateDesc',
    'subCronExpr',
    'subCronFormatHint',
    'subKeepUpdated',
    'subScheduledUpdate',
    'subXrayUpdates',
]

for lang, trans in keys_data.items():
    path = os.path.join(base, f'{lang}.json')

    # Read raw bytes to check for BOM
    with open(path, 'rb') as f:
        raw = f.read()
    has_bom = raw.startswith(b'\xef\xbb\xbf')
    content = raw.decode('utf-8-sig')

    # Parse JSON to ensure validity before modification
    data = json.loads(content)

    # Add keys to the data
    for key in key_order:
        data[key] = trans[key]

    # Write back with consistent formatting
    # We need to insert the new keys into the original text to preserve formatting
    # Find the last line before closing }
    lines = content.rstrip().split('\n')

    # Remove the final closing brace line(s)
    # The file ends with one or more } lines
    closing_lines = []
    while lines and lines[-1].strip() == '}':
        closing_lines.append(lines.pop())

    if not closing_lines:
        # No trailing } found, just append
        pass

    # Add the new keys right before the closing brace
    ind = '  '  # root-level indentation
    for key in key_order:
        val = json.dumps(trans[key], ensure_ascii=False)
        lines.append(f'{ind}"{key}": {val},')

    # Remove trailing comma from last added key and add closing brace(s)
    if lines:
        lines[-1] = lines[-1].rstrip(',')

    lines.extend(reversed(closing_lines))

    result = '\n'.join(lines) + '\n'

    with open(path, 'wb') as f:
        out = result.encode('utf-8')
        if has_bom:
            f.write(b'\xef\xbb\xbf')
        f.write(out)

    print(f'{lang}.json: added 6 keys')
