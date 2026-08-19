import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// Polyfill: jsdom's File doesn't implement arrayBuffer() but Blob does.
// Real browsers and Node 20+ have it; jsdom inherits from Blob via prototype chain.
if (typeof File !== "undefined" && !File.prototype.arrayBuffer && Blob.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = Blob.prototype.arrayBuffer;
}

// Polyfill: jsdom doesn't implement URL.createObjectURL / revokeObjectURL.
if (
  typeof URL.createObjectURL !== "function" ||
  URL.createObjectURL.toString().includes("not implemented")
) {
  URL.createObjectURL = () => "blob:polyfill";
  URL.revokeObjectURL = () => {};
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

window.scrollTo = () => {};

// Polyfill: jsdom doesn't implement Element.scrollIntoView; Radix Select calls
// it when auto-focusing a selected option and would crash without it.
Element.prototype.scrollIntoView = () => {};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  localStorage.clear();
});
