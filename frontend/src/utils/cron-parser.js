function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtTime(h, m) {
  return `${Number(h)}:${pad(m)}`;
}

function describeCron(s, m, h, dom, mon, dow, t) {
  const DAYS = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];
  const MONTHS = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
                 t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];

  let prefix = '';
  if (dow !== '*' && dow !== '?') {
    const toW = (d) => DAYS[Number(d)] || `${t('cDay')}${d}`;
    if (dow.includes(',')) {
      const parts = dow.split(',').map(d => toW(d));
      prefix = t('cEvery') + parts.join(t('cComma'));
    } else if (dow.includes('-')) {
      const [a, b] = dow.split('-').map(Number);
      prefix = t('cEveryDayRange', { start: toW(a), end: toW(b) });
    } else {
      prefix = t('cEvery') + toW(dow);
    }
  }

  if (dom !== '*' && dom !== '?') {
    prefix = t('cMonthly', { day: describeField(dom).replace(/\d+/g, '').trim() || dom });
  }

  if (mon !== '*' && mon !== '?') {
    const toM = (mo) => MONTHS[Number(mo) - 1] || `${mo}`;
    let monDesc;
    if (mon.includes(',')) {
      monDesc = mon.split(',').map(mo => toM(mo)).join(t('cComma'));
    } else if (mon.includes('-')) {
      const [a, b] = mon.split('-').map(Number);
      monDesc = t('cMonthRange', { start: toM(a), end: toM(b) });
    } else {
      monDesc = toM(mon);
    }
    prefix = prefix ? t('cPrefixMonth', { prefix, mon: monDesc }) : t('cEveryMonth', { mon: monDesc });
  }

  let timeDesc = '';
  if (h === '*' && m === '*' && s === '0') {
    timeDesc = t('cEveryMinute');
  } else if (h === '*' && m === '0' && s === '0') {
    timeDesc = t('cEveryHour');
  } else if (h.startsWith('*/')) {
    const interval = h.slice(2);
    if (m === '0') {
      timeDesc = t('cEveryNHours', { n: interval });
    } else {
      timeDesc = t('cEveryNHoursAt', { n: interval, min: m });
    }
  } else if (h !== '*') {
    if (h.includes(',')) {
      const hours = h.split(',').map(Number);
      timeDesc = hours.map(hh => fmtTime(hh, m)).join(t('cComma'));
    } else if (h.includes('-')) {
      const [start, end] = h.split('-').map(Number);
      timeDesc = t('cHourRange', { start: fmtTime(start, '00'), end: fmtTime(end, '00'), min: m === '0' ? '' : m });
    } else {
      timeDesc = fmtTime(h, m);
    }
  } else {
    if (m !== '*') {
      if (m.startsWith('*/')) {
        timeDesc = t('cEveryNMinutes', { n: m.slice(2) });
      } else if (m.includes(',')) {
        timeDesc = t('cNthMinute', { mins: m });
      } else if (m.includes('-')) {
        const [a, b] = m.split('-').map(Number);
        timeDesc = t('cMinuteRange', { start: a, end: b });
      } else {
        timeDesc = t('cEveryNMinutes', { n: m });
      }
    } else if (s !== '*' && s !== '0') {
      timeDesc = t('cEveryNSeconds', { n: s });
    }
  }

  if (prefix && timeDesc) return `${prefix} ${timeDesc}`;
  if (!prefix && timeDesc) return t('cDaily', { time: timeDesc });
  return prefix || timeDesc || '';
}

function describeField(value) {
  if (!value || value === '*') return '';
  if (value.startsWith('*/')) return value.slice(2);
  if (value.includes(',')) return value;
  if (value.includes('-')) return value;
  return value;
}

export function cronToNatural(cronExpr, t) {
  if (!cronExpr || typeof cronExpr !== 'string') return '';
  const trimmed = cronExpr.trim();
  if (trimmed.startsWith('@')) {
    const map = {
      '@every 1s': t('cEvery1Sec'),
      '@every 5s': t('cEvery5Sec'),
      '@every 10s': t('cEvery10Sec'),
      '@every 30s': t('cEvery30Sec'),
      '@every 1m': t('cEveryMinute'),
      '@every 2m': t('cEvery2Min'),
      '@every 5m': t('cEvery5Min'),
      '@every 10m': t('cEvery10Min'),
      '@every 15m': t('cEvery15Min'),
      '@every 30m': t('cEvery30Min'),
      '@hourly': t('cHourly'),
      '@daily': t('cDailyMidnight'),
      '@weekly': t('cWeeklyMidnight'),
      '@monthly': t('cMonthlyMidnight'),
      '@yearly': t('cYearlyMidnight'),
    };
    if (map[trimmed]) return map[trimmed];
    if (trimmed.startsWith('@every ')) return `${trimmed.slice(7)}`;
    return trimmed;
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6 && fields.length !== 5) return '';
  let s, m, h, dom, mon, dow;
  if (fields.length === 6) { [s, m, h, dom, mon, dow] = fields; }
  else { [m, h, dom, mon, dow] = fields; s = '0'; }
  return describeCron(s, m, h, dom, mon, dow, t);
}

export function cronToDescription(cronExpr, action, t) {
  if (!t) t = (k) => k; // fallback if no t provided
  const desc = cronToNatural(cronExpr, t);
  if (!desc) return '';
  const actionStr = action ? t('cronScheduled', { action }) : '';
  return `${desc}${actionStr ? ' ' + actionStr : ''}`;
}
