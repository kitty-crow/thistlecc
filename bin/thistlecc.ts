#!/usr/bin/env bun

import { main } from "../src/cli.js";

process.exitCode = await main();
