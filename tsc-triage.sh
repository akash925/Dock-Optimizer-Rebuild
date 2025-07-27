#!/bin/bash
pnpm exec tsc --noEmit --pretty false | grep "\.tsx\?.*error" | cut -d'(' -f1 | sort | uniq -c | sort -nr | head -10
