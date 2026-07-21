const nextJest = require("next/jest");

const createJestConfig = nextJest({
    dir: "./",
});

const customJestConfig = {
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
    testMatch: ["**/?(*.)+(spec|test).[tj]s?(x)"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};

module.exports = createJestConfig(customJestConfig);
