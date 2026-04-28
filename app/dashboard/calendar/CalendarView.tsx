"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import styles from "./CalendarView.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "day";
type EventSource = "calendar" | "crm" | "mail" | "messaging";

interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  source: EventSource;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const START_HOUR = 8;  // 8 am
const END_HOUR = 19;   // 7 pm (last visible hour label)
const SLOT_PX = 64;    // px per hour
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  for (let i = startDow; i > 0; i--) {
    days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  let trailing = 1;
  while (days.length < 42) {
    days.push({ date: new Date(year, month + 1, trailing++), isCurrentMonth: false });
  }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const dow = date.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date);
    d.setDate(date.getDate() - dow + i);
    return d;
  });
}

function getEventTop(event: CalEvent): number {
  return ((event.startHour - START_HOUR) + event.startMin / 60) * SLOT_PX;
}

function getEventHeight(event: CalEvent): number {
  const duration = (event.endHour - event.startHour) + (event.endMin - event.startMin) / 60;
  return Math.max(duration * SLOT_PX, 22);
}

function formatTime(h: number, m: number): string {
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// ── Root component ────────────────────────────────────────────────────────────

export default function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalEvent[]>>({});

  useEffect(() => {
    fetch("/api/calendar-events")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, CalEvent[]> = {};
        for (const ev of data as Array<{ id: string; title: string; startIso: string; endIso: string | null; source: string }>) {
          const start = new Date(ev.startIso);
          const end = ev.endIso ? new Date(ev.endIso) : new Date(start.getTime() + 30 * 60 * 1000);
          const key = toDateKey(start);
          const event: CalEvent = {
            id: ev.id,
            title: ev.title,
            date: key,
            startHour: start.getHours(),
            startMin: start.getMinutes(),
            endHour: end.getHours(),
            endMin: end.getMinutes(),
            source: "calendar",
          };
          if (!map[key]) map[key] = [];
          map[key].push(event);
        }
        setEventsByDate(map);
      })
      .catch(() => {});
  }, []);

  function navigate(dir: -1 | 1) {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + dir);
    else if (viewMode === "week") next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setCurrentDate(next);
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const navTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === "week") {
      const week = getWeekDays(currentDate);
      const start = week[0];
      const end = week[6];
      if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${DAYS_SHORT[currentDate.getDay()]}, ${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  }, [viewMode, currentDate]);

  const monthGrid = useMemo(
    () => (viewMode === "month" ? getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()) : []),
    [viewMode, currentDate]
  );

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = useMemo(() => new Date(), []);

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <Link href="/" className={styles.breadcrumb}>
        <ChevronLeft size={14} aria-hidden="true" />
        Dashboard
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>
            <Calendar size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className={styles.heading}>Calendar</h1>
            <p className={styles.subheading}>Events, tasks, and meetings across all services</p>
          </div>
        </div>

        <div className={styles.viewSelector} role="group" aria-label="Calendar view">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`${styles.viewBtn} ${viewMode === mode ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation bar */}
      <div className={styles.navBar}>
        <div className={styles.navControls}>
          <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.todayBtn} onClick={goToday}>Today</button>
          <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Next">
            <ChevronRight size={16} />
          </button>
        </div>
        <span className={styles.navTitle}>{navTitle}</span>
        <div className={styles.legend} aria-label="Event source legend">
          {([
            { key: "calendar", label: "Calendar" },
            { key: "crm", label: "CRM tasks" },
            { key: "mail", label: "Email meetings" },
            { key: "messaging", label: "Messaging" },
          ] as { key: EventSource; label: string }[]).map(({ key, label }) => (
            <div key={key} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles[`legendDot_${key}`]}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Calendar body */}
      <div className={styles.calendarArea}>
        {viewMode === "month" && (
          <MonthView
            grid={monthGrid}
            today={today}
            eventsByDate={eventsByDate}
          />
        )}
        {viewMode === "week" && (
          <WeekView days={weekDays} today={today} eventsByDate={eventsByDate} />
        )}
        {viewMode === "day" && (
          <DayView
            date={currentDate}
            today={today}
            events={eventsByDate[toDateKey(currentDate)] || []}
          />
        )}
      </div>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  grid,
  today,
  eventsByDate,
}: {
  grid: Array<{ date: Date; isCurrentMonth: boolean }>;
  today: Date;
  eventsByDate: Record<string, CalEvent[]>;
}) {
  return (
    <div className={styles.monthGrid}>
      {DAYS_SHORT.map((day) => (
        <div key={day} className={styles.monthDayHeader}>{day}</div>
      ))}
      {grid.map(({ date, isCurrentMonth }, i) => {
        const key = toDateKey(date);
        const events = eventsByDate[key] || [];
        const isToday = isSameDay(date, today);
        return (
          <div
            key={i}
            className={[
              styles.monthCell,
              !isCurrentMonth && styles.monthCellOther,
              isToday && styles.monthCellToday,
            ].filter(Boolean).join(" ")}
          >
            <span className={`${styles.monthDate} ${isToday ? styles.monthDateToday : ""}`}>
              {date.getDate()}
            </span>
            <div className={styles.monthEvents}>
              {events.slice(0, 3).map((evt) => (
                <EventChip key={evt.id} event={evt} />
              ))}
              {events.length > 3 && (
                <span className={styles.monthMore}>+{events.length - 3} more</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  days,
  today,
  eventsByDate,
}: {
  days: Date[];
  today: Date;
  eventsByDate: Record<string, CalEvent[]>;
}) {
  return (
    <div className={styles.timeGridRoot}>
      {/* Day header row */}
      <div className={styles.weekHeader}>
        <div className={styles.timeGutterCorner} />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderToday : ""}`}>
              <span className={styles.dayName}>{DAYS_SHORT[day.getDay()]}</span>
              <span className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ""}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className={styles.timeGridBody}>
        <div className={styles.timeGutterCol}>
          {HOURS.map((h) => (
            <div key={h} className={styles.timeLabel} style={{ height: SLOT_PX }}>
              {h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
            </div>
          ))}
        </div>
        {days.map((day, di) => {
          const dayEvents = (eventsByDate[toDateKey(day)] || []).filter(
            (e) => e.startHour >= START_HOUR && e.startHour < END_HOUR
          );
          const isToday = isSameDay(day, today);
          return (
            <div
              key={di}
              className={`${styles.dayCol} ${isToday ? styles.dayColToday : ""}`}
              style={{ height: HOURS.length * SLOT_PX }}
            >
              {HOURS.map((h) => (
                <div key={h} className={styles.hourLine} style={{ top: (h - START_HOUR) * SLOT_PX }} />
              ))}
              {dayEvents.map((evt) => (
                <TimeBlock key={evt.id} event={evt} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({
  date,
  today,
  events,
}: {
  date: Date;
  today: Date;
  events: CalEvent[];
}) {
  const isToday = isSameDay(date, today);
  const visibleEvents = events.filter(
    (e) => e.startHour >= START_HOUR && e.startHour < END_HOUR
  );

  return (
    <div className={styles.timeGridRoot}>
      {/* Day header */}
      <div className={styles.weekHeader}>
        <div className={styles.timeGutterCorner} />
        <div className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderToday : ""}`}>
          <span className={styles.dayName}>{DAYS_SHORT[date.getDay()]}</span>
          <span className={`${styles.dayNum} ${styles.dayNumLg} ${isToday ? styles.dayNumToday : ""}`}>
            {date.getDate()}
          </span>
        </div>
      </div>

      {/* Scrollable time grid */}
      <div className={styles.timeGridBody}>
        <div className={styles.timeGutterCol}>
          {HOURS.map((h) => (
            <div key={h} className={styles.timeLabel} style={{ height: SLOT_PX }}>
              {h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}
            </div>
          ))}
        </div>
        <div
          className={`${styles.dayCol} ${styles.dayColWide} ${isToday ? styles.dayColToday : ""}`}
          style={{ height: HOURS.length * SLOT_PX }}
        >
          {HOURS.map((h) => (
            <div key={h} className={styles.hourLine} style={{ top: (h - START_HOUR) * SLOT_PX }} />
          ))}
          {visibleEvents.map((evt) => (
            <TimeBlock key={evt.id} event={evt} wide />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EventChip({ event }: { event: CalEvent }) {
  return (
    <div
      className={`${styles.eventChip} ${styles[`eventChip_${event.source}`]}`}
      title={event.title}
    >
      {event.title}
    </div>
  );
}

function TimeBlock({ event, wide = false }: { event: CalEvent; wide?: boolean }) {
  const top = getEventTop(event);
  const height = getEventHeight(event);
  return (
    <div
      className={`${styles.timeBlock} ${styles[`timeBlock_${event.source}`]}`}
      style={{ top, height, left: 3, right: wide ? 3 : 6 }}
      title={`${event.title} · ${formatTime(event.startHour, event.startMin)}–${formatTime(event.endHour, event.endMin)}`}
    >
      <span className={styles.timeBlockTitle}>{event.title}</span>
      {height >= 38 && (
        <span className={styles.timeBlockTime}>
          {formatTime(event.startHour, event.startMin)}–{formatTime(event.endHour, event.endMin)}
        </span>
      )}
    </div>
  );
}
