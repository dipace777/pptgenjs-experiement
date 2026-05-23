import type { CSSProperties } from "react";
import { EXPORT_H, EXPORT_W } from "../editorUtils";

export const workspaceStyles = {
  workArea: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
  stagePanel: {
    minWidth: 0,
    minHeight: 0,
    padding: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  slideFrame: {
    position: "relative",
    flexShrink: 0,
  },
  slideEditButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
    height: 34,
    padding: "0 14px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(16,20,30,0.88)",
    color: "#f4f6fa",
    boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  hiddenInput: {
    display: "none",
  },
  hiddenStages: {
    position: "fixed",
    left: -10000,
    top: 0,
    width: EXPORT_W,
    height: EXPORT_H,
    overflow: "hidden",
    pointerEvents: "none",
  },
} satisfies Record<string, CSSProperties>;
