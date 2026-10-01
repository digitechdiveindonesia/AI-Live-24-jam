import { LiveSchedule } from '../../db/schema';
import { db } from '../../db';

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

export interface NextRunCalculation {
  nextStartTime: string | null;
  nextEndTime: string | null;
  isCurrentlyInWindow: boolean;
  timeUntilStartMs: number | null;
  timeUntilEndMs: number | null;
}

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class ScheduleService {
  private static instance: ScheduleService;

  private constructor() {}

  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService();
    }
    return ScheduleService.instance;
  }

  public validateTimezone(timezone: string): { valid: boolean; error?: string } {
    if (!timezone) return { valid: false, error: 'Timezone must be specified' };
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return { valid: true };
    } catch {
      return { valid: false, error: `Invalid IANA timezone identifier: "${timezone}"` };
    }
  }

  public validateTimeRanges(startTime: string, endTime: string): { valid: boolean; error?: string } {
    if (!startTime || !TIME_REGEX.test(startTime)) {
      return { valid: false, error: 'Start time must be formatted as HH:mm (24-hour, e.g. "10:00")' };
    }
    if (!endTime || !TIME_REGEX.test(endTime)) {
      return { valid: false, error: 'End time must be formatted as HH:mm (24-hour, e.g. "20:00")' };
    }
    if (startTime === endTime) {
      return { valid: false, error: 'Start time and end time cannot be identical' };
    }
    return { valid: true };
  }

  public preventOverlappingSchedules(
    schedule: Partial<LiveSchedule>,
    existingScheduleId?: string
  ): { valid: boolean; overlappingSchedule?: LiveSchedule; error?: string } {
    const startTime = schedule.startTime || schedule.start_time;
    const endTime = schedule.endTime || schedule.end_time;
    const days = (schedule.daysOfWeek || schedule.days_of_week || []).map(d => d.toUpperCase());

    if (!schedule.enabled || !startTime || !endTime || days.length === 0) {
      return { valid: true };
    }

    const existing = db.getSchedules().filter(s => s.enabled && s.id !== existingScheduleId);
    for (const ex of existing) {
      const exDays = (ex.daysOfWeek || ex.days_of_week || []).map(d => d.toUpperCase());
      const sharedDays = days.filter(d => exDays.includes(d));
      if (sharedDays.length > 0) {
        const exStart = ex.startTime || ex.start_time || '10:00';
        const exEnd = ex.endTime || ex.end_time || '20:00';
        if (this.checkTimesOverlap(startTime, endTime, exStart, exEnd)) {
          return {
            valid: false,
            overlappingSchedule: ex,
            error: `Schedule overlaps with active schedule "${ex.name}" on ${sharedDays.join(', ')}`
          };
        }
      }
    }
    return { valid: true };
  }

  /**
   * Validates schedule integrity, timezone validity, time format, and logical consistency.
   */
  public validateSchedule(schedule: Partial<LiveSchedule>, existingScheduleId?: string): ScheduleValidationResult {
    const errors: string[] = [];

    if (!schedule.name || schedule.name.trim().length === 0) {
      errors.push('Schedule name cannot be empty');
    }

    // Timezone validation (Default: Asia/Jakarta)
    const tz = schedule.timezone || 'Asia/Jakarta';
    const tzRes = this.validateTimezone(tz);
    if (!tzRes.valid && tzRes.error) {
      errors.push(tzRes.error);
    }

    // Days of week validation
    const days = schedule.daysOfWeek || schedule.days_of_week;
    if (!days || days.length === 0) {
      errors.push('At least one day of the week must be selected');
    } else {
      const invalidDays = days.filter(d => !VALID_DAYS.includes(d.toUpperCase()));
      if (invalidDays.length > 0) {
        errors.push(`Invalid day(s) of week: ${invalidDays.join(', ')}. Must be one of: ${VALID_DAYS.join(', ')}`);
      }
    }

    // Time formats
    const startTime = schedule.startTime || schedule.start_time;
    const endTime = schedule.endTime || schedule.end_time;
    if (startTime && endTime) {
      const timeRes = this.validateTimeRanges(startTime, endTime);
      if (!timeRes.valid && timeRes.error) {
        errors.push(timeRes.error);
      }
    } else {
      if (!startTime) errors.push('Start time must be formatted as HH:mm (24-hour, e.g. "10:00")');
      if (!endTime) errors.push('End time must be formatted as HH:mm (24-hour, e.g. "20:00")');
    }

    // Overlapping schedule validation for enabled schedules
    if (errors.length === 0 && schedule.enabled) {
      const overlapRes = this.preventOverlappingSchedules(schedule, existingScheduleId);
      if (!overlapRes.valid && overlapRes.error) {
        errors.push(overlapRes.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private checkTimesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    if (e1 < s1) e1 += 1440; // Cross-midnight adjustment

    const s2 = toMinutes(start2);
    let e2 = toMinutes(end2);
    if (e2 < s2) e2 += 1440;

    return Math.max(s1, s2) < Math.min(e1, e2);
  }

  public getSchedules(): LiveSchedule[] {
    return db.getSchedules();
  }

  public getScheduleById(id: string): LiveSchedule | undefined {
    return db.getScheduleById(id);
  }

  public createSchedule(params: Omit<LiveSchedule, 'id' | 'createdAt' | 'updatedAt'>): { schedule?: LiveSchedule; errors?: string[] } {
    const validation = this.validateSchedule(params);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const schedule: LiveSchedule = {
      ...params,
      id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      daysOfWeek: params.daysOfWeek.map(d => d.toUpperCase()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveSchedule(schedule);
    return { schedule };
  }

  public updateSchedule(id: string, updates: Partial<LiveSchedule>): { schedule?: LiveSchedule; errors?: string[] } {
    const existing = db.getScheduleById(id);
    if (!existing) {
      return { errors: [`Schedule with ID ${id} not found`] };
    }

    const merged = { ...existing, ...updates };
    const validation = this.validateSchedule(merged, id);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const updated = db.saveSchedule(merged);
    return { schedule: updated };
  }

  public deleteSchedule(id: string): boolean {
    return db.deleteSchedule(id);
  }

  public enableSchedule(id: string): LiveSchedule | undefined {
    const schedule = db.getScheduleById(id);
    if (schedule) {
      schedule.enabled = true;
      return db.saveSchedule(schedule);
    }
    return undefined;
  }

  public disableSchedule(id: string): LiveSchedule | undefined {
    const schedule = db.getScheduleById(id);
    if (schedule) {
      schedule.enabled = false;
      return db.saveSchedule(schedule);
    }
    return undefined;
  }

  /**
   * Calculates current time components within the schedule's specified IANA timezone.
   */
  public getTimeInTimezone(date: Date, timezone: string): { dayOfWeek: string; timeString: string; hours: number; minutes: number } {
    const dtfDay = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
    const dayOfWeek = dtfDay.format(date).toUpperCase(); // e.g. "MON"

    const dtfTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const timeString = dtfTime.format(date); // "HH:mm"
    const [hours, minutes] = timeString.split(':').map(Number);

    return { dayOfWeek, timeString, hours, minutes };
  }

  /**
   * Checks whether the current moment falls within the active scheduled window.
   */
  public isCurrentlyInWindow(schedule: LiveSchedule, date: Date = new Date()): boolean {
    if (!schedule.enabled) return false;

    const { dayOfWeek, timeString } = this.getTimeInTimezone(date, schedule.timezone);
    if (!schedule.daysOfWeek.includes(dayOfWeek)) return false;

    const [curH, curM] = timeString.split(':').map(Number);
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const curMin = curH * 60 + curM;
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (endMin > startMin) {
      // Normal schedule (e.g. 10:00 to 20:00)
      return curMin >= startMin && curMin < endMin;
    } else {
      // Cross-midnight schedule (e.g. 22:00 to 04:00)
      return curMin >= startMin || curMin < endMin;
    }
  }

  /**
   * Evaluates if the schedule start condition is triggered now.
   */
  public shouldStartNow(schedule: LiveSchedule, date: Date = new Date()): boolean {
    if (!schedule.enabled) return false;
    const { dayOfWeek, timeString } = this.getTimeInTimezone(date, schedule.timezone);
    if (!schedule.daysOfWeek.includes(dayOfWeek)) return false;
    return timeString === schedule.startTime;
  }

  /**
   * Evaluates if the schedule stop condition is triggered now.
   */
  public shouldStopNow(schedule: LiveSchedule, date: Date = new Date()): boolean {
    if (!schedule.enabled) return false;
    const { timeString } = this.getTimeInTimezone(date, schedule.timezone);
    return timeString === schedule.endTime;
  }

  /**
   * Computes next scheduled run dates and remaining time until next live broadcast.
   */
  public getNextRun(schedule: LiveSchedule, fromDate: Date = new Date()): NextRunCalculation {
    const isCurrentlyIn = this.isCurrentlyInWindow(schedule, fromDate);

    // If schedule disabled, return null runs
    if (!schedule.enabled) {
      return {
        nextStartTime: null,
        nextEndTime: null,
        isCurrentlyInWindow: false,
        timeUntilStartMs: null,
        timeUntilEndMs: null
      };
    }

    const { dayOfWeek, timeString } = this.getTimeInTimezone(fromDate, schedule.timezone);
    const [curH, curM] = timeString.split(':').map(Number);
    const curMin = curH * 60 + curM;

    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const startMin = startH * 60 + startM;

    // Check if starts later today
    const isTodayScheduled = schedule.daysOfWeek.includes(dayOfWeek);
    let daysUntilStart = 0;

    if (isTodayScheduled && curMin < startMin) {
      daysUntilStart = 0;
    } else {
      // Find next day of week
      const dayOrder = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const curDayIdx = dayOrder.indexOf(dayOfWeek);
      for (let offset = 1; offset <= 7; offset++) {
        const nextDay = dayOrder[(curDayIdx + offset) % 7];
        if (schedule.daysOfWeek.includes(nextDay)) {
          daysUntilStart = offset;
          break;
        }
      }
    }

    const nextStartDate = new Date(fromDate.getTime() + daysUntilStart * 86400000);
    const nextStartIso = nextStartDate.toISOString().split('T')[0] + `T${schedule.startTime}:00`;
    const nextEndIso = nextStartDate.toISOString().split('T')[0] + `T${schedule.endTime}:00`;

    const nextStartTime = new Date(nextStartIso).toISOString();
    const nextEndTime = new Date(nextEndIso).toISOString();

    const timeUntilStartMs = Math.max(0, new Date(nextStartTime).getTime() - fromDate.getTime());
    const timeUntilEndMs = Math.max(0, new Date(nextEndTime).getTime() - fromDate.getTime());

    return {
      nextStartTime,
      nextEndTime,
      isCurrentlyInWindow: isCurrentlyIn,
      timeUntilStartMs: isCurrentlyIn ? 0 : timeUntilStartMs,
      timeUntilEndMs: isCurrentlyIn ? timeUntilEndMs : null
    };
  }

  public calculateNextStart(schedule: LiveSchedule, fromDate: Date = new Date()): string | null {
    return this.getNextRun(schedule, fromDate).nextStartTime;
  }

  public calculateNextStop(schedule: LiveSchedule, fromDate: Date = new Date()): string | null {
    return this.getNextRun(schedule, fromDate).nextEndTime;
  }

  /**
   * Evaluates all enabled schedules to determine if the runtime should currently be active.
   */
  public determineWhetherRuntimeShouldBeActive(date: Date = new Date()): {
    shouldBeActive: boolean;
    activeSchedule?: LiveSchedule;
    reason: string;
  } {
    const schedules = db.getSchedules().filter(s => s.enabled);
    for (const s of schedules) {
      if (this.isCurrentlyInWindow(s, date)) {
        return {
          shouldBeActive: true,
          activeSchedule: s,
          reason: `Within scheduled live window for "${s.name}" (${s.startTime} - ${s.endTime} ${s.timezone})`
        };
      }
    }

    return {
      shouldBeActive: false,
      reason: 'No active schedule window at the current time (Scale-to-Zero)'
    };
  }
}

export const scheduleService = ScheduleService.getInstance();
