// src/wiki/diff.js

// Simple line-based diff
export function computeDiff(oldText, newText) {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  // This is a very naive diff. Ideally we'd use a library or a proper LCS algorithm.
  // Given "no dependencies", we will implement a basic Longest Common Subsequence (LCS)
  // to get decent results, or just a simple line-by-line comparison if performance is key.
  // Let's do a simple LCS for lines.

  const matrix = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const diff = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'same', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diff.unshift({ type: 'added', content: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diff.unshift({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }

  return diff;
}
