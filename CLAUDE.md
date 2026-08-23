# mint-members

## Deploying

Vercel deploys the Next.js frontend on push to `main`. **It does not deploy Convex.**
Convex is deployed manually:

```bash
npx convex deploy
```

### When a Convex deploy is required

Not just when you edit `convex/*.ts`. The Convex bundle includes everything those
files import — several of them import from `src/lib/`:

| Convex file | Imports from `src/lib/` |
|---|---|
| `convex/training.ts` | `training/modules`, `training/progress` (and transitively `training/general`, `training/lnt`, `training/types`) |
| `convex/applications.ts` | `opsSignupsView/types`, `opsSignupsView/evaluate` |
| `convex/attendeeProfiles.ts` | `attendeeProfile/*`, `applications/types`, `applications/validation` |
| `convex/confirmedMembers.ts` | `confirmedMembers/normalize` |
| `convex/newbieInvites.ts` | `applications/validation` |

So editing `src/lib/training/general.ts` changes backend validation behaviour even
though no `convex/` file changed. Check before assuming a deploy isn't needed:

```bash
git diff <last-deployed-sha>..HEAD --stat -- convex/ src/lib/
```

**Skipping the deploy causes a silent split-brain:** the browser runs new code while
Convex enforces the old rules. In Aug 2026 this took the General training module
completely offline — the client sent module version `2026.2` while the deployed
backend still only accepted `2026.1`, so every save and every completion was
rejected with "Unknown training module version".

## Training modules

Module content lives in `src/lib/training/{general,lnt}.ts` and is versioned.
`completionPolicy.acceptedVersions` decides which past completions still count:
drop an old version to force everyone to retake, keep it to grandfather them in.

Progress state is validated against the *current* content in
`src/lib/training/progress.ts`. If you shrink a content array (e.g. 4 videos to 2),
stored progress holding the removed indices fails validation and the whole state is
discarded, resetting that member to step 0. Either narrow `acceptedVersions` at the
same time (so the stale record is never loaded) or migrate the state.
