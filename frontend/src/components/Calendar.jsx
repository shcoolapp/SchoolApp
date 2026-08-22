import { useEffect, useState, useCallback } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

const COLORS = {
  exam: '#993556',
  homework: '#D4537E',
  weekend: '#97C459'
};

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [todosByDate, setTodosByDate] = useState({});
  const [holidayDates, setHolidayDates] = useState(new Set());
  const [popup, setPopup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = getStoredUser();
  const t = useTranslation();

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [todos, holidays, subjects] = await Promise.all([
        api.getTodos(monthKey),
        api.getHolidays(viewYear),
        api.getSubjects()
      ]);

      // Homework and exams live per-subject, so fetch them for every subject the
      // user can see, then merge into one day-keyed map alongside manual todos.
      const perSubject = await Promise.all(
        subjects.map((s) =>
          Promise.all([api.getSubjectHomework(s.id), api.getSubjectExams(s.id)]).then(
            ([homework, exams]) => ({ subject: s, homework, exams })
          )
        )
      );

      const grouped = {};
      const addItem = (day, entry) => {
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(entry);
      };

      for (const t of todos) {
        addItem(t.activity_date.slice(0, 10), {
          id: `todo-${t.id}`,
          item_type: 'todo',
          description: t.description,
          subject_name: t.subject_name
        });
      }

      for (const { subject, homework, exams } of perSubject) {
        for (const hw of homework) {
          addItem(hw.due_date.slice(0, 10), {
            id: `hw-${hw.id}`,
            item_type: 'homework',
            description: hw.title,
            subject_name: subject.name
          });
        }
        for (const ex of exams) {
          addItem(ex.exam_date.slice(0, 10), {
            id: `exam-${ex.id}`,
            item_type: 'exam',
            description: ex.scope || 'Exam',
            subject_name: subject.name
          });
        }
      }

      setTodosByDate(grouped);

      const holidaySet = new Set((holidays || []).map((h) => h.date));
      setHolidayDates(holidaySet);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [monthKey, viewYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ width: '100%' }}>
      <div style={styles.header}>
        <button style={styles.navBtn} onClick={() => changeMonth(-1)}>&#8249;</button>
        <div style={styles.monthLabel}>
          {new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' })} {viewYear}
        </div>
        <button style={styles.navBtn} onClick={() => changeMonth(1)}>&#8250;</button>
      </div>

      {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}

      <div style={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={styles.weekdayLabel}>{d}</div>
        ))}
      </div>

      <div style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;

          const dow = new Date(viewYear, viewMonth, d).getDay();
          const isWeekend = dow === 5 || dow === 6; // Friday=5, Saturday=6
          const key = dateKey(viewYear, viewMonth, d);
          const dayTodos = todosByDate[key] || [];
          const isHoliday = holidayDates.has(key);
          const isToday =
            viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();

          const examItems = dayTodos.filter((t) => t.item_type === 'exam');
          const hwItems = dayTodos.filter((t) => t.item_type === 'homework');

          let bg = 'var(--surface)';
          let shine = true;
          let headerText = '';
          let textColor = 'var(--text-primary)';

          if (examItems.length > 0) {
            bg = COLORS.exam;
            shine = false;
            textColor = '#fff';
            headerText = examItems.length > 1 ? `Exam +${examItems.length - 1}` : 'Exam';
          } else if (hwItems.length > 0) {
            bg = COLORS.homework;
            textColor = '#fff';
            headerText = hwItems.length > 1 ? `H.W +${hwItems.length - 1}` : 'H.W';
          } else if (isWeekend || isHoliday) {
            bg = COLORS.weekend;
            textColor = '#173404';
          }

          const hasItems = dayTodos.length > 0;

          return (
            <div
              key={i}
              onClick={() => hasItems && setPopup({ day: d, items: dayTodos })}
              style={{
                ...styles.cell,
                background: bg,
                backgroundImage: shine
                  ? 'linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)'
                  : 'none',
                outline: isToday ? '2px solid #EF9F27' : 'none',
                outlineOffset: '-2px',
                cursor: hasItems ? 'pointer' : 'default'
              }}
            >
              {headerText && <div style={{ fontSize: '0.625rem', fontWeight: 500, color: textColor, opacity: 0.9 }}>{headerText}</div>}
              <div style={{ fontSize: '0.875rem', color: textColor, fontWeight: isToday ? 500 : 400 }}>{d}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.legend}>
        <LegendItem color={COLORS.exam} label={t('exam')} />
        <LegendItem color={COLORS.homework} label={t('homeworkDue')} />
        <LegendItem color={COLORS.weekend} label={t('weekendHoliday')} />
      </div>

      {popup && (
        <div style={styles.popup}>
          <div style={styles.popupHeader}>
            <p style={{ fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
              {new Date(viewYear, viewMonth, popup.day).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
            </p>
            <button style={styles.closeBtn} onClick={() => setPopup(null)}>&times;</button>
          </div>
          {popup.items.map((item) => (
            <div key={item.id} style={styles.popupItem}>
              {item.description} <span style={{ color: 'var(--text-secondary)' }}>— {item.subject_name}</span>
            </div>
          ))}
          {user?.role === 'teacher' && (
            <button style={styles.addBtn}>+ {t('add')}</button>
          )}
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
      <span style={{ width: '10px', height: '10px', background: color, borderRadius: '2px', display: 'inline-block' }} />
      {label}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  navBtn: { width: '32px', height: '32px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer' },
  monthLabel: { fontSize: '1.125rem', fontWeight: 500 },
  weekdays: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '4px' },
  weekdayLabel: {},
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' },
  cell: { borderRadius: '8px', padding: '8px 6px', minHeight: '100px', position: 'relative', border: '1px solid var(--border)' },
  legend: { display: 'flex', gap: '16px', marginTop: '1rem', flexWrap: 'wrap' },
  popup: { marginTop: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' },
  popupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  closeBtn: { border: 'none', background: 'transparent', fontSize: '1.125rem', cursor: 'pointer', lineHeight: 1 },
  popupItem: { padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' },
  addBtn: { marginTop: '12px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.812rem' }
};
