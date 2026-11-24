import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { LOG_LEVEL: 'silent' },
    projects: [
      // Each module of src/ on its own, its collaborators faked.
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      // The assembled app over HTTP on an ephemeral port, with a fake turn runner: what only the endpoints show.
      { extends: true, test: { name: 'api', include: ['tests/api/**/*.test.ts'] } }
    ]
  }
});
