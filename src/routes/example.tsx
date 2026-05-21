/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { SlideEditor } from "../components/slide-editor";
import { messiDeck } from "../slide/spec";

export const Route = createFileRoute("/example")({
  component: ExamplePage,
});

function ExamplePage() {
  return <SlideEditor initialDeck={messiDeck} />;
}
