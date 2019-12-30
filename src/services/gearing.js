const QUALITY_LETTERS = {
  Fine: 'E',
  High: 'D',
  Great: 'C',
  Excellent: 'B',
  Masterpiece: 'A',
  'Epic Fine': 'SE',
  'Epic High': 'SD',
  'Epic Great': 'SC',
  'Epic Excellent': 'SB',
  'Epic Masterpiece': 'SA',
};

export function qualityLetter(quality) {
  return QUALITY_LETTERS[quality] || '?';
}

export function conditionIcon({ condition }) {
  switch (condition) {
    case 'broken':
      return '🛠';
    case 'reinforced':
      return '✨';
    default:
      return '';
  }
}
