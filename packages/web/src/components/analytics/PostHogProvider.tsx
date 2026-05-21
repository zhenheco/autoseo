"use client";

import { type ReactNode, useState } from "react";
import {
  PostHogProvider as BrowserPostHogProvider,
  type PostHog,
} from "posthog-js/react";

import { getPostHogProviderClient } from "@/lib/analytics/posthog-client";

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const [client] = useState<PostHog | null>(() => getPostHogProviderClient());

  if (!client) {
    return <>{children}</>;
  }

  return (
    <BrowserPostHogProvider client={client}>{children}</BrowserPostHogProvider>
  );
}
