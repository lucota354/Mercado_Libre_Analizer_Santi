// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "../src/app/page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("vehicle year field", () => {
  it("does not crash while the year is being replaced digit by digit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ connected: true })
      }))
    );

    const user = userEvent.setup();
    render(<HomePage />);

    const yearInput = screen.getByLabelText("Año") as HTMLInputElement;

    await user.clear(yearInput);

    expect(yearInput.value).toBe("");
    expect(
      screen.getByText("Ingresá un año de 4 dígitos entre 1900 y 2100.")
    ).toBeTruthy();
    expect(
      screen.getByText("Completá un año válido para calcular la mano de obra.")
    ).toBeTruthy();

    await user.type(yearInput, "2");
    expect(yearInput.value).toBe("2");
    expect(
      screen.getByText("Ingresá un año de 4 dígitos entre 1900 y 2100.")
    ).toBeTruthy();

    await user.type(yearInput, "013");

    expect(yearInput.value).toBe("2013");
    expect(
      screen.queryByText("Ingresá un año de 4 dígitos entre 1900 y 2100.")
    ).toBeNull();
    expect(screen.getByText("Tarifa automática para 2013")).toBeTruthy();
  });
});
