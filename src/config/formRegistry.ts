// src/config/formRegistry.ts
// Aggregates all form definitions into a single registry.

import type { FormDefinition, FormCategory, StyleId } from '@/types/sceneObject';
import { DOOR_FORMS } from './forms/doors';
import { WINDOW_FORMS } from './forms/windows';
import { LIGHT_FORMS } from './forms/lights';
import { ELECTRICAL_FORMS } from './forms/electrical';

const ALL_FORMS: FormDefinition[] = [
  ...DOOR_FORMS,
  ...WINDOW_FORMS,
  ...LIGHT_FORMS,
  ...ELECTRICAL_FORMS,
];

export const formRegistry: Map<string, FormDefinition> = new Map(
  ALL_FORMS.map((f) => [f.id, f])
);

export function getByCategory(cat: FormCategory): FormDefinition[] {
  return ALL_FORMS.filter((f) => f.category === cat);
}

export function getByStyle(style: StyleId): FormDefinition[] {
  return ALL_FORMS.filter((f) => f.styles.includes(style));
}

export function getByCategoryAndStyle(cat: FormCategory, style: StyleId): FormDefinition[] {
  return ALL_FORMS.filter((f) => f.category === cat && f.styles.includes(style));
}
