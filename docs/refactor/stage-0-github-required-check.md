# Stage 0 GitHub required check

Target branch: `main`.

Configure the repository ruleset or branch protection with:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Required status check: `CI / quality-gate`.
- Require conversation resolution before merging.
- Block force pushes.
- Block branch deletion.

Do not mark this gate complete until a test pull request has produced `CI / quality-gate` and GitHub shows it as required.

## Evidence

- Status: configured
- Date: 2026-09-01
- Configured by: `uglanovrm`
- Test pull request: https://github.com/ogo-psyo/psyo/pull/1
- Protection API: https://api.github.com/repos/ogo-psyo/psyo/branches/main/protection
- Required check evidence: https://github.com/ogo-psyo/psyo/actions/runs/33545582984/job/99982128089
