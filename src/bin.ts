#!/usr/bin/env node
import { Command, Option, runExit } from 'clipanion'
import { transformv10Migration } from './index.js'
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

		static usage = Command.Usage({
			description: 'migrate your codebase from tRPC v9 to v10',
			examples: [[
				'a basic example',
				'$0',
			], [
				'with configuration (the defaults are shown)',
				'$0 --tsconfig-path tsconfig.json --trpc-namespace trpc --router-factory router --base-procedure t.procedure',
			]],
		})

		async execute() {
			console.log('migrating...')
			await transformv10Migration(getDefinedProperties({
				trpcNamespace: this.trpcNamespace,
				routerFactory: this.routerFactory,
				tsconfigPath: this.tsconfigPath,
				baseProcedure: this.baseProcedure,
			}))
			console.log('migration complete!')
		}
	},
)
