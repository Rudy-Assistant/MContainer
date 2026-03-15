import { z } from 'zod';

// Minimal Zod schema — validates enough to catch corrupt data without
// trying to mirror every field. Uses .passthrough() to allow extra fields.

const containerSchema = z.object({
  id: z.string(),
  size: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  walls: z.record(z.string(), z.any()),
}).passthrough();

export const persistedStateSchema = z.object({
  containers: z.record(z.string(), containerSchema),
  zones: z.record(z.string(), z.any()).optional().default({}),
  environment: z.object({
    timeOfDay: z.number(),
    northOffset: z.number(),
    groundPreset: z.string().optional(),
  }).passthrough().optional(),
  viewMode: z.string().optional(),
  pricing: z.any().optional(),
  libraryBlocks: z.array(z.any()).optional().default([]),
  libraryContainers: z.array(z.any()).optional().default([]),
  customHotbar: z.array(z.any()).optional(),
}).passthrough();
