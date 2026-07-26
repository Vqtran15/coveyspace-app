-- User-level Bible quick passages
-- Stores an ordered array of { id, label, bookId, chapter, startVerse, endVerse }
-- NULL means "user hasn't customized yet" (app shows built-in defaults)
-- [] means user explicitly cleared all passages
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bible_passages JSONB DEFAULT NULL;
