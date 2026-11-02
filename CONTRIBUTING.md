# Contributing

Thanks for helping improve Natura Map Greece. Contributions to the ETL
pipeline, API, web map, tests, and documentation are welcome.

## Get started

See the [README](README.md) for the project overview and local run instructions.
In brief, you will need Python 3.10 or later and Node.js 22.12 or later. Install
dependencies and run commands from the relevant project directory.

### ETL

```sh
cd etl
python -m pip install -r requirements.txt
python -m pytest
```

### API

Install the API runtime dependencies and start the service:

```sh
cd api
python -m pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

To run the API tests, from `api/` run:

```sh
python -m pytest
```

### Web application

```sh
cd web
npm ci
npm test
npm run build
```

The API CI job installs both API and ETL dependencies before running its tests.
GitHub Actions runs all three test suites on pull requests.

## Making a change

- Keep changes focused, and include or update tests when changing behavior.
- Preserve compatibility between the ETL-generated database, API responses,
  and frontend consumers when changing data fields or endpoints.
- For map or data-source changes, check the source's terms and preserve the
  relevant attribution. The [README](README.md) lists current data and map
  service attributions and their licenses.
- Do not commit generated databases, downloaded data, local configuration, or
  secrets. These files are excluded from version control; see `.gitignore`.
- There is no prescribed branch-naming or commit-message format. Use clear,
  descriptive names and messages.

## Opening an issue

Use the issue form that best matches your report: bug report, feature request,
or Natura data correction. Include enough detail for maintainers to understand
and verify the issue. Report suspected security vulnerabilities privately, as
described in [SECURITY.md](SECURITY.md), rather than in a public issue.

## Pull requests

Open a pull request with a concise description of the problem and the change.
Include the checks you ran and their results, and mention any checks you could
not run. For user-visible map changes, screenshots are helpful. Link a related
issue when applicable.

## Reporting security issues

Please report suspected vulnerabilities privately using GitHub's **Report a
vulnerability** feature, as described in [SECURITY.md](SECURITY.md). Do not
report them in public issues or pull requests.
