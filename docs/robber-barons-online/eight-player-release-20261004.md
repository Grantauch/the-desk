# Eight-player completion

All eight barons now have a 400x600 character card, 160x160 face portrait, and transparent 200x200 tabletop piece. The four new pieces were generated using the existing painted miniature pieces as style references and optimized to WebP with alpha preserved. Gould uses a telegraph, Stanford a golden spike, Green a money bag and bonds, and Frick a coke oven.

The Firebase console was read on October 4, 2026 (Eastern): its published rules already match the eight-seat source rules. No rules publication was needed. Live anonymous-auth acceptance verified all eight seat claims and a game-state write from each seat. A ninth seat, non-player write, stale move version, and global game listing were rejected. Only a new synthetic game with QA nicknames was used; existing games were not changed.

The required hosted check passed and PR #166 merged at 1342a6aa3287e52efa4d5476d9e5282b7dc33fb5. All 24 hosted-preview card/face/piece files match the completed source bytes. An actual hosted eight-player grand-board game started, all eight tabletop images decoded, a business purchase reduced cash correctly and the turn advanced. Independent Chrome/in-app browser players also hosted/joined and synchronized Gould/Frick purchases, cash and turns using the live Firebase backend.

Netlify explicitly skipped the production deployment because account deploy credits are exhausted; the existing production site remains online. Exact production publication and real school-network/classroom play have not been observed.
