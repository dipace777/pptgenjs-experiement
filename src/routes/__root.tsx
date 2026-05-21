/* eslint-disable react-refresh/only-export-components */
// src/routes/__root.tsx
/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "ppty — AI Presentation Editor",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html style={{ height: "100%" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ margin: 0, minHeight: "100%", width: "100%" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
