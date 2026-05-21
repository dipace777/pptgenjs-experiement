import { createFileRoute } from "@tanstack/react-router";
import { SlideEditor } from "../components/slide-editor";

export const Route = createFileRoute("/")({
  component: SlideEditor,
});
