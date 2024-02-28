# JSR npm command line tool

The JSR npm CLI integrates JSR (JavaScript Registry) packages with npm-based
projects, facilitating the use of JSR packages in environments that
traditionally rely on npm. Learn more about JSR at [jsr.io](https://jsr.io).

## Quick Start

Add a JSR package to your project:

```sh
npx jsr add @package/name  # 'install' and 'i' are also supported
```

This command auto-updates your `package.json` and installs the package,
automatically detecting and using your project's package manager.

## How It Works

The CLI creates or updates a `.npmrc` file in your project with:

```
@jsr:registry=https://npm.jsr.io
```

This line redirects npm to fetch JSR packages from the JSR registry instead of
the default npm registry.

Packages are added to `package.json` with an alias, mapping the JSR package name
to the npm registry URL hosted by JSR, like so:

```json
{
  "dependencies": {
    "@luca/flag": "npm:@jsr/luca__flag@1"
  }
}
```

This ensures that the package is fetched from JSR when you run npm install
commands.

## Commands

- `add`, `install`, `i`: Adds a JSR package to your project.
- `remove`, `uninstall`, `r`: Remove a JSR package from your project.
- `publish`: Publish `package.json` libraries to JSR.
- `run <script>`: Run a JSR package script.
- `<script>`: Run a JSR package script without `run` command.

## Limitations

- `jsr:` import specifiers are not supported.
- Due to transpilation, the developer experience in editors might differ from
  native JSR usage.

For the best developer experience and to fully leverage JSR's capabilities,
consider environments with native JSR support like Deno.

## Contributing

We welcome contributions and feedback. Visit our GitHub repository to contribute
or report issues.

## License

This CLI is available under the
[MIT License](https://opensource.org/licenses/MIT).
