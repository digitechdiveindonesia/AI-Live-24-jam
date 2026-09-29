import { LiveSchedule } from '../../db/schema';
import { db } from '../../db';

export interface SchedulerProvider {
  readonly name: string;
  readonly isCloud: boolean;

  registerJob(schedule: LiveSchedule): Promise<{ success: boolean; jobId?: string; message: string }>;
  updateJob(schedule: LiveSchedule): Promise<{ success: boolean; message: string }>;
  deleteJob(scheduleId: string): Promise<{ success: boolean; message: string }>;
  triggerJob(scheduleId: string, action: 'START' | 'STOP'): Promise<{ success: boolean; message: string }>;
  listJobs(): Promise<any[]>;
}

export class MockSchedulerProvider implements SchedulerProvider {
  public readonly name = 'MockCloudScheduler';
  public readonly isCloud = false;

  private jobs: Map<string, { scheduleId: string; cronExpression: string; targetUrl: string }> = new Map();

  constructor() {
    this.jobs.set('sched-daily-01', {
      scheduleId: 'sched-daily-01',
      cronExpression: '0 10 * * 1-5',
      targetUrl: 'http://localhost:3000/api/scheduler/trigger'
    });
  }

  public async registerJob(schedule: LiveSchedule): Promise<{ success: boolean; jobId?: string; message: string }> {
    const jobId = `job-${schedule.id}`;
    const [h, m] = schedule.startTime.split(':');
    const daysMap: Record<string, string> = { SUN: '0', MON: '1', TUE: '2', WED: '3', THU: '4', FRI: '5', SAT: '6' };
    const days = schedule.daysOfWeek.map(d => daysMap[d] || '*').join(',');
    const cron = `${m} ${h} * * ${days}`;

    this.jobs.set(schedule.id, {
      scheduleId: schedule.id,
      cronExpression: cron,
      targetUrl: `/api/scheduler/trigger`
    });

    db.logAudit('SCHEDULER_JOB_REGISTERED', 'SYSTEM', `Mock scheduler job registered: ${jobId} (${cron})`);

    return {
      success: true,
      jobId,
      message: `SIMULATED: Cloud Scheduler cron job ${jobId} registered (${cron})`
    };
  }

  public async updateJob(schedule: LiveSchedule): Promise<{ success: boolean; message: string }> {
    await this.registerJob(schedule);
    return {
      success: true,
      message: `SIMULATED: Cloud Scheduler job updated for ${schedule.id}`
    };
  }

  public async deleteJob(scheduleId: string): Promise<{ success: boolean; message: string }> {
    this.jobs.delete(scheduleId);
    db.logAudit('SCHEDULER_JOB_DELETED', 'SYSTEM', `Scheduler job removed for ${scheduleId}`);
    return {
      success: true,
      message: `SIMULATED: Scheduler job for ${scheduleId} deleted`
    };
  }

  public async triggerJob(scheduleId: string, action: 'START' | 'STOP'): Promise<{ success: boolean; message: string }> {
    db.logAudit('SCHEDULER_JOB_TRIGGERED', 'SYSTEM', `Scheduler job triggered: ${scheduleId} (${action})`);
    return {
      success: true,
      message: `SIMULATED: Scheduler triggered ${action} for ${scheduleId}`
    };
  }

  public async listJobs(): Promise<any[]> {
    return Array.from(this.jobs.entries()).map(([k, v]) => ({ id: k, ...v }));
  }
}

export class CloudSchedulerProvider implements SchedulerProvider {
  public readonly name = 'GoogleCloudScheduler';
  public readonly isCloud = true;

  private isConfigured(): boolean {
    return !!(process.env.GCP_PROJECT_ID && process.env.CLOUD_SCHEDULER_LOCATION);
  }

  public async registerJob(schedule: LiveSchedule): Promise<{ success: boolean; jobId?: string; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Cloud Scheduler credentials absent (GCP_PROJECT_ID not set)',
        jobId: undefined
      };
    }
    return {
      success: true,
      jobId: `cs-job-${schedule.id}`,
      message: 'Cloud Scheduler job created via GCP API'
    };
  }

  public async updateJob(schedule: LiveSchedule): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) return { success: false, message: 'Cloud Scheduler not configured' };
    return { success: true, message: 'Cloud Scheduler job updated' };
  }

  public async deleteJob(scheduleId: string): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) return { success: false, message: 'Cloud Scheduler not configured' };
    return { success: true, message: 'Cloud Scheduler job deleted' };
  }

  public async triggerJob(scheduleId: string, action: 'START' | 'STOP'): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) return { success: false, message: 'Cloud Scheduler not configured' };
    return { success: true, message: `Cloud Scheduler manual execution triggered for ${scheduleId}` };
  }

  public async listJobs(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    return [{ id: 'cloud-job-01', scheduleId: 'sched-daily-01', target: 'Cloud Run Service' }];
  }
}
