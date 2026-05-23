import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { KonvaSlide } from "../slide-surface";
import {
  activeSlideIndexAtom,
  deckAtom,
  setSelectionAtom,
  updateDeckTitleAtom,
} from "../state";
import { layoutStyles } from "./layoutStyles";

export function ThumbnailRail() {
  const deck = useAtomValue(deckAtom);
  const [active, setActive] = useAtom(activeSlideIndexAtom);
  const setSelection = useSetAtom(setSelectionAtom);
  const updateDeckTitle = useSetAtom(updateDeckTitleAtom);

  return (
    <aside style={layoutStyles.sidebar}>
      <div style={layoutStyles.header}>
        <input
          aria-label="Deck title"
          value={deck.title}
          onChange={(event) => updateDeckTitle(event.target.value)}
          style={layoutStyles.titleInput}
        />
        <div style={layoutStyles.meta}>{deck.slides.length} slides</div>
      </div>

      <div style={layoutStyles.thumbs}>
        {deck.slides.map((slide, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setActive(index);
              setSelection(-1);
            }}
            style={{
              ...layoutStyles.thumbRow,
              borderColor: index === active ? "#d4a24c" : "#242c3e",
            }}
          >
            <span style={layoutStyles.thumbNumber}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <KonvaSlide
              slide={slide}
              width={160}
              height={90}
              interactive={false}
            />
          </button>
        ))}
      </div>
    </aside>
  );
}
