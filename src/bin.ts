#!/usr/bin/env node
import { Command, Option, runExit } from 'clipanion'
import { transformv10Migration } from './index.js'
import { MigrateConfig } from './types.js'
import { getDefinedProperties } from './utils.js'

runExit(
	class extends Command {
		tsconfigPath = Option.String('--tsconfig-path', { description: 'filepath of tsconfig.json' })
		trpcNamespace = Option.String('--trpc-namespace', { description: 'namespace of the tRPC react hooks' })
		routerFactory = Option.String('--router-factory', {
			description: 'name of the function used to create your routers',
		})
		baseProcedure = Option.String('--base-procedure', {
			description: 'the variable name of the base procedure to chain new ones from',
		})
		imports = Option.Array('--import', [], {
			description: 'imports to add to the top of every file with a transformed router',
		})
		removeImports = Option.Array('--remove-import', [], {
			description: 'imports to remove from the top of every file with a transformed router',
		})

		static usage = Command.Usage({
			description: 'migrate your codebase from tRPC v9 to v10',
			examples: [
				[
					'basic example',
					'$0',
				],
				[
					'with configuration (the defaults are shown)',
					'$0 --tsconfig-path tsconfig.json --trpc-namespace trpc --router-factory router --base-procedure t.procedure',
				],
				['with injected server imports', '$0 --import t:~/server/trpc --import adminProcedure:~/server/trpc'],
				['with removed imports', '$0 --remove-import createRouter:~/server/trpc'],
			],
		})

		async execute() {
			console.log('migrating...')
			const serverImports: MigrateConfig['serverImports'] = this.imports.map((serverImport) => {
				const [namedImport, moduleSpecifier] = serverImport.split(':')
				return {
					moduleSpecifier,
					namedImports: [namedImport],
				}
			})

			const removeServerImports: MigrateConfig['removeServerImports'] = this.removeImports.map((serverImport) => {
				const [namedImport, moduleSpecifier] = serverImport.split(':')
				return {
					moduleSpecifier,
					namedImports: [namedImport],
				}
			})

			await transformv10Migration(getDefinedProperties({
				trpcNamespace: this.trpcNamespace,
				routerFactory: this.routerFactory,
				tsconfigPath: this.tsconfigPath,
				baseProcedure: this.baseProcedure,
				serverImports,
				removeServerImports,
			}))
		}
	},
)
