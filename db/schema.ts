import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) =>
  text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    contentJson: text('content_json').notNull(),
    completeness: integer('completeness').notNull().default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [uniqueIndex('idx_profiles_user_id').on(table.userId)],
);

export const storedFiles = sqliteTable(
  'stored_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filename: text('filename').notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    kind: text('kind', { enum: ['source', 'docx', 'pdf'] }).notNull(),
    ownerId: text('owner_id'),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    index('idx_stored_files_user_owner').on(table.userId, table.ownerId),
    uniqueIndex('idx_stored_files_object_key').on(table.objectKey),
  ],
);

export const resumes = sqliteTable(
  'resumes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    language: text('language', { enum: ['zh', 'en'] }).notNull().default('zh'),
    sourceFileId: text('source_file_id').references(() => storedFiles.id, {
      onDelete: 'set null',
    }),
    isBase: integer('is_base', { mode: 'boolean' }).notNull().default(true),
    currentVersionId: text('current_version_id'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_resumes_user_updated').on(table.userId, table.updatedAt),
  ],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    company: text('company').notNull(),
    role: text('role').notNull(),
    location: text('location'),
    jd: text('jd').notNull(),
    sourceUrl: text('source_url'),
    deadline: text('deadline'),
    language: text('language', { enum: ['zh', 'en'] }).notNull().default('zh'),
    status: text('status', {
      enum: ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'closed'],
    })
      .notNull()
      .default('wishlist'),
    analysisJson: text('analysis_json'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_jobs_user_status').on(table.userId, table.status),
    index('idx_jobs_user_updated').on(table.userId, table.updatedAt),
  ],
);

export const resumeVersions = sqliteTable(
  'resume_versions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    resumeId: text('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    parentVersionId: text('parent_version_id'),
    versionNumber: integer('version_number').notNull(),
    contentJson: text('content_json').notNull(),
    sourceText: text('source_text').notNull(),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    uniqueIndex('idx_resume_versions_resume_number').on(
      table.resumeId,
      table.versionNumber,
    ),
    index('idx_resume_versions_user_job').on(table.userId, table.jobId),
  ],
);

export const tuneRuns = sqliteTable(
  'tune_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    resumeVersionId: text('resume_version_id')
      .notNull()
      .references(() => resumeVersions.id, { onDelete: 'cascade' }),
    analysisJson: text('analysis_json').notNull(),
    status: text('status', {
      enum: ['processing', 'ready', 'failed', 'finalized'],
    })
      .notNull()
      .default('processing'),
    createdAt: timestamp('created_at'),
  },
  (table) => [
    index('idx_tune_runs_user_job').on(table.userId, table.jobId),
  ],
);

export const tuneSuggestions = sqliteTable(
  'tune_suggestions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    runId: text('run_id')
      .notNull()
      .references(() => tuneRuns.id, { onDelete: 'cascade' }),
    sectionKey: text('section_key').notNull(),
    originalText: text('original_text').notNull(),
    proposedText: text('proposed_text').notNull(),
    editedText: text('edited_text'),
    rationale: text('rationale').notNull(),
    matchedRequirement: text('matched_requirement').notNull(),
    needsUserInput: integer('needs_user_input', { mode: 'boolean' })
      .notNull()
      .default(false),
    state: text('state', { enum: ['pending', 'accepted', 'rejected'] })
      .notNull()
      .default('pending'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_tune_suggestions_user_run').on(table.userId, table.runId),
  ],
);

export const applicationPacks = sqliteTable(
  'application_packs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    resumeVersionId: text('resume_version_id').references(
      () => resumeVersions.id,
      { onDelete: 'set null' },
    ),
    contentJson: text('content_json').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_application_packs_user_job').on(table.userId, table.jobId),
  ],
);

export const customAnswers = sqliteTable(
  'custom_answers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    packId: text('pack_id')
      .notNull()
      .references(() => applicationPacks.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    charLimit: integer('char_limit'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => [
    index('idx_custom_answers_user_pack').on(table.userId, table.packId),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type ResumeRow = typeof resumes.$inferSelect;
export type ResumeVersionRow = typeof resumeVersions.$inferSelect;
