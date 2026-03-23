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
  lights: z.array(z.object({
    voxelIndex: z.number(),
    type: z.enum(['ceiling', 'lamp']),
  })).optional().default([]),
}).passthrough();

export const sceneObjectSchema = z.object({
  id: z.string(),
  formId: z.string(),
  skin: z.record(z.string(), z.string()),
  anchor: z.object({
    containerId: z.string(),
    voxelIndex: z.number(),
    type: z.enum(['face', 'floor', 'ceiling']),
    face: z.enum(['n', 's', 'e', 'w']).optional(),
    slot: z.number().optional(),
    offset: z.tuple([z.number(), z.number()]).optional(),
  }),
  state: z.record(z.string(), z.any()).optional(),
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
  qualityPreset: z.string().optional(),
  pricing: z.any().optional(),
  libraryBlocks: z.array(z.any()).optional().default([]),
  libraryContainers: z.array(z.any()).optional().default([]),
  customHotbar: z.array(z.any()).optional(),
  sceneObjects: z.record(z.string(), sceneObjectSchema).optional().default({}),
  schemaVersion: z.number().optional().default(1),
}).passthrough();
