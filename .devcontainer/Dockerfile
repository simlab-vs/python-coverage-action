FROM node:24-alpine

# git to work with the repository, github-cli for pull requests and releases,
# and coverage.py to regenerate the report under tests/fixtures/project, which
# is the only Python this repository needs.
RUN apk add --no-cache git github-cli python3 py3-coverage

WORKDIR /workspace
