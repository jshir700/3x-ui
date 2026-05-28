import json
import os

files = {
    'en-US': {
        'subAutoUpdateDesc': 'Automatically check for and update Xray to the latest version',
        'subCronExpr': 'Cron expression',
        'subCronFormatHint': 'Format: second minute hour day month weekday',
        'subKeepUpdated': 'Keep Xray Updated',
        'subScheduledUpdate': 'Scheduled Update Time',
        'subXrayUpdates': 'Xray Updates'
    },
    'zh-CN': {
        'subAutoUpdateDesc': '自动检测并更新 Xray 到最新版本',
        'subCronExpr': 'Cron 表达式',
        'subCronFormatHint': '格式：秒 分 时 日 月 星期',
        'subKeepUpdated': '保持 Xray 更新',
        'subScheduledUpdate': '定时更新时间',
        'subXrayUpdates': 'Xray 更新'
    },
    'zh-TW': {
        'subAutoUpdateDesc': '自動檢測並更新 Xray 到最新版本',
        'subCronExpr': 'Cron 表達式',
        'subCronFormatHint': '格式：秒 分 時 日 月 星期',
        'subKeepUpdated': '保持 Xray 更新',
        'subScheduledUpdate': '定時更新時間',
        'subXrayUpdates': 'Xray 更新'
    },
    'ar-EG': {
        'subAutoUpdateDesc': 'التحقق تلقائيًا من وجود تحديثات لـ Xray وتثبيت أحدث إصدار',
        'subCronExpr': 'تعبير Cron',
        'subCronFormatHint': 'الصيغة: ثانية دقيقة ساعة يوم شهر يوم_الأسبوع',
        'subKeepUpdated': 'حافظ على تحديث Xray',
        'subScheduledUpdate': 'وقت التحديث المجدول',
        'subXrayUpdates': 'تحديثات Xray'
    },
    'es-ES': {
        'subAutoUpdateDesc': 'Buscar y actualizar automáticamente Xray a la última versión',
        'subCronExpr': 'Expresión Cron',
        'subCronFormatHint': 'Formato: segundo minuto hora día mes día_semana',
        'subKeepUpdated': 'Mantener Xray Actualizado',
        'subScheduledUpdate': 'Hora de Actualización Programada',
        'subXrayUpdates': 'Actualizaciones de Xray'
    },
    'fa-IR': {
        'subAutoUpdateDesc': 'بررسی خودکار و بروزرسانی Xray به آخرین نسخه',
        'subCronExpr': 'عبارت Cron',
        'subCronFormatHint': 'قالب: ثانیه دقیقه ساعت روز ماه روز_هفته',
        'subKeepUpdated': 'Xray را بروز نگه دار',
        'subScheduledUpdate': 'زمان بروزرسانی برنامه‌ریزی شده',
        'subXrayUpdates': 'بروزرسانی‌های Xray'
    },
    'id-ID': {
        'subAutoUpdateDesc': 'Periksa dan perbarui Xray ke versi terbaru secara otomatis',
        'subCronExpr': 'Ekspresi Cron',
        'subCronFormatHint': 'Format: detik menit jam hari bulan hari_minggu',
        'subKeepUpdated': 'Jaga Xray Tetap Terbaru',
        'subScheduledUpdate': 'Waktu Pembaruan Terjadwal',
        'subXrayUpdates': 'Pembaruan Xray'
    },
    'ja-JP': {
        'subAutoUpdateDesc': 'Xray の最新バージョンを自動的に確認して更新する',
        'subCronExpr': 'Cron 式',
        'subCronFormatHint': '形式: 秒 分 時 日 月 曜日',
        'subKeepUpdated': 'Xray を最新に保つ',
        'subScheduledUpdate': '定期更新時間',
        'subXrayUpdates': 'Xray 更新'
    },
    'pt-BR': {
        'subAutoUpdateDesc': 'Verificar e atualizar automaticamente o Xray para a versão mais recente',
        'subCronExpr': 'Expressão Cron',
        'subCronFormatHint': 'Formato: segundo minuto hora dia mês dia_da_semana',
        'subKeepUpdated': 'Manter o Xray Atualizado',
        'subScheduledUpdate': 'Horário de Atualização Agendada',
        'subXrayUpdates': 'Atualizações do Xray'
    },
    'ru-RU': {
        'subAutoUpdateDesc': 'Автоматически проверять и обновлять Xray до последней версии',
        'subCronExpr': 'Cron выражение',
        'subCronFormatHint': 'Формат: секунда минута час день месяц день_недели',
        'subKeepUpdated': 'Поддерживать Xray в актуальном состоянии',
        'subScheduledUpdate': 'Запланированное время обновления',
        'subXrayUpdates': 'Обновления Xray'
    },
    'tr-TR': {
        'subAutoUpdateDesc': "Xray'i otomatik olarak kontrol et ve en son sürüme güncelle",
        'subCronExpr': 'Cron ifadesi',
        'subCronFormatHint': 'Format: saniye dakika saat gün ay haftanın_günü',
        'subKeepUpdated': "Xray'i Güncel Tut",
        'subScheduledUpdate': 'Planlanmış Güncelleme Zamanı',
        'subXrayUpdates': 'Xray Güncellemeleri'
    },
    'uk-UA': {
        'subAutoUpdateDesc': 'Автоматично перевіряти та оновлювати Xray до останньої версії',
        'subCronExpr': 'Cron вираз',
        'subCronFormatHint': 'Формат: секунда хвилина година день місяць день_тижня',
        'subKeepUpdated': 'Підтримувати Xray оновленим',
        'subScheduledUpdate': 'Запланований час оновлення',
        'subXrayUpdates': 'Оновлення Xray'
    },
    'vi-VN': {
        'subAutoUpdateDesc': 'Tự động kiểm tra và cập nhật Xray lên phiên bản mới nhất',
        'subCronExpr': 'Biểu thức Cron',
        'subCronFormatHint': 'Định dạng: giây phút giờ ngày tháng thứ',
        'subKeepUpdated': 'Luôn Cập Nhật Xray',
        'subScheduledUpdate': 'Thời gian Cập nhật Định kỳ',
        'subXrayUpdates': 'Cập nhật Xray'
    }
}

base = 'web/translation'
ind = '    '

for lang, keys in files.items():
    path = os.path.join(base, f'{lang}.json')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    new_lines = []

    for line in lines:
        new_lines.append(line)
        stripped = line.rstrip('\r')

        # After subAutoIncludeHint
        if stripped == f'{ind}"subAutoIncludeHint": "Automatically adds all currently enabled inbounds",':
            new_lines.append(f'{ind}"subAutoUpdateDesc": "{keys["subAutoUpdateDesc"]}",')

        # After subItems
        if stripped == f'{ind}"subItems": "items",':
            new_lines.append(f'{ind}"subKeepUpdated": "{keys["subKeepUpdated"]}",')

        # After subUrlPlaceholder
        if stripped == f'{ind}"subUrlPlaceholder": "https://...",':
            new_lines.append(f'{ind}"subXrayUpdates": "{keys["subXrayUpdates"]}",')

        # After subSave
        if stripped == f'{ind}"subSave": "Save",':
            new_lines.append(f'{ind}"subScheduledUpdate": "{keys["subScheduledUpdate"]}",')

        # After subCreatedAt
        if stripped == f'{ind}"subCreatedAt": "Created",':
            new_lines.append(f'{ind}"subCronExpr": "{keys["subCronExpr"]}",')
            new_lines.append(f'{ind}"subCronFormatHint": "{keys["subCronFormatHint"]}",')

    result = '\n'.join(new_lines)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(result)

    print(f'{lang}.json: done')
