#!/usr/bin/env tsx
/**
 * Simple test runner for unit tests
 * Run all test files in tests/unit directory
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './tests/unit';

interface TestResult {
  file: string;
  success: boolean;
  duration: number;
}

async function runTestFile(testFile: string): Promise<TestResult> {
  const startTime = Date.now();
  const fullPath = join(TEST_DIR, testFile);

  console.log(`\n📁 Running ${testFile}...`);
  console.log('='.repeat(60));

  try {
    execSync(`npx tsx ${fullPath}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    const duration = Date.now() - startTime;
    return { file: testFile, success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    return { file: testFile, success: false, duration };
  }
}

async function main() {
  console.log('🧪 Clock-Bill Unit Test Suite');
  console.log('='.repeat(60));

  // Get all test files
  const testFiles = readdirSync(TEST_DIR)
    .filter(f => f.endsWith('.test.ts'))
    .sort();

  if (testFiles.length === 0) {
    console.log('⚠️  No test files found in', TEST_DIR);
    process.exit(0);
  }

  console.log(`\nFound ${testFiles.length} test file(s)\n`);

  // Run all tests
  const results: TestResult[] = [];
  for (const testFile of testFiles) {
    const result = await runTestFile(testFile);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal: ${testFiles.length} files`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  // Print individual file results
  console.log('File Results:');
  console.log('-'.repeat(60));
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    console.log(`  ${status} ${result.file.padEnd(30)} ${duration}`);
  }

  console.log('');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
