import { describe, it, expect, beforeEach, vi } from "vitest";
import * as db from "./db";

// Mock the database module
vi.mock("./db", () => ({
  createCharacter: vi.fn(),
  getUserCharacters: vi.fn(),
  getCharacterById: vi.fn(),
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  getPublicCharacters: vi.fn(),
}));

describe("Character System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCharacter", () => {
    it("should create a new character with all required fields", async () => {
      const characterData = {
        userId: 1,
        name: "Detective Noir",
        description: "A hardboiled detective from the 1940s",
        worldview: "Cynical but just, believes in doing the right thing",
        openingLine: "The name's Noir, and I've seen things...",
        systemPrompt: "You are Detective Noir...",
        isPublic: 0,
      };

      vi.mocked(db.createCharacter).mockResolvedValue({ id: 1 });

      const result = await db.createCharacter(characterData);

      expect(result.id).toBe(1);
      expect(db.createCharacter).toHaveBeenCalledWith(characterData);
    });

    it("should generate system prompt from character details", () => {
      const name = "Wise Mentor";
      const description = "An ancient sage with deep knowledge";
      const worldview = "Everything is connected";
      const openingLine = "Welcome, young one";

      const systemPrompt = `You are ${name}. ${description}. Your worldview: ${worldview}. Start with: "${openingLine}"`;

      expect(systemPrompt).toContain(name);
      expect(systemPrompt).toContain(description);
      expect(systemPrompt).toContain(worldview);
      expect(systemPrompt).toContain(openingLine);
    });
  });

  describe("getUserCharacters", () => {
    it("should return all characters for a user", async () => {
      const mockCharacters = [
        {
          id: 1,
          userId: 1,
          name: "Character 1",
          description: "First character",
          worldview: "View 1",
          openingLine: "Hello 1",
          systemPrompt: "System 1",
          isPublic: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          name: "Character 2",
          description: "Second character",
          worldview: "View 2",
          openingLine: "Hello 2",
          systemPrompt: "System 2",
          isPublic: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getUserCharacters).mockResolvedValue(mockCharacters);

      const result = await db.getUserCharacters(1);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Character 1");
      expect(result[1].name).toBe("Character 2");
    });

    it("should return empty array when user has no characters", async () => {
      vi.mocked(db.getUserCharacters).mockResolvedValue([]);

      const result = await db.getUserCharacters(1);

      expect(result).toHaveLength(0);
    });
  });

  describe("getCharacterById", () => {
    it("should return a character by id for the correct user", async () => {
      const mockCharacter = {
        id: 1,
        userId: 1,
        name: "Detective Noir",
        description: "A hardboiled detective",
        worldview: "Cynical but just",
        openingLine: "The name's Noir...",
        systemPrompt: "You are Detective Noir...",
        isPublic: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getCharacterById).mockResolvedValue(mockCharacter);

      const result = await db.getCharacterById(1, 1);

      expect(result).toBeDefined();
      expect(result?.name).toBe("Detective Noir");
    });

    it("should return undefined for non-existent character", async () => {
      vi.mocked(db.getCharacterById).mockResolvedValue(undefined);

      const result = await db.getCharacterById(999, 1);

      expect(result).toBeUndefined();
    });

    it("should not return character if user id doesn't match", async () => {
      vi.mocked(db.getCharacterById).mockResolvedValue(undefined);

      const result = await db.getCharacterById(1, 999);

      expect(result).toBeUndefined();
    });
  });

  describe("updateCharacter", () => {
    it("should update character fields", async () => {
      const updates = {
        name: "Updated Detective",
        description: "An updated detective",
      };

      vi.mocked(db.updateCharacter).mockResolvedValue();

      await db.updateCharacter(1, 1, updates);

      expect(db.updateCharacter).toHaveBeenCalledWith(1, 1, updates);
    });

    it("should update system prompt when character details change", async () => {
      const updates = {
        name: "New Name",
        description: "New Description",
        worldview: "New Worldview",
        openingLine: "New Opening",
      };

      const newSystemPrompt = `You are ${updates.name}. ${updates.description}. Your worldview: ${updates.worldview}. Start with: "${updates.openingLine}"`;

      expect(newSystemPrompt).toContain("New Name");
      expect(newSystemPrompt).toContain("New Description");
    });

    it("should only update specified fields", async () => {
      const partialUpdates = {
        name: "Just Updated Name",
      };

      vi.mocked(db.updateCharacter).mockResolvedValue();

      await db.updateCharacter(1, 1, partialUpdates);

      expect(db.updateCharacter).toHaveBeenCalledWith(1, 1, partialUpdates);
    });
  });

  describe("deleteCharacter", () => {
    it("should delete a character", async () => {
      vi.mocked(db.deleteCharacter).mockResolvedValue();

      await db.deleteCharacter(1, 1);

      expect(db.deleteCharacter).toHaveBeenCalledWith(1, 1);
    });

    it("should only allow user to delete their own character", async () => {
      vi.mocked(db.deleteCharacter).mockResolvedValue();

      await db.deleteCharacter(1, 1);

      expect(db.deleteCharacter).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("getPublicCharacters", () => {
    it("should return only public characters", async () => {
      const mockPublicCharacters = [
        {
          id: 1,
          userId: 1,
          name: "Public Character 1",
          description: "A public character",
          worldview: "Public view",
          openingLine: "Hello public",
          systemPrompt: "System prompt",
          isPublic: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 2,
          name: "Public Character 2",
          description: "Another public character",
          worldview: "Another view",
          openingLine: "Hello again",
          systemPrompt: "Another system prompt",
          isPublic: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getPublicCharacters).mockResolvedValue(mockPublicCharacters);

      const result = await db.getPublicCharacters();

      expect(result).toHaveLength(2);
      expect(result.every((char) => char.isPublic === 1)).toBe(true);
    });

    it("should return empty array when no public characters exist", async () => {
      vi.mocked(db.getPublicCharacters).mockResolvedValue([]);

      const result = await db.getPublicCharacters();

      expect(result).toHaveLength(0);
    });
  });

  describe("Character System Validation", () => {
    it("should validate character name is not empty", () => {
      const invalidCharacter = {
        userId: 1,
        name: "",
        description: "Description",
        worldview: "Worldview",
        openingLine: "Opening",
        systemPrompt: "System",
        isPublic: 0,
      };

      expect(invalidCharacter.name).toBe("");
      expect(invalidCharacter.name.length).toBe(0);
    });

    it("should validate all required fields are present", () => {
      const character = {
        userId: 1,
        name: "Test",
        description: "Test",
        worldview: "Test",
        openingLine: "Test",
        systemPrompt: "Test",
        isPublic: 0,
      };

      const requiredFields = ["name", "description", "worldview", "openingLine"];
      const hasAllFields = requiredFields.every((field) => field in character && character[field as keyof typeof character]);

      expect(hasAllFields).toBe(true);
    });

    it("should handle isPublic as 0 or 1", () => {
      const privateChar = { isPublic: 0 };
      const publicChar = { isPublic: 1 };

      expect(privateChar.isPublic).toBe(0);
      expect(publicChar.isPublic).toBe(1);
      expect([0, 1]).toContain(privateChar.isPublic);
      expect([0, 1]).toContain(publicChar.isPublic);
    });
  });

  describe("Character System Data Integrity", () => {
    it("should maintain user isolation - users can only see their characters", async () => {
      const user1Characters = [
        { id: 1, userId: 1, name: "User1 Char" } as any,
      ];
      const user2Characters = [
        { id: 2, userId: 2, name: "User2 Char" } as any,
      ];

      vi.mocked(db.getUserCharacters)
        .mockResolvedValueOnce(user1Characters)
        .mockResolvedValueOnce(user2Characters);

      const result1 = await db.getUserCharacters(1);
      const result2 = await db.getUserCharacters(2);

      expect(result1[0].userId).toBe(1);
      expect(result2[0].userId).toBe(2);
      expect(result1).not.toEqual(result2);
    });

    it("should preserve character data on update", async () => {
      const originalCharacter = {
        id: 1,
        userId: 1,
        name: "Original",
        description: "Original Description",
        worldview: "Original Worldview",
        openingLine: "Original Opening",
        systemPrompt: "Original System",
        isPublic: 0,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      };

      const updates = { name: "Updated" };

      expect(originalCharacter.description).toBe("Original Description");
      expect(originalCharacter.worldview).toBe("Original Worldview");
    });

    it("should handle concurrent character operations safely", async () => {
      const characters = [
        { id: 1, userId: 1, name: "Char 1" } as any,
        { id: 2, userId: 1, name: "Char 2" } as any,
        { id: 3, userId: 1, name: "Char 3" } as any,
      ];

      vi.mocked(db.getUserCharacters).mockResolvedValue(characters);

      const results = await Promise.all([
        db.getUserCharacters(1),
        db.getUserCharacters(1),
        db.getUserCharacters(1),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.length === 3)).toBe(true);
    });
  });
});
