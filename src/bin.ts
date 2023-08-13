#!/usr/bin/env node
import { Command, Option, runExit } from 'clipanion'
import { transformv10Migration } from './index.js'
import { getDefinedProperties, importsMappingToImportDeclaration } from './utils.js'

runExit(
	class extends Command {
		tsconfigPath = Option.String('--tsconfig-path', { description: 'filepath of tsconfig.json' })

		reactNamespace = Option.Array('--react-namespace', { description: 'namespace of your tRPC React hooks' })
		callerNamespace = Option.Array('--caller-namespace', {
			description: 'namespace of your tRPC createCallers',
		})
		contextNamespace = Option.Array('--context-namespace', {
			description: 'namespace of your tRPC context helpers',
		})

		routerFactory = Option.Array('--router-factory', {
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

			await transformv10Migration(getDefinedProperties({
				reactNamespace: this.reactNamespace,
				callerNamespace: this.callerNamespace,
				contextNamespace: this.contextNamespace,
				routerFactory: this.routerFactory,
				tsconfigPath: this.tsconfigPath,
				baseProcedure: this.baseProcedure,
				serverImports: importsMappingToImportDeclaration(
					this.imports,
				),
				removeServerImports: importsMappingToImportDeclaration(
					this.removeImports,
				),
			}))
		}
	},
)
