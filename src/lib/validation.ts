/**
 * BURNBOARD Input Validation — ZOD Schemas
 *
 * All user inputs MUST pass through these schemas before touching Supabase.
 * Prevents: SQL injection, XSS, invalid data, oversized payloads.
 */

import { z } from 'zod';

// ── Roast Validation ─────────────────────────────────────────
export const roastSchema = z.object({
  roast_text: z
    .string()
    .min(5, 'Roast too short — at least 5 characters')
    .max(280, 'Roast too long — max 280 characters')
    .regex(/^[^<>]*$/, 'No HTML tags allowed')
    .refine(
      (val) => !val.match(/<script/i),
      'Script tags not allowed'
    )
    .refine(
      (val) => !val.match(/javascript:/i),
      'JavaScript protocol not allowed'
    )
    .refine(
      (val) => !val.match(/on\w+\s*=/i),
      'Event handlers not allowed'
    ),
  profile_id: z.string().uuid('Invalid profile ID'),
  anon_id: z
    .string()
    .max(50, 'Anonymous ID too long')
    .optional()
    .default('Anon Roaster'),
  user_id: z.string().uuid().optional().nullable(),
  // Honeypot field — must be empty
  website: z.string().max(0, 'Bot detected').optional().default(''),
});

export type RoastInput = z.infer<typeof roastSchema>;

// ── Profile Validation ───────────────────────────────────────
export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username too short — at least 3 characters')
    .max(30, 'Username too long — max 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username: only letters, numbers, underscores')
    .refine(
      (val) => !val.match(/^(admin|root|system|moderator|support)$/i),
      'Reserved username'
    ),
  platform: z.enum([
    'linkedin', 'github', 'twitter', 'instagram',
    'producthunt', 'youtube', 'X', 'LinkedIn', 'GitHub',
    'Instagram', 'Indie Hacker', 'TikTok', 'Reddit',
  ]),
  bio: z
    .string()
    .max(500, 'Bio too long — max 500 characters')
    .refine(
      (val) => !val.match(/<script/i),
      'Script tags not allowed'
    ),
  url: z.string().url('Invalid URL').optional().nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// ── Story Validation ─────────────────────────────────────────
export const storySchema = z.object({
  text: z
    .string()
    .min(2, 'Story too short — at least 2 characters')
    .max(200, 'Story too long — max 200 characters')
    .refine(
      (val) => !val.match(/<script/i),
      'Script tags not allowed'
    )
    .refine(
      (val) => !val.match(/javascript:/i),
      'JavaScript protocol not allowed'
    ),
});

export type StoryInput = z.infer<typeof storySchema>;

// ── DM Message Validation ────────────────────────────────────
export const dmMessageSchema = z.object({
  text: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long — max 1000 characters')
    .refine(
      (val) => !val.match(/<script/i),
      'Script tags not allowed'
    ),
  thread_id: z.string().uuid('Invalid thread ID'),
});

export type DmMessageInput = z.infer<typeof dmMessageSchema>;

// ── Report Validation ────────────────────────────────────────
export const reportSchema = z.object({
  roast_id: z.string().uuid('Invalid roast ID'),
  reason: z
    .string()
    .min(3, 'Reason too short')
    .max(500, 'Reason too long')
    .optional()
    .default('reported'),
});

export type ReportInput = z.infer<typeof reportSchema>;

// ── Battle Vote Validation ───────────────────────────────────
export const battleVoteSchema = z.object({
  battle_id: z.string().uuid('Invalid battle ID'),
  candidate: z.union([z.literal(1), z.literal(2)]),
});

export type BattleVoteInput = z.infer<typeof battleVoteSchema>;

// ── Follow Validation ────────────────────────────────────────
export const followSchema = z.object({
  following_id: z.string().uuid('Invalid user ID'),
});

export type FollowInput = z.infer<typeof followSchema>;

// ── Email Subscriber Validation ──────────────────────────────
export const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  profile_id: z.string().uuid('Invalid profile ID'),
});

export type EmailInput = z.infer<typeof emailSchema>;

// ── Remix Validation ─────────────────────────────────────────
export const remixSchema = z.object({
  remix_text: z
    .string()
    .min(5, 'Remix too short')
    .max(280, 'Remix too long')
    .regex(/^[^<>]*$/, 'No HTML tags'),
  original_roast_id: z.string().uuid('Invalid roast ID'),
});

export type RemixInput = z.infer<typeof remixSchema>;

// ── User Profile (Auth) Validation ───────────────────────────
export const userProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  display_name: z
    .string()
    .max(50, 'Display name too long')
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(500, 'Bio too long')
    .optional()
    .nullable(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;


// ── Helper: Safe Parse with User-Friendly Errors ─────────────
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError?.message || 'Invalid input',
  };
}
