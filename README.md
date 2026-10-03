# Emlawtech

[![CI](https://github.com/deslawson/Emlawtech/actions/workflows/ci.yml/badge.svg)](https://github.com/deslawson/Emlawtech/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)

Emlawtech is an open-source escrow platform for freelance and service
marketplaces, built for the [Stellar](https://stellar.org) network. A client
locks funds, a freelancer delivers, and the funds are released on approval,
with an arbiter available if the two sides disagree.

> **Status: early development.** The escrow rules and an HTTP API are working
> and tested. Settlement on the Stellar network, wallet sign-in and a full web
> app are not built yet. Do not use it with real funds. See the
> [roadmap](ROADMAP.md).

## How an escrow works

1. The client creates an escrow naming the freelancer and an arbiter.
2. The client funds it.
3. The freelancer submits the work.
4. The client approves and the funds are released. If the client does not
   respond within the review window, the funds are released automatically.
5. If either side disagrees, they open a dispute and the arbiter decides
   whether to release or refund.

## Features today

- **Safe amounts:** XLM values are handled as integer stroops, never floats.
- **Stellar key validation:** public keys are checked, including the checksum.
- **Escrow state machine:** role-based permissions, disputes, review window
  and a full history of every transition.
- **HTTP API:** create escrows, read them and apply actions.
- **Tests and CI:** every change is built and tested on GitHub Actions.

## Tech stack

- TypeScript (strict), Node.js 22
- npm workspaces
- Node's built-in `http` server and test runner (no runtime dependencies)

## Quick start

```bash
git clone https://github.com/deslawson/Emlawtech.git
cd Emlawtech
npm install
npm test
npm run dev
```

The API is then available at `http://localhost:4000`:

```bash
curl http://localhost:4000/health
```

## Project structure

```
Emlawtech/
├── packages/escrow-core/   Escrow rules, amounts and Stellar key validation
├── backend/                HTTP API
├── web/                    Static landing page
├── docs/                   Architecture, API reference, issue drafts
└── .github/                CI workflow, issue and pull request templates
```

## Documentation

- [Architecture and escrow lifecycle](docs/architecture.md)
- [HTTP API reference](docs/api.md)
- [Roadmap](ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Contributing

Contributions are welcome, including through the Stellar Wave Program on
Drips. Start with the [contributing guide](CONTRIBUTING.md) and look for issues
labelled `good first issue`.

## License

MIT. See [LICENSE](LICENSE).
