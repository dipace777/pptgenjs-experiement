import { useAtomValue, useSetAtom } from "jotai";
import { resolveDeckTheme, type DeckTheme } from "../../../lib/deck-theme";
import { styles } from "../editorStyles";
import { withHash, withoutHash } from "../editorUtils";
import { deckAtom, updateDeckThemeColorAtom } from "../state";
import { drawerStyles } from "./drawerStyles";

type DeckThemeDrawerProps = {
  onClose: () => void;
};

const THEME_FIELDS = [
  ["background", "Background"],
  ["surface", "Surface"],
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["accent", "Accent"],
  ["text", "Text"],
  ["muted", "Muted"],
] as const satisfies ReadonlyArray<readonly [keyof DeckTheme, string]>;

export function DeckThemeDrawer({ onClose }: DeckThemeDrawerProps) {
  const deck = useAtomValue(deckAtom);
  const deckTheme = resolveDeckTheme(deck);
  const updateDeckThemeColor = useSetAtom(updateDeckThemeColorAtom);

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={drawerStyles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside style={drawerStyles.themeDrawer}>
        <div style={drawerStyles.header}>
          <div>
            <div style={styles.eyebrow}>DECK SETTINGS</div>
            <h2 style={drawerStyles.title}>Theme</h2>
          </div>
          <button
            type="button"
            title="Close theme"
            onClick={onClose}
            style={drawerStyles.iconButton}
          >
            ×
          </button>
        </div>

        <div style={drawerStyles.hint}>
          Updates semantic theme roles across the entire deck. Older untagged
          colors are matched by hex as a fallback.
        </div>

        <div style={drawerStyles.themePanel}>
          <div style={drawerStyles.themeGrid}>
            {THEME_FIELDS.map(([key, label]) => (
              <label key={key} style={styles.field}>
                <span>{label}</span>
                <input
                  type="color"
                  value={withHash(deckTheme[key])}
                  onChange={(event) =>
                    updateDeckThemeColor({
                      key,
                      value: withoutHash(event.target.value),
                    })
                  }
                  style={styles.colorInput}
                />
              </label>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
