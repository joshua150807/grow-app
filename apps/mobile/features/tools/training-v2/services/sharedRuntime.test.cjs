const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { resolve } = require('metro-resolver');

const repositoryRoot = path.resolve(__dirname, '../../../../../..');
const mobileRoot = path.join(repositoryRoot, 'apps/mobile');
const sharedSrcDir = path.join(repositoryRoot, 'packages/shared/src');

// Load the project's actual apps/mobile/metro.config.js so this test exercises the
// real resolver (including its transitive .js -> .ts fallback for @grow/shared),
// not a bare default config that would miss the fallback entirely.
const metroConfig = require(path.join(mobileRoot, 'metro.config.js'));

function fileSystemLookup(target) {
  try {
    const realPath = fs.realpathSync(target);
    const stat = fs.statSync(realPath);
    return { exists: true, type: stat.isDirectory() ? 'd' : 'f', realPath };
  } catch {
    return { exists: false };
  }
}

function makeResolverContext(originModulePath) {
  const config = metroConfig;
  return {
    allowHaste: false,
    assetExts: new Set(config.resolver.assetExts),
    customResolverOptions: Object.create(null),
    disableHierarchicalLookup: false,
    doesFileExist: (target) => {
      const result = fileSystemLookup(target);
      return result.exists && result.type === 'f';
    },
    extraNodeModules: null,
    dev: false,
    getPackage: (target) => {
      try {
        return JSON.parse(fs.readFileSync(target, 'utf8'));
      } catch {
        return null;
      }
    },
    getPackageForModule: () => null,
    fileSystemLookup,
    isESMImport: true,
    mainFields: config.resolver.resolverMainFields,
    originModulePath,
    nodeModulesPaths: config.resolver.nodeModulesPaths ?? [],
    preferNativePlatform: true,
    resolveAsset: () => null,
    redirectModulePath: (target) => target,
    resolveHasteModule: () => null,
    resolveHastePackage: () => null,
    sourceExts: config.resolver.sourceExts,
    unstable_conditionNames: config.resolver.unstable_conditionNames ?? [],
    unstable_conditionsByPlatform: config.resolver.unstable_conditionsByPlatform ?? {},
    unstable_enablePackageExports: config.resolver.unstable_enablePackageExports,
    unstable_logWarning: () => {},
    resolveRequest: (context, moduleName, platform) => resolve(context, moduleName, platform),
  };
}

test('Expo Metro resolves @grow/shared to tracked TypeScript source without dist', () => {
  const context = makeResolverContext(path.join(
    mobileRoot,
    'features/tools/training-v2/services/trainingV2Api.js',
  ));
  const resolved = metroConfig.resolver.resolveRequest(context, '@grow/shared', 'ios');

  assert.equal(resolved.type, 'sourceFile');
  assert.equal(
    path.normalize(resolved.filePath),
    path.join(repositoryRoot, 'packages/shared/src/index.ts'),
  );
  assert.equal(resolved.filePath.includes(`${path.sep}dist${path.sep}`), false);
});

test('Expo Metro resolves every transitive .js import inside @grow/shared to its tracked .ts source', () => {
  const indexPath = path.join(sharedSrcDir, 'index.ts');
  const indexSource = fs.readFileSync(indexPath, 'utf8');
  const jsImports = [...indexSource.matchAll(/from '(\.\/[^']+\.js)'/g)].map((match) => match[1]);

  assert.ok(jsImports.length > 0, 'expected packages/shared/src/index.ts to re-export .js-suffixed modules');

  for (const specifier of jsImports) {
    const context = makeResolverContext(indexPath);
    const resolved = metroConfig.resolver.resolveRequest(context, specifier, 'ios');

    assert.equal(resolved.type, 'sourceFile');
    assert.equal(path.extname(resolved.filePath), '.ts');
    assert.equal(
      path.normalize(resolved.filePath),
      path.join(sharedSrcDir, specifier.replace(/^\.\//, '').replace(/\.js$/, '.ts')),
    );
  }
});

test('actual Shared source exports Zod schemas and parses valid fixtures without dist', () => {
  const script = `
    import {
      listTrainingPlansResponseSchema,
      trainingExerciseDetailResponseSchema,
      trainingPlanDetailResponseSchema,
    } from './packages/shared/src/index.ts';
    const id = (suffix) => \`00000000-0000-4000-8000-\${String(suffix).padStart(12, '0')}\`;
    const plan = {
      id: id(1), name: 'Plan', status: 'draft', version: 1,
      currentRevisionId: id(2), weeklyGoal: 3,
      createdAt: '2026-07-27T00:00:00.000Z', updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: null, archivedAt: null, schedule: null,
      revision: { id: id(2), revisionNumber: 1, createdAt: '2026-07-27T00:00:00.000Z', units: [] },
    };
    const exercise = {
      id: id(3), systemKey: 'runtime_fixture', scope: 'system', status: 'active',
      category: 'strength', loadType: 'total_weight', name: 'Runtime Fixture',
      mainMuscle: null, supportingMuscles: [], difficulty: null, equipment: [],
      isHome: true, isGym: true, isBodyweight: true, imageReference: null,
      executionInstructions: null, commonMistakes: null, safetyNotes: null,
      version: 1, createdAt: '2026-07-27T00:00:00.000Z', updatedAt: '2026-07-27T00:00:00.000Z',
    };
    for (const schema of [
      listTrainingPlansResponseSchema,
      trainingPlanDetailResponseSchema,
      trainingExerciseDetailResponseSchema,
    ]) {
      if (typeof schema?.safeParse !== 'function') throw new Error('Missing Zod schema');
    }
    listTrainingPlansResponseSchema.parse({ plans: [] });
    trainingPlanDetailResponseSchema.parse({ plan });
    trainingExerciseDetailResponseSchema.parse({ exercise });
  `;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
