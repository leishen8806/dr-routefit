# DR RouteFit Customer Web

Batch 1 is an Expo SDK 58 web skeleton shared by Telegram Mini App and ordinary H5 runtime modes. It contains no sign-in, customer data, order API, Bot, webhook or deployment configuration.

## Run

Use Node 24:

```text
npm ci
npm start --workspace @routefit/customer-app
```

Open the printed local URL. `/` contains four empty-state tabs; `/track` is a delivery-tracking placeholder that reads no order.

## Checks

```text
npm run lint --workspace @routefit/customer-app
npm run typecheck --workspace @routefit/customer-app
npm test --workspace @routefit/customer-app
npm run build:web --workspace @routefit/customer-app
```

Browser evidence requires a local Chrome installation and a repository-external directory:

```text
ROUTEFIT_EVIDENCE_DIRECTORY=<outside-repository> npm run test:browser --workspace @routefit/customer-app
```

The browser check covers H5 language/tab behavior at 390 px and a mocked Telegram WebApp at 1440 px. Real Telegram is **NOT_RUN** because no Bot or public address exists.

## Runtime boundary

- H5 is the default when Telegram launch context is absent.
- The official Telegram WebApp script is injected only when Telegram launch data is present and no WebApp object already exists.
- Mini App startup calls `ready()` and `expand()`, applies Telegram theme/safe-area values, and wires its back button on `/track`.
- This client never reads `initDataUnsafe`. A future authentication adapter may send raw `initData` to the server for validation; it must never trust client-decoded identity fields.
