import { beforeEach, describe, expect, it, vi } from "vitest";

const contactsApi = vi.hoisted(() => ({
  getContactInfo: vi.fn(),
}));

vi.mock("./client", () => ({
  getContactsApi: () => contactsApi,
}));

import { getContact } from "./contacts";

describe("Brevo contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Brevo reports a missing contact", async () => {
    contactsApi.getContactInfo.mockRejectedValueOnce({ statusCode: 404 });

    await expect(getContact("missing@example.com")).resolves.toBeNull();
    expect(contactsApi.getContactInfo).toHaveBeenCalledWith({
      identifier: "missing@example.com",
    });
  });
});
