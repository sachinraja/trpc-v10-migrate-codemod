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
- `createCaller` to proxy caller

### Options

Run `npx trpc-v10-migrate-codemod --help` to see all options.

`--tsconfig-path` - path to your `tsconfig.json` file (default = 'tsconfig.json')

`--react-namespace` - namespace of your tRPC React hooks (can be specified multiple times) (default = 'trpc')

- setting this to an empty string (`--react-namespace=''`) will match hooks without a namespace like `useQuery()` and `useMutation()`

`--caller-namespace` - namespace of your tRPC `createCaller`s (i.e. `const caller = appRouter.createCaller()`) (can be specified multiple times) (default = 'caller')

`--context-namespace` - namespace of your tRPC context helpers (i.e. `const utils = trpc.useContext()`) (can be specified multiple times) (default = 'utils')

`--router-factory` - the function you use to create your routers (i.e. `createRouter`, `createProtectedRouter`) (can be specified multiple times) (default = ['router'])

`--base-procedure` - the base procedure unit for v10 (i.e. `adminProcedure`) (default = 't.procedure')

`--import` - named import to add to the top of every file with a transformed router (can be specified multiple times)

- structure is [named import]:[module specifier]
- example: `--import t:~/server/trpc --import adminProcedure:~/server/trpc`

`--remove-import` - named import to remove from every file with a transformed router (can be specified multiple times)

- structure is [named import]:[module specifier]
- example: `--remove-import createRouter:~/server/trpc`
