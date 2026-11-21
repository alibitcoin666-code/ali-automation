import { describe, expect, it } from "vitest";
import { extractText, firstJson } from "../src/lib/workersai";

describe("Workers AI reply parsing", () => {
  it("handles chat-completions, legacy and responses shapes", () => {
    expect(extractText({ result: { choices: [{ message: { content: "a" } }] } })).toBe("a");
    expect(extractText({ result: { response: "b" } })).toBe("b");
    expect(extractText({ result: { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "c" }] }] } })).toBe("c");
  });
  it("extracts the first balanced JSON object", () => {
    expect(firstJson('Here:\n```json\n{"a":{"b":"}"},"c":[1]}\n``` done')).toBe('{"a":{"b":"}"},"c":[1]}');
  });
});
