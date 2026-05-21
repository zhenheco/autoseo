"use client";

import posthog, { type PostHog } from "posthog-js";

export interface PostHogBrowserClient {
  capture: PostHog["capture"];
  identify?: PostHog["identify"];
}

let initialized = false;

function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === "undefined") return false;

  return (
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    navigator.globalPrivacyControl === true
  );
}

function getPostHogApiKey(): string | null {
  return process.env.NEXT_PUBLIC_POSTHOG_API_KEY || null;
}

export function isPostHogEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(getPostHogApiKey()) &&
    !isDoNotTrackEnabled()
  );
}

function initializePostHog(): PostHog | null {
  if (!isPostHogEnabled()) return null;

  if (!initialized) {
    posthog.init(getPostHogApiKey() as string, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      loaded: () => {
        initialized = true;
      },
    });
    initialized = true;
  }

  return posthog;
}

export function getPostHogClient(): PostHogBrowserClient | null {
  return initializePostHog();
}

export function getPostHogProviderClient(): PostHog | null {
  return initializePostHog();
}
