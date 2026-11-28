# SW-170 — Grant's Staging Guide

This is the non-coder operating guide for the one-time SW-170 staging setup.

## What Grant is doing

Grant is authorizing Google Cloud to create an isolated practice copy of the Schoolwide Hall Pass infrastructure.

He is **not**:

- changing the Hall Pass students use today;
- importing student or staff data;
- moving PINs;
- turning on Google sign-in;
- switching the school to the new system;
- learning Docker, PostgreSQL, IAM, or server administration.

## One-time Google Cloud action

Prerequisite: `GrantDesk Deployment` / `grantdesk-deployment` has billing enabled.

1. Open Google Cloud Console with **GrantDesk Deployment** selected.
2. Click the **Activate Cloud Shell** (`>_`) icon near the upper-right.
3. When the terminal opens, run the exact bootstrap command supplied from the SW-170 branch.
4. The script displays the project, region, GitHub repository and staging-only warning.
5. Type exactly `CREATE-STAGING` when asked.
6. If Google asks for an account authorization/permission confirmation, review that it refers to `grantdesk-deployment` before approving.
7. When the script finishes, copy only the block beginning `SW170_CLOUD_READY` back to the release agent.

The completion block contains resource names/IDs, not the database password.

## What the bootstrap creates

- a small Cloud SQL PostgreSQL staging database;
- automated backups, point-in-time recovery and deletion protection;
- an Artifact Registry container repository;
- a Secret Manager entry whose value is generated without printing the password;
- a limited runtime service account;
- a separate limited deployment service account;
- passwordless GitHub-to-Google Workload Identity Federation restricted to the SW-170 branch.

The bootstrap does not deploy or modify the legacy classroom Hall Pass.

## What happens after Grant returns the completion block

The release agent handles the rest:

1. record the safe cloud resource identifiers in the SW-170 branch;
2. allow GitHub to re-run every qualification gate;
3. choose the exact green commit as the staging candidate;
4. create the one-file staging release request;
5. watch the automated Cloud Run database migration and service deployment;
6. verify the public health endpoints and locked private teacher endpoint;
7. record the final staging URL and evidence in PR #81;
8. leave the PR unmerged and the legacy Hall Pass authoritative.

## If anything turns red

Do not improvise cloud settings.

Copy the visible error text or send a screenshot back to the release agent. A failed bootstrap or failed release remains incomplete; it does not justify bypassing the safety checks.

## Definition of done

Grant should ultimately receive one staging URL and a plain-language statement that:

- SW-170 exact release = PASS;
- database = ready;
- backup/PITR/deletion protection = PASS;
- private staff route = locked;
- real data = zero;
- current classroom Hall Pass = unchanged;
- production cutover = not performed.
