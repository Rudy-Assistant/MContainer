/**
 * containerRoles.ts — Container Role Catalog
 *
 * A ContainerRole defines the purpose of an ENTIRE container:
 * every body voxel gets the same module, extensions are configured coherently,
 * and exterior walls are set based on the room's architectural intent.
 */

import type { ContainerRole } from '@/types/container';

export const CONTAINER_ROLES: ContainerRole[] = [
  {
    id: 'bedroom',
    label: 'Bedroom',
    icon: '🛏️',
    description: 'Private sleeping quarters with wood floors and steel exterior',
    bodyModuleId: 'bedroom',
    bodyOrientation: 'n',
    extensionConfig: 'none',
    wallOverrides: { n: 'Open', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'bathroom',
    label: 'Bathroom',
    icon: '🚿',
    description: 'Full bathroom with concrete floors and privacy walls',
    bodyModuleId: 'bathroom_full',
    bodyOrientation: 'n',
    extensionConfig: 'none',
    wallOverrides: { n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    icon: '🍳',
    description: 'Cooking and prep space with window wall',
    bodyModuleId: 'kitchen_full',
    bodyOrientation: 'n',
    extensionConfig: 'none',
    wallOverrides: { n: 'Glass_Pane', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'living_room',
    label: 'Living Room',
    icon: '🛋️',
    description: 'Open living area with deck extension and glass walls',
    bodyModuleId: 'living_room',
    bodyOrientation: 'n',
    extensionConfig: 'south_deck',
    wallOverrides: { n: 'Glass_Pane', s: 'Glass_Pane', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'hallway',
    label: 'Hallway',
    icon: '🚶',
    description: 'Passage between containers — open long walls',
    bodyModuleId: 'living_room',
    bodyOrientation: 'n',
    extensionConfig: 'none',
    wallOverrides: { n: 'Open', s: 'Open', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'deck_patio',
    label: 'Deck/Patio',
    icon: '🌿',
    description: 'Open-air deck with railings — no walls, outdoor flooring',
    bodyModuleId: 'deck_open',
    bodyOrientation: 'n',
    extensionConfig: 'all_deck',
  },
  {
    id: 'utility',
    label: 'Utility',
    icon: '🔧',
    description: 'Storage and mechanical space with steel walls',
    bodyModuleId: 'storage',
    bodyOrientation: 'n',
    extensionConfig: 'none',
    wallOverrides: { n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'open_plan',
    label: 'Open Plan',
    icon: '🏠',
    description: 'Expanded living with interior extensions and glass exterior',
    bodyModuleId: 'living_room',
    bodyOrientation: 'n',
    extensionConfig: 'all_interior',
    wallOverrides: { n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' },
  },
  {
    id: 'wraparound',
    label: 'Wraparound Deck',
    icon: '🌅',
    description: 'Glass-enclosed body with wraparound deck on all sides',
    bodyModuleId: 'living_room',
    bodyOrientation: 'n',
    extensionConfig: 'all_deck',
    wallOverrides: { n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' },
  },
];

export function getContainerRole(id: string): ContainerRole | undefined {
  return CONTAINER_ROLES.find((r) => r.id === id);
}
