import { useMemo } from 'react';
import { ConfigProvider, DatePicker } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { PersianDateTimePicker } from 'persian-calendar-suite';

import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/fa';
import 'dayjs/locale/id';
import 'dayjs/locale/ja';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ru';
import 'dayjs/locale/tr';
import 'dayjs/locale/uk';
import 'dayjs/locale/vi';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';

import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import faIR from 'antd/locale/fa_IR';
import idID from 'antd/locale/id_ID';
import jaJP from 'antd/locale/ja_JP';
import ptBR from 'antd/locale/pt_BR';
import ruRU from 'antd/locale/ru_RU';
import trTR from 'antd/locale/tr_TR';
import ukUA from 'antd/locale/uk_UA';
import viVN from 'antd/locale/vi_VN';
import zhCN from 'antd/locale/zh_CN';
import zhTW from 'antd/locale/zh_TW';

const langToDayjsLocale: Record<string, string> = {
  'ar-EG': 'ar',
  'en-US': 'en',
  'es-ES': 'es',
  'fa-IR': 'fa',
  'id-ID': 'id',
  'ja-JP': 'ja',
  'pt-BR': 'pt-br',
  'ru-RU': 'ru',
  'tr-TR': 'tr',
  'uk-UA': 'uk',
  'vi-VN': 'vi',
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
};

import { useDatepicker } from '@/hooks/useDatepicker';
import { useTheme } from '@/hooks/useTheme';
import { LanguageManager } from '@/utils';
import './DateTimePicker.css';

const antdLocales: Record<string, any> = {
  'ar-EG': arEG,
  'en-US': enUS,
  'es-ES': esES,
  'fa-IR': faIR,
  'id-ID': idID,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'tr-TR': trTR,
  'uk-UA': ukUA,
  'vi-VN': viVN,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

interface DateTimePickerProps {
  value: Dayjs | null;
  onChange: (next: Dayjs | null) => void;
  showTime?: boolean;
  format?: string;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const LIGHT_THEME = {
  primaryColor: '#1677ff',
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  hoverColor: 'rgba(22, 119, 255, 0.10)',
  selectedTextColor: '#ffffff',
  textColor: 'rgba(0, 0, 0, 0.88)',
};

const DARK_THEME = {
  primaryColor: '#1677ff',
  backgroundColor: '#23252b',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  hoverColor: 'rgba(22, 119, 255, 0.18)',
  selectedTextColor: '#ffffff',
  textColor: 'rgba(255, 255, 255, 0.88)',
};

const ULTRA_DARK_THEME = {
  primaryColor: '#1677ff',
  backgroundColor: '#101013',
  borderColor: 'rgba(255, 255, 255, 0.08)',
  hoverColor: 'rgba(22, 119, 255, 0.16)',
  selectedTextColor: '#ffffff',
  textColor: 'rgba(255, 255, 255, 0.88)',
};

const FALLBACK_LANG = {
  shortWeekDays: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  shortMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
};

// dayjs built-in 'en' locale has no formats in Ls registry (dayjs bug).
// Use hardcoded values so we don't rely on catching the TypeError every render.
const EN_FORMATS = {
  date: 'MM/DD/YYYY',
  time: 'HH:mm:ss',
  datetime: 'MM/DD/YYYY HH:mm:ss',
};

// Strip Unicode bidirectional control characters that dayjs locale data
// may embed in format strings (e.g. Arabic 'ar' includes U+200F RTL marks).
// antd DatePicker handles RTL layout via ConfigProvider, so these are noise.
const STRIP_BIDI = /[‎‏‪-‮⁦-⁩]/g;

const FALLBACK_FORMATS = {
  date: 'MM/DD/YYYY',
  time: 'HH:mm:ss',
  datetime: 'MM/DD/YYYY HH:mm:ss',
};

export default function DateTimePicker({
  value,
  onChange,
  showTime = true,
  format,
  placeholder = '',
  disabled = false,
  style,
  className,
}: DateTimePickerProps) {
  const { datepicker } = useDatepicker();
  const { isDark, isUltra } = useTheme();
  const language = LanguageManager.getLanguage();
  const antdLocale = antdLocales[language] || enUS;
  // antd CJS locale modules may be double-wrapped by rolldown interop.
  // Only unwrap when .default actually contains DatePicker sub-locale data.
  const actualLocale = (antdLocale.default && antdLocale.default.DatePicker) ? antdLocale.default : antdLocale;

  const dayjsLocale = langToDayjsLocale[language] || 'en';
  dayjs.locale(dayjsLocale);

  const localeFormats = useMemo(() => {
    // dayjs built-in 'en' locale has undefined formats — short-circuit.
    if (dayjsLocale === 'en') return EN_FORMATS;
    try {
      const data = dayjs().localeData();
      if (!data) return FALLBACK_FORMATS;
      const l = data.longDateFormat('L').replace(STRIP_BIDI, '');
      if (!l) return FALLBACK_FORMATS;
      const time = (data.longDateFormat('LTS') || FALLBACK_FORMATS.time).replace(STRIP_BIDI, '');
      return {
        date: l,
        time,
        datetime: `${l} ${time}`,
      };
    } catch {
      return FALLBACK_FORMATS;
    }
  }, [dayjsLocale]);

  const datePickerLocaleOverrides = useMemo(() => {
    // dayjs built-in 'en' locale has undefined formats — short-circuit.
    if (dayjsLocale === 'en') return { lang: FALLBACK_LANG };
    try {
      const data = dayjs().localeData();
      if (!data) return { lang: FALLBACK_LANG };
      return {
        lang: {
          shortWeekDays: data.weekdaysMin() || FALLBACK_LANG.shortWeekDays,
          shortMonths: data.monthsShort() || FALLBACK_LANG.shortMonths,
        },
      };
    } catch {
      return { lang: FALLBACK_LANG };
    }
  }, [dayjsLocale]);

  const persianTheme = useMemo(() => {
    if (isUltra) return ULTRA_DARK_THEME;
    if (isDark) return DARK_THEME;
    return LIGHT_THEME;
  }, [isDark, isUltra]);

  if (datepicker === 'jalalian') {
    return (
      <div className={`jdp-wrap${isDark ? ' jdp-dark' : ''}${isUltra ? ' jdp-ultra' : ''}${disabled ? ' jdp-disabled' : ''}${className ? ` ${className}` : ''}`} style={style}>
        <PersianDateTimePicker
          value={value ? value.valueOf() : null}
          onChange={(next: number | string | null) => {
            if (next == null || next === '') {
              onChange(null);
              return;
            }
            const ms = typeof next === 'number' ? next : Number(next);
            if (Number.isFinite(ms)) onChange(dayjs(ms));
          }}
          showTime={showTime}
          outputFormat="timestamp"
          persianNumbers
          rtlCalendar
          theme={persianTheme}
        />
      </div>
    );
  }

  return (
    <ConfigProvider locale={actualLocale}>
      <DatePicker
        value={value}
        onChange={(next) => onChange(next || null)}
        showTime={showTime ? { format: localeFormats.time } : false}
        format={format || localeFormats.datetime}
        placeholder={placeholder}
        disabled={disabled}
        needConfirm={false}
        locale={actualLocale.DatePicker ? { ...actualLocale.DatePicker, lang: { ...actualLocale.DatePicker.lang, ...datePickerLocaleOverrides.lang } } : undefined}
        style={style}
        className={className}
      />
    </ConfigProvider>
  );
}
