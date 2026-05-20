import { createFileRoute } from "@tanstack/react-router";
import { SlideEditor } from "../components/SlideEditor";

export const Route = createFileRoute("/")({
  component: SlideEditor,
});
