import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Test component that uses useTheme
function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme-display">{theme}</div>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize with dark theme by default", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId("theme-display");
    expect(themeDisplay.textContent).toBe("dark");
  });

  it("should add dark class to document element on initialization", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("should toggle theme from dark to light", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");
    const themeDisplay = screen.getByTestId("theme-display");

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(themeDisplay.textContent).toBe("light");
    });
  });

  it("should toggle theme from light back to dark", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");
    const themeDisplay = screen.getByTestId("theme-display");

    // First toggle: dark -> light
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(themeDisplay.textContent).toBe("light");
    });

    // Second toggle: light -> dark
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(themeDisplay.textContent).toBe("dark");
    });
  });

  it("should update DOM classes when theme changes to light", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("should update DOM classes when theme changes back to dark", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");

    // Toggle to light
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });

    // Toggle back to dark
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("light")).toBe(false);
    });
  });

  it("should save light theme to localStorage", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("light");
    });
  });

  it("should save dark theme to localStorage", async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId("toggle-button");

    // Toggle to light
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("light");
    });

    // Toggle back to dark
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("dark");
    });
  });

  it("should restore theme from localStorage on mount", () => {
    localStorage.setItem("theme", "light");

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId("theme-display");
    expect(themeDisplay.textContent).toBe("light");
  });

  it("should throw error when useTheme is used outside ThemeProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useTheme must be used within ThemeProvider");

    consoleSpy.mockRestore();
  });
});
