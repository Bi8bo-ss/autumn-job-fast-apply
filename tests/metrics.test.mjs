import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { METRIC_QUERIES, summarizeMetrics } from '../lib/server/metrics.ts';

function migratedDatabase() {
  const database = new DatabaseSync(':memory:');
  const migration = readFileSync(new URL('../drizzle/0000_lying_payback.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim()) database.exec(statement);
  }
  return database;
}

function seed(database) {
  const insertJob = database.prepare(`INSERT INTO jobs (id,user_id,company,role,jd,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
  insertJob.run('job1', 'u1', 'A', 'DA', 'jd', 'applied', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z');
  insertJob.run('job2', 'u1', 'B', 'BA', 'jd', 'interview', '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z');
  insertJob.run('job3', 'u1', 'C', 'DA', 'jd', 'wishlist', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z');
  insertJob.run('other', 'u2', 'D', 'DA', 'jd', 'offer', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z');

  database.exec(`INSERT INTO resumes (id,user_id,name) VALUES ('r1','u1','base')`);
  database.exec(`INSERT INTO resume_versions (id,user_id,resume_id,version_number,content_json,source_text) VALUES ('v1','u1','r1',1,'{}','')`);
  database.exec(`INSERT INTO tune_runs (id,user_id,job_id,resume_version_id,analysis_json,status) VALUES
    ('run1','u1','job1','v1','{}','finalized'), ('run2','u1','job2','v1','{}','ready'), ('run3','u1','job2','v1','{}','failed')`);

  const insertSuggestion = database.prepare(`INSERT INTO tune_suggestions (id,user_id,run_id,section_key,original_text,proposed_text,edited_text,rationale,matched_requirement,needs_user_input,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insertSuggestion.run('s1', 'u1', 'run1', 'replace:experience', 'a', 'b', null, 'r', 'm', 0, 'accepted');
  insertSuggestion.run('s2', 'u1', 'run1', 'replace:experience', 'a', 'b', 'b edited', 'r', 'm', 0, 'accepted');
  insertSuggestion.run('s3', 'u1', 'run1', 'replace:experience', 'a', 'b', null, 'r', 'm', 0, 'rejected');
  insertSuggestion.run('s4', 'u1', 'run2', 'append:skills', '', '工具：Tableau', null, 'r', 'm', 1, 'rejected');
  insertSuggestion.run('s5', 'u1', 'run2', 'append:experience', 'a', 'c', null, 'r', 'm', 0, 'pending');

  const insertPack = database.prepare(`INSERT INTO application_packs (id,user_id,job_id,content_json,created_at,updated_at) VALUES (?,?,?,?,?,?)`);
  insertPack.run('p1', 'u1', 'job1', '{}', '2026-09-01T10:30:00.000Z', '2026-09-01T10:30:00.000Z');
  insertPack.run('p2', 'u1', 'job1', '{}', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z');
  insertPack.run('p3', 'u1', 'job2', '{}', '2026-09-02T10:10:00.000Z', '2026-09-02T10:10:00.000Z');
}

function collect(database, userId) {
  return {
    jobsByStatus: database.prepare(METRIC_QUERIES.jobsByStatus).all(userId),
    tuneRuns: database.prepare(METRIC_QUERIES.tuneRuns).get(userId),
    suggestionsBySection: database.prepare(METRIC_QUERIES.suggestionsBySection).all(userId),
    minutesToFirstPack: database.prepare(METRIC_QUERIES.minutesToFirstPack).all(userId),
    customAnswers: database.prepare(METRIC_QUERIES.customAnswers).get(userId),
  };
}

test('metrics queries run against the real migration and stay scoped to one user', () => {
  const database = migratedDatabase();
  seed(database);
  const metrics = summarizeMetrics(collect(database, 'u1'));

  assert.equal(metrics.pipeline.jobs, 3);
  assert.equal(metrics.pipeline.submitted, 2);
  assert.equal(metrics.pipeline.pastScreening, 1);
  assert.equal(metrics.pipeline.pastScreeningRatePct, 50);
  assert.equal(metrics.pipeline.byStatus.offer, 0, 'another user\'s offer must not leak in');

  assert.deepEqual(metrics.tuning, { runs: 3, jobsTuned: 2, finalizedRuns: 1, failedRuns: 1 });

  assert.equal(metrics.suggestions.total, 5);
  assert.equal(metrics.suggestions.accepted, 2);
  assert.equal(metrics.suggestions.rejected, 2);
  assert.equal(metrics.suggestions.pending, 1);
  assert.equal(metrics.suggestions.acceptanceRatePct, 50);
  assert.equal(metrics.suggestions.editBeforeAcceptRatePct, 50);
  assert.equal(metrics.suggestions.needsUserInputSharePct, 20);
  const experience = metrics.suggestions.bySection.find((row) => row.key === 'experience/replace');
  assert.equal(experience.acceptanceRatePct, 66.7);

  assert.equal(metrics.applicationPack.jobsWithPack, 2);
  assert.equal(metrics.applicationPack.medianMinutesFromJobToPack, 20);
});

test('empty workspace returns zeros and null rates instead of invented numbers', () => {
  const database = migratedDatabase();
  const metrics = summarizeMetrics(collect(database, 'nobody'));
  assert.equal(metrics.pipeline.jobs, 0);
  assert.equal(metrics.pipeline.pastScreeningRatePct, null);
  assert.equal(metrics.suggestions.acceptanceRatePct, null);
  assert.equal(metrics.applicationPack.medianMinutesFromJobToPack, null);
});
