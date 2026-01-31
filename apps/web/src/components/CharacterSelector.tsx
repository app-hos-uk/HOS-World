'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';

interface Character {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  fandom: {
    id: string;
    name: string;
    slug: string;
  };
}

interface CharacterSelectorProps {
  onSelect: (characterId: string, favoriteFandoms: string[]) => void;
  onSkip: () => void;
}

export function CharacterSelector({ onSelect, onSkip }: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedFandoms, setSelectedFandoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fandoms, setFandoms] = useState<any[]>([]);

  useEffect(() => {
    loadCharacters();
    loadFandoms();
  }, []);

  const loadCharacters = async () => {
    try {
      const response = await apiClient.getCharacters();
      setCharacters(response.data || []);
    } catch (error) {
      console.error('Error loading characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFandoms = async () => {
    try {
      const response = await apiClient.getFandoms();
      setFandoms(response.data || []);
    } catch (error) {
      console.error('Error loading fandoms:', error);
    }
  };

  const toggleFandom = (fandomSlug: string) => {
    setSelectedFandoms((prev) =>
      prev.includes(fandomSlug)
        ? prev.filter((f) => f !== fandomSlug)
        : [...prev, fandomSlug]
    );
  };

  const handleContinue = () => {
    if (selectedCharacter) {
      onSelect(selectedCharacter, selectedFandoms);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-sm sm:text-base text-gray-600">Loading characters...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">Choose Your Character</h2>
      <p className="text-center text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
        Select a character to guide you through your fandom journey
      </p>

      {/* Character Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 max-h-80 sm:max-h-96 overflow-y-auto">
        {characters.map((character) => (
          <button
            key={character.id}
            onClick={() => setSelectedCharacter(character.id)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedCharacter === character.id
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="relative aspect-square bg-gray-200 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
              {character.avatar ? (
                <Image
                  src={character.avatar}
                  alt={character.name}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              ) : (
                <span className="text-4xl">🧙</span>
              )}
            </div>
            <h3 className="font-semibold text-xs sm:text-sm">{character.name}</h3>
            <p className="text-xs text-gray-500">{character.fandom.name}</p>
          </button>
        ))}
      </div>

      {/* Favorite Fandoms */}
      <div className="mb-4 sm:mb-6">
        <h3 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">Your Favorite Fandoms (Optional)</h3>
        <div className="flex flex-wrap gap-2">
          {fandoms.map((fandom) => (
            <button
              key={fandom.id}
              onClick={() => toggleFandom(fandom.slug)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm transition-colors ${
                selectedFandoms.includes(fandom.slug)
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {fandom.name}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Skip for Now
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedCharacter}
          className="flex-1 px-4 py-2 text-sm sm:text-base bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

