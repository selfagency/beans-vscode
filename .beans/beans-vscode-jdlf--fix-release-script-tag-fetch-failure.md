---
# beans-vscode-jdlf
title: Fix release script tag-fetch failure
status: completed
type: bug
priority: high
created_at: 2026-02-17T22:13:52Z
updated_at: 2026-02-17T22:15:12Z
---

## Goal\nPrevent release failure when local tags diverge from origin tags.\n\n## Tasks\n- [ ] Reproduce and identify failing command\n- [ ] Patch release script to avoid tag clobber fetch path\n- [ ] Validate script behavior\n- [x] Commit fix

## Summary of Changes\n- Fixed  to fetch only  (no global tag fetch).\n- Switched previous-tag detection to remote tags via a03fd63e69bbb43ab206f4f73525674f462aafa0	HEAD
216dcbbcbeaf50dd6369b332a7e3c51c31e2ecc4	refs/heads/copilot/fix-dev-containers-workflow
81d087db17cf075dbb3920c30b4e2ab178139c1f	refs/heads/copilot/fix-setup-beans-dialog-repo
c17eec36d20c4d43ad51e082994dae774e09c79a	refs/heads/fixes/worktree-20260217
a03fd63e69bbb43ab206f4f73525674f462aafa0	refs/heads/main
2627efa24e3cfc2c09b155d7db27bfaa40cd964d	refs/pull/1/head
ed65adeb3f396caeab22325cc31ca884c917e5a3	refs/pull/10/head
af8dddb0799cb3093c2fb1fee55088d6036be9f4	refs/pull/11/head
005ed4d5f31eee7ff224a1ecbb3ccfd5852eb654	refs/pull/12/head
4128f6e59199221a64d3d0981553d221c2f3993f	refs/pull/13/head
36c4dd643c4c4e215b1053355e9efd4b1480169c	refs/pull/14/head
faf63c118eb6b2a3137735f327cc10c9df202567	refs/pull/15/head
2e5ce4cfb6bc35e2cc1716ad03cfbd910e9eaafd	refs/pull/16/head
bc309c9afd26c6d6daa51c58962233df2166d9b1	refs/pull/17/head
04a84d6193f59ada5c8287bbdbe6c4dd5054e573	refs/pull/18/head
a7f81e4b3e9a177785fa02d8d4111d65b77aea47	refs/pull/19/head
82b0dce559680a2c824dffd387e9c589f7c0af84	refs/pull/2/head
65f3aae5c8cdae379b607c11ac898d58e9f1f239	refs/pull/20/head
4b60c2bc876ae8d0e46674bd15dc300340f8f63b	refs/pull/21/head
80031c87752f4e4218eda0eaa710243a6cffa4ac	refs/pull/22/head
2ab4488ecbaf4d719b066237120dd4c1b1843f60	refs/pull/23/head
3aea4ce9d13d0e58eeb80785c453111dfaae1d94	refs/pull/24/head
c17eec36d20c4d43ad51e082994dae774e09c79a	refs/pull/25/head
81d087db17cf075dbb3920c30b4e2ab178139c1f	refs/pull/26/head
216dcbbcbeaf50dd6369b332a7e3c51c31e2ecc4	refs/pull/27/head
191b6b5913ff20a42b8933d60a6f23f764930615	refs/pull/3/head
424fc1a606d2d725aabf11f1ac062937921f4b4a	refs/pull/4/head
8b5b03177a78b1854eb674b0e070160ff1f1d3d9	refs/pull/5/head
cf9bee428420e947ab6548c2c29a0de12c8421a6	refs/pull/6/head
40a8304586603b74a2478e8f680ef154ceada2c1	refs/pull/7/head
85015034f7279d3fdd368ea41a80c120ccb85eb3	refs/pull/8/head
4145363662b0bde1018ad60e408dfd3e230e6935	refs/pull/9/head
9edd9eb8c49364b3aa29a813da0f50404742705a	refs/tags/v1.0.0
a3f4cbabc86d90c8fa82573cab6be75dcdad5fa0	refs/tags/v1.0.0^{}
3dde253761ecf6b3e082e3fedcc8d68ef6827b71	refs/tags/v1.0.1
31c6a25b827f8ac242a10224538897886be614e2	refs/tags/v1.0.1^{}
1e8b3e37506c07294efee4d5e4b40f7f8446e950	refs/tags/v1.0.2
cd7c73ce54878d76b76981ca3109dafdc484af11	refs/tags/v1.0.2^{}
83484a4b98cabb167e83999e8c9d4de8cac12e2d	refs/tags/v1.0.3
f10cb4cb8d60d8ed9a08c93cd4bc091145575424	refs/tags/v1.0.3^{}
d6e353b1a651ea277214417bd101f7811f54ae29	refs/tags/v1.0.4
57c3e84b88aabc5ecab943bbbba91cccba49c1c7	refs/tags/v1.0.5.\n- Realigned local  tag to match  to clear local fetch clobber errors.
