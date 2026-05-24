'use client';

import { useState } from 'react';

interface FandomQuizProps {
  onComplete: (data: { favoriteFandoms: string[]; interests: string[] }) => void;
  onSkip: () => void;
}

const fandoms = [
  'Harry Potter',
  'Lord of the Rings',
  'Game of Thrones',
  'Marvel',
  'Star Wars',
  'DC Comics',
  'Disney',
  'Anime',
];

const interests = [
  'Collectibles',
  'Clothing & Apparel',
  'Books & Literature',
  'Jewelry & Accessories',
  'Home Decor',
  'Toys & Games',
  'Art & Posters',
  'Electronics',
];

export function FandomQuiz({ onComplete, onSkip }: FandomQuizProps) {
  const [selectedFandoms, setSelectedFandoms] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const toggleFandom = (fandom: string) => {
    setSelectedFandoms((prev) =>
      prev.includes(fandom)
        ? prev.filter((f) => f !== fandom)
        : [...prev, fandom]
    );
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = () => {
    if (selectedFandoms.length > 0 || selectedInterests.length > 0) {
      onComplete({
        favoriteFandoms: selectedFandoms,
        interests: selectedInterests,
      });
    }
  };

  return (
    <div className="bg-hos-bg-secondary rounded-xl shadow-lg p-8 max-h-[600px] overflow-y-auto">
      <h2 className="text-2xl font-bold text-center mb-2">Tell Us About Your Interests</h2>
      <p className="text-center text-hos-text-secondary mb-6">
        Help us personalize your experience
      </p>

      {/* Favorite Fandoms */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Select Your Favorite Fandoms</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {fandoms.map((fandom) => (
            <button
              key={fandom}
              onClick={() => toggleFandom(fandom)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedFandoms.includes(fandom)
                  ? 'bg-hos-gold text-[#1a1406]'
                  : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
              }`}
            >
              {fandom}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3">What Interests You?</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {interests.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedInterests.includes(interest)
                  ? 'bg-hos-gold text-[#1a1406]'
                  : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-hos-gold text-[#1a1406] py-2 rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors"
        >
          Complete Setup
        </button>
      </div>
    </div>
  );
}

