# trpc-v10-migrate-codemod

codemod to migrate your tRPC codebase from v9 to v10

This codemod **will not** perform a complete transformation. Rather, it is meant to help you with the most straightforward changes. Additionally, please examine the transformed code to ensure that it is correct.

## Usage

```sh
npx trpc-v10-migrate-codemod
```

> **Warning**
> It is recommended to run this codemod on a clean branch to ensure your changes are not lost.

This command will migrate all files included in your `tsconfig.json` to v10.

Current transformations:

- v9 router to v10 router
- v9 React client to v10 proxy React client

### Options

Run `npx trpc-v10-migrate-codemod --help` to see all options.

`--tsconfig-path` - path to your `tsconfig.json` file (default = 'tsconfig.json')

`--trpc-namespace` - namespace of your tRPC react hooks (default = 'trpc')

`--router-factory` - the function you use to create your routers (default = 'router')

`--base-procedure` - the base procedure unit for v10 (default = 't.procedure')
