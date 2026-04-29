/**
 * /api/design — Server-side route that converts a natural-language design
 * brief into a structured DesignPlan via Claude Sonnet 4.6.
 *
 * Why server-side: ANTHROPIC_API_KEY must never reach the browser. The route
 * also lets us pin the model + system prompt + tool schema in one place and
 * benefit from prompt caching on the (large, stable) system prompt.
 *
 * Caching strategy: the system prompt enumerates every preset/roof/size
 * Claude is allowed to use. That's ~2KB and identical request-to-request, so
 * we mark it `cache_control: ephemeral`. Per-request prompt is just the
 * user's free-form text after the cache breakpoint.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { ROOM_PRESETS } from '@/config/roomPresets';
import { ROOF_TYPES } from '@/config/roofTypes';
import { ContainerSize } from '@/types/container';
import type { DesignPlan } from '@/utils/aiDesigner';

export const runtime = 'nodejs';

// Build catalog text once at module load — these arrays are import-time
// constants, no need to recompute per request.
const PRESET_CATALOG = ROOM_PRESETS.map((p) => `  - ${p.id} (${p.cols}×${p.rows} body voxels): ${p.label} — ${p.hint}`).join('\n');
const ROOF_CATALOG = ROOF_TYPES.map((r) => `  - ${r.id}: ${r.label} — ${r.hint}`).join('\n');
const SIZE_CATALOG = [
  `  - "${ContainerSize.Standard20}": 20ft (6.06m × 2.44m)`,
  `  - "${ContainerSize.Standard40}": 40ft (12.19m × 2.44m)`,
  `  - "${ContainerSize.HighCube40}": 40ft High Cube (12.19m × 2.44m × 2.90m tall — most common)`,
].join('\n');

const SYSTEM_PROMPT = `You are an expert architect translating natural-language design briefs into structured DesignPlans for a shipping-container home designer. Always reply by calling the submit_design_plan tool exactly once.

Coordinate system:
  - x: east/west in meters (containers are 12.19m long along x for 40ft sizes)
  - z: north/south in meters (containers are 2.44m wide along z)
  - y: vertical, only used for stacked levels (level 1 sits at y = 2.59 or 2.90 depending on size)
  - Body of each container is a 6-col × 2-row voxel grid for room presets. anchorBodyCol ∈ [0..5], anchorBodyRow ∈ [0..1]. Preset must fit: anchorBodyCol + cols ≤ 6 and anchorBodyRow + rows ≤ 2.

Container sizes (use these exact strings for "size"):
${SIZE_CATALOG}

Roof types (use these exact strings):
${ROOF_CATALOG}

Room presets (use these exact "presetId" strings):
${PRESET_CATALOG}

Design principles:
  - Default to 40ft_high_cube for residential — best ceiling height.
  - Lay containers in a row along x, spaced 0 m apart for adjacency (they auto-merge).
  - Wet rooms (bath, kitchen, laundry) should share a wall to keep plumbing in one stack.
  - Open-plan kitchen/living combos only fit in a single 40ft container — use open_plan_klr.
  - Bedrooms default to level 1 (upstairs) for privacy unless the user wants single-story.
  - Pick a roof that matches the user's style cue: gable for traditional, butterfly/shed for modern, green for sustainable, parapet for industrial/loft, flat is the cheap default.
  - Always enable site context (grass, driveway, trees) unless the user asks for a clinical/blueprint view.
  - Cite a one-paragraph rationale citing the design principle you applied.`;

// Tool schema — mirrors DesignAction in src/utils/aiDesigner.ts.
const SUBMIT_TOOL = {
  name: 'submit_design_plan',
  description: 'Submit the final design plan as an ordered list of actions. The first add_container in your actions array is containerIndex 0; the second add_container is containerIndex 1; and so on. set_site_context and other action types do NOT count toward containerIndex — only add_container actions do. Reference the correct containerIndex in apply_room_preset.',
  input_schema: {
    type: 'object' as const,
    properties: {
      rationale: { type: 'string', description: 'One paragraph explaining the design decisions to the user.' },
      actions: {
        type: 'array',
        items: {
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { const: 'add_container' },
                size: { type: 'string', enum: [ContainerSize.Standard20, ContainerSize.Standard40, ContainerSize.HighCube40] },
                position: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                  required: ['x', 'y', 'z'],
                },
                level: { type: 'number', description: 'Stack level (0 = ground, 1 = upstairs).' },
                roofType: { type: 'string', enum: ROOF_TYPES.map((r) => r.id) },
              },
              required: ['type', 'size', 'position'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'apply_room_preset' },
                containerIndex: {
                  type: 'integer', minimum: 0,
                  description: '0 = first add_container action in this plan, 1 = second add_container action, etc. Only add_container actions count.',
                },
                anchorBodyCol: { type: 'integer', minimum: 0, maximum: 5 },
                anchorBodyRow: { type: 'integer', minimum: 0, maximum: 1 },
                presetId: { type: 'string', enum: ROOM_PRESETS.map((p) => p.id) },
                level: { type: 'integer', enum: [0, 1] },
              },
              required: ['type', 'containerIndex', 'anchorBodyCol', 'anchorBodyRow', 'presetId'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'set_site_context' },
                enabled: { type: 'boolean' },
              },
              required: ['type', 'enabled'],
            },
          ],
        },
      },
    },
    required: ['rationale', 'actions'],
  },
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart `npm run dev`.' },
      { status: 503 },
    );
  }

  let prompt: string;
  try {
    const body = (await req.json()) as { prompt?: unknown };
    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Request body must include a non-empty `prompt` string.' }, { status: 400 });
    }
    if (body.prompt.length > 4000) {
      return NextResponse.json({ error: 'Prompt is too long (max 4000 characters).' }, { status: 400 });
    }
    prompt = body.prompt.trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SUBMIT_TOOL],
      tool_choice: { type: 'tool', name: 'submit_design_plan' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Model did not return a design plan.' }, { status: 502 });
    }
    const plan = toolUse.input as DesignPlan;
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error contacting Claude.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
