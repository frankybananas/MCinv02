#!/usr/bin/env node

/**
 * Code Quality Checker
 * Analyzes code quality based on multiple metrics
 */

const fs = require('fs');
const path = require('path');

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const metrics = {
    totalLines: lines.length,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    longLines: 0,
    complexity: 0,
    duplicateCode: 0,
  };

  let inBlockComment = false;
  const maxLineLength = 120;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '') {
      metrics.blankLines++;
      continue;
    }

    // Check for block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      metrics.commentLines++;
      continue;
    }
    if (trimmed.includes('*/')) {
      inBlockComment = false;
      metrics.commentLines++;
      continue;
    }
    if (inBlockComment) {
      metrics.commentLines++;
      continue;
    }

    // Check for single-line comments
    if (trimmed.startsWith('//')) {
      metrics.commentLines++;
      continue;
    }

    // Count as code line
    metrics.codeLines++;

    // Check line length
    if (line.length > maxLineLength) {
      metrics.longLines++;
    }

    // Simple complexity check (count control structures)
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||', '?'];
    for (const keyword of complexityKeywords) {
      if (trimmed.includes(keyword)) {
        metrics.complexity++;
      }
    }
  }

  return metrics;
}

function calculateScore(metrics) {
  let score = 10;

  // Deduct for long lines (max 1 point)
  const longLineRatio = metrics.longLines / metrics.codeLines;
  if (longLineRatio > 0.3) score -= 1;
  else if (longLineRatio > 0.2) score -= 0.7;
  else if (longLineRatio > 0.1) score -= 0.4;
  else if (longLineRatio > 0.05) score -= 0.2;

  // Deduct for high complexity (max 2 points)
  const complexityRatio = metrics.complexity / metrics.codeLines;
  if (complexityRatio > 0.5) score -= 2;
  else if (complexityRatio > 0.4) score -= 1.5;
  else if (complexityRatio > 0.3) score -= 1;
  else if (complexityRatio > 0.2) score -= 0.5;

  // Deduct for lack of comments (max 1 point)
  const commentRatio = metrics.commentLines / (metrics.codeLines + metrics.commentLines);
  if (commentRatio < 0.05) score -= 1;
  else if (commentRatio < 0.1) score -= 0.5;

  // Bonus for good structure
  const blankLineRatio = metrics.blankLines / metrics.totalLines;
  if (blankLineRatio > 0.1 && blankLineRatio < 0.3) score += 0.5;

  return Math.max(0, Math.min(10, score));
}

function generateReport(filePath, metrics, score) {
  console.log('\n' + '='.repeat(60));
  console.log(`Code Quality Report: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  console.log(`\nOverall Score: ${score.toFixed(1)}/10`);
  console.log(`\nMetrics:`);
  console.log(`  Total Lines:        ${metrics.totalLines}`);
  console.log(`  Code Lines:         ${metrics.codeLines}`);
  console.log(`  Comment Lines:      ${metrics.commentLines}`);
  console.log(`  Blank Lines:        ${metrics.blankLines}`);
  console.log(`  Long Lines (>120):  ${metrics.longLines}`);
  console.log(`  Complexity Score:   ${metrics.complexity}`);
  
  console.log(`\nRatios:`);
  console.log(`  Comment Ratio:      ${(metrics.commentLines / (metrics.codeLines + metrics.commentLines) * 100).toFixed(1)}%`);
  console.log(`  Long Line Ratio:    ${(metrics.longLines / metrics.codeLines * 100).toFixed(1)}%`);
  console.log(`  Complexity Ratio:   ${(metrics.complexity / metrics.codeLines).toFixed(2)}`);
  
  console.log(`\nRecommendations:`);
  if (metrics.longLines > 0) {
    console.log(`  - Consider breaking down ${metrics.longLines} long lines for better readability`);
  }
  if (metrics.commentLines / (metrics.codeLines + metrics.commentLines) < 0.1) {
    console.log(`  - Add more comments to explain complex logic`);
  }
  if (metrics.complexity / metrics.codeLines > 0.3) {
    console.log(`  - Consider refactoring to reduce complexity`);
  }
  if (score >= 9) {
    console.log(`  ✓ Excellent code quality!`);
  } else if (score >= 8) {
    console.log(`  ✓ Good code quality with minor improvements possible`);
  } else if (score >= 7) {
    console.log(`  ⚠ Acceptable code quality, some improvements recommended`);
  } else {
    console.log(`  ⚠ Code quality needs improvement`);
  }
  console.log('='.repeat(60) + '\n');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node check-quality.js <file-path> [<file-path2> ...]');
  process.exit(1);
}

let totalScore = 0;
let fileCount = 0;

for (const filePath of args) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }

  const metrics = analyzeFile(filePath);
  const score = calculateScore(metrics);
  generateReport(filePath, metrics, score);
  
  totalScore += score;
  fileCount++;
}

if (fileCount > 1) {
  console.log('\n' + '='.repeat(60));
  console.log(`Average Score: ${(totalScore / fileCount).toFixed(1)}/10`);
  console.log('='.repeat(60) + '\n');
}

process.exit(totalScore / fileCount >= 8 ? 0 : 1);
