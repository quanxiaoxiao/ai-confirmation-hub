# Testing Strategy

## Testing Requirements

Detection and lifecycle behavior must be test-driven.

## Coverage Areas

### Unit Tests
- rule matching
- fingerprint generation
- event normalization
- lifecycle transitions
- config loading

### Integration Tests
- watcher to server flow
- event merge behavior
- file-backed persistence
- local API behavior

### Fixture Tests
- Codex samples
- Claude samples
- Opencode samples
- false positive samples
- ambiguous multiline samples

## Regression Policy

Every missed detection or false positive must produce:

1. a fixture
2. a test
3. rule adjustment or logic refinement

## MVP Success

The system should be able to detect representative confirmation prompts from fixture text before tmux integration is considered complete.
