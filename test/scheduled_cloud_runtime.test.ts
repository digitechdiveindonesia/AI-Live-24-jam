import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleService } from '../server/services/schedule/ScheduleService';
import { cloudRuntimeController } from '../server/services/schedule/CloudRuntimeController';
import {
  MockSchedulerProvider,
  CloudSchedulerProvider
} from '../server/services/schedule/SchedulerProvider';
import {
  MockRuntimeProvider,
  CloudRunRuntimeProvider
} from '../server/services/schedule/RuntimeProvider';
import { usageTelemetryService } from '../server/services/schedule/UsageTelemetryService';
import { db } from '../server/db';
import { eventService } from '../server/services/EventService';

test('1. Schedule Model & Validation - Timezone, Format & Overlap Protection', () => {
  // Test valid schedule (on weekend to avoid overlap with seed Mon-Fri schedule)
  const validResult = scheduleService.validateSchedule({
    name: 'Weekend Flash Sale',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['SAT', 'SUN'],
    startTime: '09:00',
    endTime: '12:00'
  });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);

  // Test invalid timezone
  const invalidTzResult = scheduleService.validateSchedule({
    name: 'Invalid TZ',
    enabled: true,
    timezone: 'Invalid/City_Nowhere',
    daysOfWeek: ['MON'],
    startTime: '10:00',
    endTime: '12:00'
  });
  assert.equal(invalidTzResult.valid, false);
  assert.ok(invalidTzResult.errors.some(e => e.includes('Invalid IANA timezone')));

  // Test invalid time format
  const invalidTimeResult = scheduleService.validateSchedule({
    name: 'Bad Time',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['MON'],
    startTime: '25:99',
    endTime: '12:00'
  });
  assert.equal(invalidTimeResult.valid, false);
  assert.ok(invalidTimeResult.errors.some(e => e.includes('Start time must be formatted as HH:mm')));

  // Test same start and end time
  const sameTimeResult = scheduleService.validateSchedule({
    name: 'Zero Duration',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['MON'],
    startTime: '10:00',
    endTime: '10:00'
  });
  assert.equal(sameTimeResult.valid, false);
  assert.ok(sameTimeResult.errors.some(e => e.includes('Start time and end time cannot be identical')));

  // Test overlapping schedule detection
  const overlapResult = scheduleService.validateSchedule({
    name: 'Overlapping Evening Live',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['MON'],
    startTime: '10:30', // overlaps with default 10:00 - 20:00
    endTime: '14:00'
  });
  assert.equal(overlapResult.valid, false);
  assert.ok(overlapResult.errors.some(e => e.includes('overlaps with active schedule')));

  // Test cross-midnight schedule validity (e.g. 22:00 - 04:00 on Sunday)
  const crossMidnightResult = scheduleService.validateSchedule({
    name: 'Night Owl Stream',
    enabled: false, // disabled so doesn't trigger overlap
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['SUN'],
    startTime: '22:00',
    endTime: '04:00'
  });
  assert.equal(crossMidnightResult.valid, true);
});

test('2. ScheduleService - CRUD Operations & Window Calculations', () => {
  // Create schedule
  const created = scheduleService.createSchedule({
    name: 'Weekend Prime Time',
    enabled: false,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['SAT', 'SUN'],
    startTime: '18:00',
    endTime: '21:00'
  });
  assert.ok(created.schedule);
  assert.equal(created.schedule.name, 'Weekend Prime Time');
  const schedId = created.schedule.id;

  // Read
  const retrieved = scheduleService.getScheduleById(schedId);
  assert.ok(retrieved);
  assert.equal(retrieved.enabled, false);

  // Enable
  const enabled = scheduleService.enableSchedule(schedId);
  assert.ok(enabled);
  assert.equal(enabled.enabled, true);

  // Update
  const updated = scheduleService.updateSchedule(schedId, { name: 'Weekend Super Live' });
  assert.ok(updated.schedule);
  assert.equal(updated.schedule.name, 'Weekend Super Live');

  // Next Run Calculation
  const nextRun = scheduleService.getNextRun(updated.schedule);
  assert.ok(nextRun.nextStartTime);
  assert.ok(nextRun.nextEndTime);

  // Disable & Delete
  const disabled = scheduleService.disableSchedule(schedId);
  assert.ok(disabled);
  assert.equal(disabled.enabled, false);

  const deleted = scheduleService.deleteSchedule(schedId);
  assert.equal(deleted, true);
  assert.equal(scheduleService.getScheduleById(schedId), undefined);
});

test('3. CloudRuntimeController - Idempotent Start & Distributed Lock Protection', async () => {
  const eventsEmitted: string[] = [];
  const unsubscribeTriggered = eventService.subscribe('SCHEDULE_TRIGGERED', () => eventsEmitted.push('SCHEDULE_TRIGGERED'));
  const unsubscribeStarting = eventService.subscribe('RUNTIME_STARTING', () => eventsEmitted.push('RUNTIME_STARTING'));
  const unsubscribeRunning = eventService.subscribe('RUNTIME_RUNNING', () => eventsEmitted.push('RUNTIME_RUNNING'));

  // Ensure fresh state
  await cloudRuntimeController.stopRuntime({ force: true });

  // 1. First Start
  const start1 = await cloudRuntimeController.startRuntime({ instanceId: 'inst-test-01' });
  assert.equal(start1.success, true);
  assert.equal(start1.status, 'RUNNING');

  // Verify events emitted
  assert.ok(eventsEmitted.includes('SCHEDULE_TRIGGERED'));
  assert.ok(eventsEmitted.includes('RUNTIME_STARTING'));
  assert.ok(eventsEmitted.includes('RUNTIME_RUNNING'));

  // 2. Idempotent Second Start with same or different caller
  const start2 = await cloudRuntimeController.startRuntime({ instanceId: 'inst-test-02' });
  assert.equal(start2.success, true);
  assert.equal(start2.status, 'RUNNING');
  assert.ok(start2.message.includes('ALREADY_RUNNING'));

  // Verify lock is acquired
  const status = cloudRuntimeController.getRuntimeStatus();
  assert.equal(status.isLocked, true);
  assert.equal(status.status, 'RUNNING');

  unsubscribeTriggered();
  unsubscribeStarting();
  unsubscribeRunning();
});

test('4. CloudRuntimeController - Graceful & Idempotent Stop (Scale-to-Zero)', async () => {
  const stopEvents: string[] = [];
  const unsubscribeEnd = eventService.subscribe('SCHEDULE_END', () => stopEvents.push('SCHEDULE_END'));
  const unsubscribeStopping = eventService.subscribe('RUNTIME_STOPPING', () => stopEvents.push('RUNTIME_STOPPING'));
  const unsubscribeStopped = eventService.subscribe('RUNTIME_STOPPED', () => stopEvents.push('RUNTIME_STOPPED'));

  // 1. First Stop
  const stop1 = await cloudRuntimeController.stopRuntime({ reason: 'SCHEDULE_END' });
  assert.equal(stop1.success, true);
  assert.equal(stop1.status, 'OFF');

  assert.ok(stopEvents.includes('SCHEDULE_END'));
  assert.ok(stopEvents.includes('RUNTIME_STOPPING'));
  assert.ok(stopEvents.includes('RUNTIME_STOPPED'));

  // 2. Idempotent Second Stop
  const stop2 = await cloudRuntimeController.stopRuntime({ reason: 'SCHEDULE_END' });
  assert.equal(stop2.success, true);
  assert.equal(stop2.status, 'STOPPED');
  assert.ok(stop2.message.includes('ALREADY_STOPPED'));

  // Verify lock released
  assert.equal(db.isRuntimeLocked(db.session.id), false);

  unsubscribeEnd();
  unsubscribeStopping();
  unsubscribeStopped();
});

test('5. Crash Recovery & Scheduled Restart - Preserves SKU and Script State', async () => {
  // Set explicit state
  db.updateLiveSession({
    current_sku: 'SKU-001',
    current_script_block_id: 'block-02',
    current_host_state: 'PRODUCT_PITCH'
  });

  // Perform Crash Recovery
  const recoveryResult = await cloudRuntimeController.recoverRuntime();
  assert.equal(recoveryResult.success, true);
  assert.equal(recoveryResult.status, 'RUNNING');
  assert.equal(db.session.current_sku, 'SKU-001');
  assert.equal(db.session.current_script_block_id, 'block-02');
  assert.equal(db.session.current_host_state, 'PRODUCT_PITCH');

  // Perform Scheduled Restart
  const restartResult = await cloudRuntimeController.requestRestart('PERIODIC_HEALTH_RESTART');
  assert.equal(restartResult.success, true);
  assert.ok(restartResult.message.includes('SKU-001'));
  assert.equal(db.session.current_sku, 'SKU-001');
  assert.equal(db.session.current_host_state, 'PRODUCT_PITCH');
});

test('6. Scheduler & Runtime Provider Abstractions (Cloud Run & Cloud Scheduler)', async () => {
  // MockSchedulerProvider
  const mockScheduler = new MockSchedulerProvider();
  assert.equal(mockScheduler.isCloud, false);
  const regResult = await mockScheduler.registerJob({
    id: 'test-sched-mock',
    name: 'Mock Test Schedule',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['MON'],
    startTime: '10:00',
    endTime: '20:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  assert.equal(regResult.success, true);
  assert.ok(regResult.jobId);

  const jobs = await mockScheduler.listJobs();
  assert.ok(jobs.some(j => j.scheduleId === 'test-sched-mock'));

  await mockScheduler.deleteJob('test-sched-mock');

  // GoogleCloudScheduler unconfigured detection
  const cloudScheduler = new CloudSchedulerProvider();
  assert.equal(cloudScheduler.isCloud, true);
  const cloudReg = await cloudScheduler.registerJob({
    id: 'test-sched-cloud',
    name: 'Cloud Test',
    enabled: true,
    timezone: 'Asia/Jakarta',
    daysOfWeek: ['MON'],
    startTime: '10:00',
    endTime: '20:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  assert.equal(cloudReg.success, false);
  assert.ok(cloudReg.message.includes('not set') || cloudReg.message.includes('absent'));

  // Runtime Providers
  const mockRuntime = new MockRuntimeProvider();
  assert.equal(mockRuntime.isCloud, false);
  const startRes = await mockRuntime.start();
  assert.equal(startRes.success, true);

  const stopRes = await mockRuntime.stop();
  assert.equal(stopRes.success, true);

  const cloudRun = new CloudRunRuntimeProvider();
  assert.equal(cloudRun.isCloud, true);
  assert.equal(cloudRun.isConfigured(), false);
});

test('7. Usage Telemetry & Free-Tier Cost Guardrails', () => {
  usageTelemetryService.resetUsage();

  usageTelemetryService.recordRuntimeStart();
  usageTelemetryService.recordRuntimeDuration(7200); // 2 hours
  usageTelemetryService.recordApiCall('GEMINI');
  usageTelemetryService.recordApiCall('TTS');
  usageTelemetryService.recordApiCall('PLATFORM');

  const usage = usageTelemetryService.getUsage();
  assert.equal(usage.runtimeStartCount, 1);
  assert.equal(usage.runtimeDurationSec, 7200);
  assert.equal(usage.estimatedComputeHours, 2);
  assert.equal(usage.geminiRequests, 1);
  assert.equal(usage.ttsRequests, 1);
  assert.equal(usage.platformRequests, 1);
  assert.equal(usage.billingStatus, 'USAGE_DATA_AVAILABLE');
});

test('8. Accelerated Day Simulation - 6-Stage Cloud Lifecycle in Milliseconds', async () => {
  const sim = await cloudRuntimeController.simulateAcceleratedDay();
  assert.equal(sim.success, true);
  assert.equal(sim.isSimulated, true);
  assert.equal(sim.stages.length, 6);
  assert.ok(sim.stages[0].includes('SCHEDULER_TRIGGER'));
  assert.ok(sim.stages[1].includes('SELLING_LOOP'));
  assert.ok(sim.stages[2].includes('CUSTOMER_INTERRUPTION'));
  assert.ok(sim.stages[3].includes('SIMULATED_FAULT'));
  assert.ok(sim.stages[4].includes('GRACE_PERIOD'));
  assert.ok(sim.stages[5].includes('SCHEDULE_END'));
});
