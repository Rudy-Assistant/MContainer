"use client";

import { useStore } from "@/store/useStore";
import { ContainerSize } from "@/types/container";

interface PresetCard {
  id: string;
  label: string;
  description: string;
  icon: string; // Simple SVG rectangles
  action: () => void;
}

export default function StartScreen() {
  const containers = useStore((s) => s.containers);
  const hasHydrated = useStore((s) => s._hasHydrated);

  const isEmpty = Object.keys(containers).length === 0;
  if (!hasHydrated || !isEmpty) return null;

  const cards: PresetCard[] = [
    {
      id: "studio",
      label: "Studio",
      description: "Single container — open floor plan",
      icon: "M4 8h16v8H4z",
      action: () => {
        const store = useStore.getState();
        const id = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
        store.setAllExtensions(id, 'all_deck', false);
      },
    },
    {
      id: "two_bedroom",
      label: "Two Bedroom",
      description: "Side-by-side living + sleeping",
      icon: "M2 8h9v8H2z M13 8h9v8H13z",
      action: () => {
        const store = useStore.getState();
        store.placeModelHome("entertainer");
        store.setTimeOfDay(15);
        store.setGroundPreset("grass");
      },
    },
    {
      id: "great_room",
      label: "Great Room",
      description: "Three containers — open entertaining space",
      icon: "M1 8h6v8H1z M8 8h8v8H8z M17 8h6v8H17z",
      action: () => {
        const store = useStore.getState();
        const id1 = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
        store.setAllExtensions(id1, 'all_deck', false);
        const id2 = store.addContainer(ContainerSize.HighCube40, { x: 12.19, y: 0, z: 0 });
        store.setAllExtensions(id2, 'all_deck', false);
        const id3 = store.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 2.44 });
        store.setAllExtensions(id3, 'all_deck', false);
      },
    },
    {
      id: "two_story",
      label: "Two-Story",
      description: "Stacked containers with staircase",
      icon: "M4 12h16v8H4z M4 3h16v8H4z",
      action: () => {
        const store = useStore.getState();
        store.placeModelHome("two_story");
        store.setGroundPreset("grass");
      },
    },
    {
      id: "fresh",
      label: "Start Fresh",
      description: "Empty canvas — build from scratch",
      icon: "M10 6l4 4-4 4M14 6l-4 4 4 4",
      action: () => {
        // Do nothing — just dismiss the overlay
      },
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(248, 250, 252, 0.95)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: "#111827",
            margin: 0,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          ModuHome
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#6b7280",
            margin: "8px 0 0",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Choose a starting layout
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 720,
        }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => card.action()}
            style={{
              width: 128,
              padding: "16px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              transition: "all 150ms ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.15)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <svg
              width={48}
              height={36}
              viewBox="0 0 24 20"
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={card.icon} />
            </svg>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#1e293b",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {card.label}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#9ca3af",
                lineHeight: 1.3,
                textAlign: "center",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {card.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
